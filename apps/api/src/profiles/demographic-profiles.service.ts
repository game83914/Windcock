import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SmsService } from '../auth/sms.service';
import { DemographicCryptoService, deriveDemographics } from './demographic-crypto.service';
import { GuardianOtpDto, UpdateDemographicProfileDto, VerifyGuardianOtpDto } from './dto/demographic-profile.dto';
import { isValidDistrict, TAIWAN_DISTRICTS } from './taiwan-districts';

export const DEMOGRAPHIC_CONSENT_VERSION = '2026-09-v3';
export const LEGACY_ANALYTICS_CONSENT_VERSION = '2026-09-v2';

@Injectable()
export class DemographicProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sms: SmsService,
    private readonly crypto: DemographicCryptoService,
  ) {}

  options() {
    return {
      regions: Object.entries(TAIWAN_DISTRICTS).map(([region, districts]) => ({ region, districts })),
      specialRegions: ['海外', '不願透露'],
    };
  }

  async get(userId: bigint) {
    const profile = await this.prisma.userDemographicProfile.findUnique({
      where: { userId },
      include: { guardianConsent: true },
    });
    return profile ? this.serialize(profile) : null;
  }

  async update(userId: bigint, dto: UpdateDemographicProfileDto) {
    const profile = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${userId})`;
      const existing = await tx.userDemographicProfile.findUnique({ where: { userId }, include: { guardianConsent: true } });
      let encrypted = existing?.birthDateCiphertext
        ? { ciphertext: existing.birthDateCiphertext, iv: existing.birthDateIv!, authTag: existing.birthDateAuthTag!, keyVersion: existing.birthDateKeyVersion! }
        : null;
      let demographics = encrypted
        ? deriveDemographics(this.crypto.decryptBirthDate(encrypted.ciphertext, encrypted.iv, encrypted.authTag, encrypted.keyVersion))
        : null;
      if (dto.birthDate !== undefined) {
        encrypted = dto.birthDate ? this.crypto.encryptBirthDate(dto.birthDate) : null;
        demographics = dto.birthDate ? deriveDemographics(dto.birthDate) : null;
      }
      if (dto.analyticsConsent && !demographics) throw new BadRequestException('同意人口分析時必須填寫生日，以計算年齡區間');
      if (dto.analyticsConsent && dto.analyticsConsentVersion !== DEMOGRAPHIC_CONSENT_VERSION) throw new BadRequestException('請先閱讀並同意最新版人口資料用途');
      const nextRegion = dto.region === undefined ? existing?.region : dto.region;
      const nextDistrict = dto.district === undefined ? existing?.district : dto.district;
      if (!isValidDistrict(nextRegion, nextDistrict)) throw new BadRequestException('行政區不屬於所選縣市');

      const guardianVerified = existing?.guardianConsentStatus === 'VERIFIED'
        && existing.guardianConsent?.consentVersion === DEMOGRAPHIC_CONSENT_VERSION
        && !existing.guardianConsent.revokedAt;
      const guardianStatus = demographics?.isMinor
        ? dto.analyticsConsent ? (guardianVerified ? 'VERIFIED' : 'PENDING') : 'REVOKED'
        : 'NOT_REQUIRED';
      const wasConsented = existing?.analyticsConsent === true;
      const acceptedCurrentVersion = existing?.consentVersion === DEMOGRAPHIC_CONSENT_VERSION;
      const now = new Date();
      const saved = await tx.userDemographicProfile.upsert({
        where: { userId },
        create: {
          userId,
          birthDateCiphertext: encrypted?.ciphertext ?? null,
          birthDateIv: encrypted?.iv ?? null,
          birthDateAuthTag: encrypted?.authTag ?? null,
          birthDateKeyVersion: encrypted?.keyVersion ?? null,
          gender: dto.gender ?? null,
          occupation: dto.occupation ?? null,
          region: dto.region ?? null,
          district: dto.district ?? null,
          personalityType: dto.personalityType ?? null,
          employmentStatus: dto.employmentStatus ?? null,
          industry: dto.industry ?? null,
          annualIncome: dto.annualIncome ?? null,
          education: dto.education ?? null,
          relationship: dto.relationship ?? null,
          livingArrangement: dto.livingArrangement ?? null,
          parentingStage: dto.parentingStage ?? null,
          housingStatus: dto.housingStatus ?? null,
          westernZodiac: demographics?.westernZodiac ?? null,
          chineseZodiac: demographics?.chineseZodiac ?? null,
          isMinor: demographics?.isMinor ?? null,
          analyticsConsent: dto.analyticsConsent,
          consentVersion: dto.analyticsConsent ? DEMOGRAPHIC_CONSENT_VERSION : null,
          consentedAt: dto.analyticsConsent ? now : null,
          withdrawnAt: dto.analyticsConsent ? null : now,
          guardianConsentStatus: guardianStatus,
        },
        update: {
          birthDateCiphertext: encrypted?.ciphertext ?? null,
          birthDateIv: encrypted?.iv ?? null,
          birthDateAuthTag: encrypted?.authTag ?? null,
          birthDateKeyVersion: encrypted?.keyVersion ?? null,
          gender: dto.gender === undefined ? existing?.gender : dto.gender,
          occupation: dto.occupation === undefined ? existing?.occupation : dto.occupation,
          region: dto.region === undefined ? existing?.region : dto.region,
          district: dto.district === undefined ? existing?.district : dto.district,
          personalityType: dto.personalityType === undefined ? existing?.personalityType : dto.personalityType,
          employmentStatus: dto.employmentStatus === undefined ? existing?.employmentStatus : dto.employmentStatus,
          industry: dto.industry === undefined ? existing?.industry : dto.industry,
          annualIncome: dto.annualIncome === undefined ? existing?.annualIncome : dto.annualIncome,
          education: dto.education === undefined ? existing?.education : dto.education,
          relationship: dto.relationship === undefined ? existing?.relationship : dto.relationship,
          livingArrangement: dto.livingArrangement === undefined ? existing?.livingArrangement : dto.livingArrangement,
          parentingStage: dto.parentingStage === undefined ? existing?.parentingStage : dto.parentingStage,
          housingStatus: dto.housingStatus === undefined ? existing?.housingStatus : dto.housingStatus,
          westernZodiac: demographics?.westernZodiac ?? null,
          chineseZodiac: demographics?.chineseZodiac ?? null,
          isMinor: demographics?.isMinor ?? null,
          analyticsConsent: dto.analyticsConsent,
          consentVersion: dto.analyticsConsent ? DEMOGRAPHIC_CONSENT_VERSION : null,
          consentedAt: dto.analyticsConsent && (!wasConsented || !acceptedCurrentVersion) ? now : existing?.consentedAt,
          withdrawnAt: dto.analyticsConsent ? null : now,
          guardianConsentStatus: guardianStatus,
        },
        include: { guardianConsent: true },
      });
      if (!dto.analyticsConsent || !demographics?.isMinor) {
        if (existing?.guardianConsent) {
          await tx.guardianConsent.update({ where: { profileUserId: userId }, data: { revokedAt: now } });
        }
      }
      if (!dto.analyticsConsent) {
        await tx.voteDemographicSnapshot.deleteMany({ where: { vote: { userId } } });
      }
      return saved;
    });
    return this.serialize(profile);
  }

  async remove(userId: bigint) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${userId})`;
      await tx.voteDemographicSnapshot.deleteMany({ where: { vote: { userId } } });
      await tx.userDemographicProfile.deleteMany({ where: { userId } });
    });
    return { success: true };
  }

  async sendGuardianOtp(userId: bigint, dto: GuardianOtpDto) {
    const profile = await this.requireMinorProfile(userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { phoneNumber: true } });
    if (user?.phoneNumber === dto.phoneNumber) throw new BadRequestException('監護人門號不可與會員門號相同');

    const countKey = `guardian:otp:${userId}:h1`;
    const count = await this.redis.incr(countKey);
    if (count === 1) await this.redis.expire(countKey, 3600);
    if (count > 3) throw new HttpException('監護驗證碼發送次數過多，請稍後再試', 429);

    const code = randomBytes(3).toString('hex').toUpperCase();
    await this.redis.set(
      `guardian:otp:${userId}`,
      JSON.stringify({ code, phoneHash: this.hashPhone(dto.phoneNumber) }),
      300,
    );
    await this.sms.sendOtp(dto.phoneNumber, code, 300);
    return { success: true, expireInSeconds: 300, consentVersion: DEMOGRAPHIC_CONSENT_VERSION, status: profile.guardianConsentStatus };
  }

  async verifyGuardianOtp(userId: bigint, dto: VerifyGuardianOtpDto) {
    await this.requireMinorProfile(userId);
    const key = `guardian:otp:${userId}`;
    const attemptKey = `guardian:otp:attempts:${userId}`;
    const attempts = await this.redis.incr(attemptKey);
    if (attempts === 1) await this.redis.expire(attemptKey, 300);
    if (attempts > 5) {
      await this.redis.del(key);
      throw new HttpException('監護驗證失敗次數過多，請重新取得驗證碼', 429);
    }
    const storedValue = await this.redis.get(key);
    const stored = storedValue ? JSON.parse(storedValue) as { code: string; phoneHash: string } : null;
    if (!stored || stored.code !== dto.code.toUpperCase() || stored.phoneHash !== this.hashPhone(dto.phoneNumber) || !(await this.redis.consumeIfMatches(key, storedValue!))) {
      throw new BadRequestException('監護驗證碼不正確或已過期');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${userId})`;
      const profile = await tx.userDemographicProfile.findFirst({ where: { userId, isMinor: true, analyticsConsent: true, consentVersion: DEMOGRAPHIC_CONSENT_VERSION } });
      if (!profile) throw new NotFoundException('找不到需要監護同意的未成年分析資料');
      await tx.guardianConsent.upsert({
        where: { profileUserId: userId },
        create: {
          profileUserId: userId,
          guardianPhoneHash: stored.phoneHash,
          guardianPhoneLast4: dto.phoneNumber.slice(-4),
          consentVersion: DEMOGRAPHIC_CONSENT_VERSION,
          verifiedAt: new Date(),
        },
        update: {
          guardianPhoneHash: stored.phoneHash,
          guardianPhoneLast4: dto.phoneNumber.slice(-4),
          consentVersion: DEMOGRAPHIC_CONSENT_VERSION,
          verifiedAt: new Date(),
          revokedAt: null,
        },
      });
      await tx.userDemographicProfile.update({
        where: { userId },
        data: { guardianConsentStatus: 'VERIFIED' },
      });
    });
    await this.redis.del(attemptKey);
    return this.get(userId);
  }

  private requireMinorProfile(userId: bigint) {
    return this.prisma.userDemographicProfile.findFirst({
      where: { userId, isMinor: true, analyticsConsent: true },
    }).then((profile) => {
      if (!profile) throw new NotFoundException('找不到需要監護同意的未成年分析資料');
      return profile;
    });
  }

  private hashPhone(phone: string) {
    const pepper = process.env.PROFILE_HASH_PEPPER || process.env.JWT_SECRET || 'development-only-pepper';
    return createHmac('sha256', pepper).update(phone).digest('hex');
  }

  private serialize(profile: any) {
    const birthDate = profile.birthDateCiphertext
      ? this.crypto.decryptBirthDate(profile.birthDateCiphertext, profile.birthDateIv, profile.birthDateAuthTag, profile.birthDateKeyVersion || 1)
      : null;
    const currentConsent = profile.consentVersion === DEMOGRAPHIC_CONSENT_VERSION;
    const guardianCurrent = profile.guardianConsent?.consentVersion === DEMOGRAPHIC_CONSENT_VERSION;
    const analysisActive = profile.analyticsConsent && currentConsent && (!profile.isMinor || (profile.guardianConsentStatus === 'VERIFIED' && guardianCurrent && !profile.guardianConsent?.revokedAt));
    return {
      birthDate,
      gender: profile.gender,
      occupation: profile.occupation,
      region: profile.region,
      district: profile.district,
      personalityType: profile.personalityType,
      employmentStatus: profile.employmentStatus,
      industry: profile.industry,
      annualIncome: profile.annualIncome,
      education: profile.education,
      relationship: profile.relationship,
      livingArrangement: profile.livingArrangement,
      parentingStage: profile.parentingStage,
      housingStatus: profile.housingStatus,
      westernZodiac: profile.westernZodiac,
      chineseZodiac: profile.chineseZodiac,
      isMinor: profile.isMinor,
      analyticsConsent: profile.analyticsConsent,
      analysisActive,
      consentVersion: profile.consentVersion,
      consentedAt: profile.consentedAt,
      guardianConsentStatus: profile.guardianConsentStatus,
      guardianPhoneLast4: profile.guardianConsent?.guardianPhoneLast4 ?? null,
      updatedAt: profile.updatedAt,
    };
  }
}

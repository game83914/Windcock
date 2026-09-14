import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { AuthService } from '../auth/auth.service';
import { AuthUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { DevIdentityProfile, PolicyService } from './policy.service';

const PROFILES: Array<{ key: DevIdentityProfile; label: string }> = [
  { key: 'new-member', label: '新進會員' },
  { key: 'senior-member', label: '資深會員' },
  { key: 'partner-owner', label: '合作廠商' },
  { key: 'topic-team', label: '議題小組' },
] as const;

@Injectable()
export class DevIdentityService {
  private readonly logger = new Logger(DevIdentityService.name);

  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly auth: AuthService, private readonly policy: PolicyService) {
    if (process.env.NODE_ENV === 'production' && process.env.DEV_IDENTITY_SWITCHER_ENABLED === 'true') {
      throw new Error('DEV_IDENTITY_SWITCHER_ENABLED cannot be enabled in production');
    }
  }

  async profiles(actor: AuthUser) {
    await this.assertOperator(actor);
    return { profiles: PROFILES };
  }

  async assume(actor: AuthUser, profileKey: string) {
    await this.assertOperator(actor);
    const profile = PROFILES.find((item) => item.key === profileKey);
    if (!profile) throw new NotFoundException('測試身份不存在');
    const target = await this.prisma.user.findUnique({ where: { id: actor.userId }, select: { id: true, status: true, isPhoneVerified: true } });
    if (!target || target.status !== 'ACTIVE' || !target.isPhoneVerified) throw new NotFoundException('測試身份管理員不存在');
    const accessToken = await this.jwt.signAsync({
      sub: target.id.toString(), phone: 'dev-profile', act: actor.userId.toString(), typ: 'dev-assumption', profile: profile.key,
      aud: 'windcock-dev-assumption', jti: randomUUID(),
    }, { expiresIn: '30m' });
    this.logger.log(`identity_assumed actor=${actor.userId} target=${target.id} profile=${profile.key}`);
    const user = await this.auth.getMe(target.id);
    return {
      accessToken,
      user: { ...user, role: 'USER', nickname: `${user.nickname}（${profile.label}）` },
      capabilities: await this.policy.capabilities(target.id, profile.key),
      assumption: { profileKey: profile.key, label: profile.label },
    };
  }

  release(actor: AuthUser) {
    if (!actor.actorUserId || !actor.assumptionProfile) throw new UnauthorizedException('目前不是模擬身份');
    this.logger.log(`identity_released actor=${actor.actorUserId} target=${actor.userId} profile=${actor.assumptionProfile}`);
    return { released: true };
  }

  private async assertOperator(actor: AuthUser) {
    if (process.env.NODE_ENV === 'production' || process.env.DEV_IDENTITY_SWITCHER_ENABLED === 'false') throw new NotFoundException();
    if (actor.actorUserId) throw new UnauthorizedException('無法從模擬身份再次切換');
    const user = await this.prisma.user.findUnique({ where: { id: actor.userId }, select: { phoneNumber: true, role: true, status: true, isPhoneVerified: true } });
    const allowedPhone = process.env.DEV_IDENTITY_OPERATOR_PHONE || '0911111111';
    if (!user || user.phoneNumber !== allowedPhone || user.role !== 'ADMIN' || user.status !== 'ACTIVE' || !user.isPhoneVerified) throw new NotFoundException();
  }
}

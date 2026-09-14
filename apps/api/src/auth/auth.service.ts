import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SmsService } from './sms.service';
import { resolveAvatarUrl } from '../avatars/avatar-url';

export interface OtpResult {
  success: boolean;
  expireInSeconds: number;
  devCode?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly sms: SmsService,
  ) {}

  private async checkRateLimit(key: string, max: number, windowSeconds: number): Promise<void> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, windowSeconds);
    }
    if (count > max) {
      throw new HttpException('OTP 發送次數過多，請稍後再試', 429);
    }
  }

  async sendOtp(phoneNumber: string, turnstileToken?: string, requestIp?: string): Promise<OtpResult> {
    const normalized = this.normalizePhone(phoneNumber);
    this.assertLoginAllowed(normalized);

    await this.verifyTurnstile(turnstileToken, requestIp);

    const maxPerHour = Number(process.env.OTP_MAX_PER_HOUR || 3);
    const maxPerDay = Number(process.env.OTP_MAX_PER_DAY || 5);
    const maxPerIpDay = Number(process.env.OTP_MAX_PER_IP_DAY || 20);
    const expireSeconds = Number(process.env.OTP_EXPIRE_SECONDS || 300);

    await this.checkRateLimit(`otp:ph:${normalized}:h1`, maxPerHour, 3600);
    await this.checkRateLimit(`otp:ph:${normalized}:d1`, maxPerDay, 86400);
    if (requestIp) await this.checkRateLimit(`otp:ip:${requestIp}:d1`, maxPerIpDay, 86400);

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.redis.set(`otp:code:${normalized}`, code, expireSeconds);

    await this.sms.sendOtp(normalized, code, expireSeconds);

    const exposeDevCode = process.env.NODE_ENV !== 'production' && !process.env.SMS_PROVIDER;
    return { success: true, expireInSeconds: expireSeconds, ...(exposeDevCode ? { devCode: code } : {}) };
  }

  async verifyOtp(phoneNumber: string, code: string) {
    const normalized = this.normalizePhone(phoneNumber);
    this.assertLoginAllowed(normalized);
    const key = `otp:code:${normalized}`;
    const attemptKey = `otp:attempts:${normalized}`;
    const attempts = await this.redis.incr(attemptKey);
    if (attempts === 1) await this.redis.expire(attemptKey, Number(process.env.OTP_EXPIRE_SECONDS || 300));
    if (attempts > 5) {
      await this.redis.del(key);
      throw new HttpException('驗證失敗次數過多，請重新取得驗證碼', 429);
    }
    const stored = await this.redis.get(key);

    if (!stored || stored !== code.trim().toUpperCase() || !(await this.redis.consumeIfMatches(key, stored))) {
      throw new BadRequestException('驗證碼不正確或已過期');
    }
    await this.redis.del(attemptKey);

    const existing = await this.prisma.user.findUnique({ where: { phoneNumber: normalized } });
    if (existing && existing.status !== 'ACTIVE') {
      throw new ForbiddenException('此帳號目前無法登入');
    }

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { isPhoneVerified: true },
        })
      : await this.prisma.user.create({
          data: {
        phoneNumber: normalized,
        nickname: `用戶${normalized.slice(-4)}`,
        avatarUrl: null,
        pointsBalance: 0,
        isPhoneVerified: true,
          },
        });

    const payload = { sub: user.id.toString(), phone: masked(normalized) };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id.toString(),
        nickname: user.nickname,
        avatarUrl: resolveAvatarUrl(user.avatarUrl),
        points: user.pointsBalance.toString(),
        role: user.role,
        status: user.status,
        isPhoneVerified: user.isPhoneVerified,
      },
    };
  }

  async getMe(userId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
        pointsBalance: true,
        role: true,
        status: true,
        isPhoneVerified: true,
      },
    });
    if (!user) throw new BadRequestException('帳號不存在');
    return {
      id: user.id.toString(),
      nickname: user.nickname,
      avatarUrl: resolveAvatarUrl(user.avatarUrl),
      points: user.pointsBalance.toString(),
      role: user.role,
      status: user.status,
      isPhoneVerified: user.isPhoneVerified,
    };
  }

  private normalizePhone(phoneNumber: string): string {
    let p = phoneNumber.replace(/[^0-9+]/g, '');
    if (p.startsWith('+886')) {
      p = '0' + p.slice(4);
    } else if (p.startsWith('886')) {
      p = '0' + p.slice(3);
    }
    if (!/^09\d{8}$/.test(p)) {
      throw new BadRequestException('請輸入有效的台灣手機門號（09xxxxxxxx）');
    }
    return p;
  }

  private assertLoginAllowed(phoneNumber: string) {
    const allowed = (process.env.ALLOWED_LOGIN_PHONES || process.env.DEV_IDENTITY_OPERATOR_PHONE || '0911111111')
      .split(',')
      .map((phone) => phone.trim())
      .filter(Boolean);
    if (!allowed.includes(phoneNumber)) throw new ForbiddenException('此門號目前不開放登入');
  }

  private async verifyTurnstile(token?: string, remoteIp?: string): Promise<void> {
    const secret = process.env.TURNSTILE_SECRET;
    if (!secret) return;
    if (!token) throw new BadRequestException('請完成人機驗證');
    try {
      const body = new URLSearchParams({ secret, response: token });
      if (remoteIp) body.set('remoteip', remoteIp);
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(8000) });
      const result = await response.json() as { success?: boolean };
      if (!response.ok || !result.success) throw new BadRequestException('人機驗證失敗，請重新操作');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException('人機驗證服務暫時無法使用');
    }
  }
}

function masked(p: string): string {
  return p.slice(0, 4) + '****' + p.slice(-2);
}

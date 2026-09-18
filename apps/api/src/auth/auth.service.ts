import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { resolveAvatarUrl } from '../avatars/avatar-url';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';

const BCRYPT_COST = 12;
const INVALID_CREDENTIALS_MESSAGE = '帳號或密碼不正確';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
  ) {}

  private async checkRateLimit(key: string, max: number, windowSeconds: number): Promise<void> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, windowSeconds);
    }
    if (count > max) {
      throw new HttpException('嘗試次數過多，請稍後再試', 429);
    }
  }

  async register(dto: RegisterDto, requestIp?: string) {
    await this.verifyTurnstile(dto.turnstileToken, requestIp);

    const maxRegPerIpDay = Number(process.env.REGISTER_MAX_PER_IP_DAY || 20);
    if (requestIp) {
      await this.checkRateLimit(`reg:ip:${requestIp}:d1`, maxRegPerIpDay, 86400);
    }

    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('此 Email 已被註冊');
    }

    let phoneNumber: string | null = null;
    if (dto.phoneNumber !== undefined && dto.phoneNumber !== null && dto.phoneNumber !== '') {
      phoneNumber = this.normalizePhone(dto.phoneNumber);
      const phoneOwner = await this.prisma.user.findUnique({ where: { phoneNumber } });
      if (phoneOwner) {
        throw new ConflictException('此手機門號已被使用');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        passwordUpdatedAt: new Date(),
        phoneNumber,
        nickname: dto.nickname.trim(),
        avatarUrl: null,
        pointsBalance: 0,
        isPhoneVerified: false,
      },
    });

    return this.session(user.id, email);
  }

  async login(dto: LoginDto, requestIp?: string) {
    await this.verifyTurnstile(dto.turnstileToken, requestIp);

    const maxPerIpDay = Number(process.env.LOGIN_MAX_PER_IP_DAY || 100);
    if (requestIp) {
      await this.checkRateLimit(`login:ip:${requestIp}:d1`, maxPerIpDay, 86400);
    }

    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const maxPerAcctHour = Number(process.env.LOGIN_MAX_PER_ACCT_HOUR || 10);
    await this.checkRateLimit(`login:acct:${user.id.toString()}:h1`, maxPerAcctHour, 3600);

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('此帳號目前無法登入');
    }

    return this.session(user.id, user.email ?? email);
  }

  async changePassword(userId: bigint, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('帳號不存在');
    if (!user.passwordHash || !(await bcrypt.compare(dto.oldPassword, user.passwordHash))) {
      throw new BadRequestException('舊密碼不正確');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_COST),
        passwordUpdatedAt: new Date(),
      },
    });
    return { success: true };
  }

  async getMe(userId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
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
      email: user.email,
      nickname: user.nickname,
      avatarUrl: resolveAvatarUrl(user.avatarUrl),
      points: user.pointsBalance.toString(),
      role: user.role,
      status: user.status,
      isPhoneVerified: user.isPhoneVerified,
    };
  }

  private async session(userId: bigint, email: string | null) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        pointsBalance: true,
        role: true,
        status: true,
        isPhoneVerified: true,
      },
    });
    const payload = { sub: user.id.toString(), email: user.email ?? email };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id.toString(),
        email: user.email,
        nickname: user.nickname,
        avatarUrl: resolveAvatarUrl(user.avatarUrl),
        points: user.pointsBalance.toString(),
        role: user.role,
        status: user.status,
        isPhoneVerified: user.isPhoneVerified,
      },
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
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

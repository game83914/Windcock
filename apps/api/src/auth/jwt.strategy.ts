import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { resolveJwtSecret } from './jwt-secret';

export interface JwtPayload {
  sub: string;
  phone?: string;
  email?: string;
  act?: string;
  typ?: 'dev-assumption';
  profile?: string;
  aud?: string;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // 與簽發端共用同一驗證，避免兩端 fallback 不一致
      secretOrKey: resolveJwtSecret(process.env),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(payload.sub) },
      select: {
        id: true,
        email: true,
        nickname: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('帳號不存在');
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('帳號目前無法使用此功能');
    }

    let actorUserId: bigint | undefined;
    if (payload.typ === 'dev-assumption') {
      if (process.env.NODE_ENV === 'production' || process.env.DEV_IDENTITY_SWITCHER_ENABLED === 'false' || payload.aud !== 'windcock-dev-assumption' || !payload.act || !payload.profile) {
        throw new UnauthorizedException('測試身份已停用');
      }
      actorUserId = BigInt(payload.act);
      const actor = await this.prisma.user.findUnique({ where: { id: actorUserId }, select: { phoneNumber: true, role: true, status: true } });
      const allowedPhone = process.env.DEV_IDENTITY_OPERATOR_PHONE || '0911111111';
      if (!actor || actor.phoneNumber !== allowedPhone || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE') {
        throw new UnauthorizedException('測試身份管理員已失效');
      }
    }

    return {
      userId: user.id,
      actorUserId,
      assumptionProfile: payload.profile,
      phone: payload.phone,
      email: payload.email ?? user.email,
      nickname: user.nickname,
      role: payload.typ === 'dev-assumption' ? 'USER' : user.role,
    };
  }
}

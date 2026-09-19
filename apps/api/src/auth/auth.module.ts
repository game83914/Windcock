import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { resolveJwtSecret } from './jwt-secret';
import { RedisModule } from '../redis/redis.module';
import { SmsService } from './sms.service';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // fail-closed：production 缺失／預設／過短密鑰會直接拒絕啟動
        secret: resolveJwtSecret(process.env),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') || '7d',
        },
      }),
    }),
    RedisModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, SmsService, OptionalJwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtModule, JwtStrategy, SmsService, OptionalJwtAuthGuard, RolesGuard],
})
export class AuthModule {}

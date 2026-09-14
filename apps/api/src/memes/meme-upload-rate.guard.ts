import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { AuthUser } from '../auth/current-user.decorator';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class MemeUploadRateGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser; ip?: string }>();
    if (!request.user) return false;
    const key = `meme:upload:${request.user.userId}:hour`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 3600);
    if (count > Number(process.env.GIF_MAX_UPLOADS_PER_HOUR || 5)) {
      throw new HttpException('每小時最多投稿 5 個 GIF', 429);
    }
    const ipKey = `meme:upload:ip:${request.ip || 'unknown'}:hour`;
    const ipCount = await this.redis.incr(ipKey);
    if (ipCount === 1) await this.redis.expire(ipKey, 3600);
    if (ipCount > Number(process.env.GIF_MAX_UPLOADS_PER_IP_HOUR || 20)) {
      throw new HttpException('此網路來源的 GIF 投稿次數已達上限', 429);
    }
    return true;
  }
}

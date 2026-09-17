import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { AuthUser } from '../auth/current-user.decorator';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class OptionImageUploadRateGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!request.user) return false;
    const key = `option-image:upload:${request.user.userId}:hour`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 3600);
    if (count > Number(process.env.OPTION_IMAGE_MAX_UPLOADS_PER_HOUR || 20)) {
      throw new HttpException('選項圖片上傳次數過多，請稍後再試', 429);
    }
    return true;
  }
}
import { HttpException, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthoringRateLimitService {
  private readonly userHourly = Number(process.env.AI_AUTHORING_MAX_GENERATIONS_PER_HOUR || 10);
  private readonly userDaily = Number(process.env.AI_AUTHORING_MAX_GENERATIONS_PER_DAY || 30);
  private readonly ipHourly = Number(process.env.AI_AUTHORING_MAX_GENERATIONS_PER_IP_HOUR || 30);

  constructor(private readonly redis: RedisService) {
    if (process.env.AI_AUTHORING_ENABLED === 'true' && [this.userHourly, this.userDaily, this.ipHourly].some((limit) => !Number.isInteger(limit) || limit < 1)) {
      throw new Error('AI authoring rate limit configuration is invalid');
    }
  }

  async consume(userId: bigint, ip: string) {
    const hour = Math.floor(Date.now() / 3600000);
    const day = Math.floor(Date.now() / 86400000);
    const limits: Array<[string, number, number]> = [
      [`authoring:rate:user:${userId}:hour:${hour}`, this.userHourly, 3700],
      [`authoring:rate:user:${userId}:day:${day}`, this.userDaily, 86500],
      [`authoring:rate:ip:${ip}:hour:${hour}`, this.ipHourly, 3700],
    ];
    for (const [key, limit, ttl] of limits) {
      const count = Number(await this.redis.raw.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
        1, key, ttl,
      ));
      if (count > limit) throw new HttpException('AI 輔助使用次數已達上限，請稍後再試', 429);
    }
  }
}

import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { AuthoringController } from './authoring.controller';
import { AuthoringRateLimitService } from './authoring-rate-limit.service';
import { AuthoringService } from './authoring.service';
import { OpenAiCompatibleClient } from './openai-compatible.client';
import { IdentityModule } from '../identity/identity.module';
import { CategoriesModule } from '../categories/categories.module';
import { TopicAccessModule } from '../topics/topic-access.module';

@Module({
  imports: [RedisModule, IdentityModule, CategoriesModule, TopicAccessModule],
  controllers: [AuthoringController],
  providers: [AuthoringService, AuthoringRateLimitService, OpenAiCompatibleClient],
})
export class AuthoringModule {}

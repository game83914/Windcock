import { Module } from '@nestjs/common';
import { TopicAccessService } from './topic-access.service';

@Module({
  providers: [TopicAccessService],
  exports: [TopicAccessService],
})
export class TopicAccessModule {}

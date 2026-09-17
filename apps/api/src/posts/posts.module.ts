import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { MemesModule } from '../memes/memes.module';
import { IdentityModule } from '../identity/identity.module';
import { TopicsModule } from '../topics/topics.module';

@Module({
  imports: [MemesModule, IdentityModule, TopicsModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}

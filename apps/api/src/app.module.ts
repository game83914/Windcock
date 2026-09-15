import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TopicsModule } from './topics/topics.module';
import { PostsModule } from './posts/posts.module';
import { RealtimeModule } from './realtime/realtime.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DemographicProfilesModule } from './profiles/demographic-profiles.module';
import { MemberCenterModule } from './member-center/member-center.module';
import { MemesModule } from './memes/memes.module';
import { AvatarsModule } from './avatars/avatars.module';
import { OptionImagesModule } from './option-images/option-images.module';
import { HealthController } from './health.controller';
import { AuthoringModule } from './authoring/authoring.module';
import { IdentityModule } from './identity/identity.module';
import { CategoriesModule } from './categories/categories.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    TopicsModule,
    PostsModule,
    RealtimeModule,
    NotificationsModule,
    DemographicProfilesModule,
    MemberCenterModule,
    MemesModule,
    AvatarsModule,
    OptionImagesModule,
    AuthoringModule,
    IdentityModule,
    CategoriesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

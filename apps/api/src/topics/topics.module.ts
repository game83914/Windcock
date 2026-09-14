import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TopicsService } from './topics.service';
import { TopicsController } from './topics.controller';
import { AdminTopicsController } from './admin-topics.controller';
import { MyTopicsController } from './my-topics.controller';
import { StancesController, AdminStancesController } from './stances.controller';
import { StancesService } from './stances.service';
import { DemographicProfilesModule } from '../profiles/demographic-profiles.module';
import { IdentityModule } from '../identity/identity.module';
import { EditorialTopicsController } from './editorial-topics.controller';
import { TopicAnalyticsService } from './topic-analytics.service';
import { AnalyticsController } from './analytics.controller';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [AuthModule, DemographicProfilesModule, IdentityModule, CategoriesModule],
  controllers: [TopicsController, MyTopicsController, AdminTopicsController, EditorialTopicsController, StancesController, AdminStancesController, AnalyticsController],
  providers: [TopicsService, StancesService, TopicAnalyticsService],
  exports: [TopicsService, TopicAnalyticsService],
})
export class TopicsModule {}

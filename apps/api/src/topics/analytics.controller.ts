import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { CompareTopicAnalyticsQuery } from './dto/topic-analytics.dto';
import { TopicAnalyticsService } from './topic-analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: TopicAnalyticsService) {}

  @Get('access')
  access(@CurrentUser() user: AuthUser) {
    return this.analytics.comparisonAccess(user.userId);
  }

  @Get('comparison')
  comparison(@CurrentUser() user: AuthUser, @Query() query: CompareTopicAnalyticsQuery) {
    const topicIds = query.topicIds.split(',').filter(Boolean).map((id) => BigInt(id));
    return this.analytics.comparison(user.userId, topicIds, query.dimension);
  }
}

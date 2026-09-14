import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { ParsedIdPipe } from '../common/parsed-id.pipe';
import { CapabilityGuard } from '../identity/capability.guard';
import { RequiresCapability } from '../identity/capability.decorator';
import { Capability } from '../identity/policy.service';
import { AdminTopicsQuery, RejectTopicDto } from './dto/topic.dto';
import { TopicsService } from './topics.service';

@ApiTags('admin-topics')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CapabilityGuard)
@RequiresCapability(Capability.ADMIN)
@Controller('admin/topics')
export class AdminTopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Get()
  list(@Query() query: AdminTopicsQuery) {
    return this.topicsService.listForModeration({
      moderationStatus: query.moderationStatus,
      category: query.category,
      page: query.page || 1,
      limit: query.limit || 20,
    });
  }

  @Post(':id/approve')
  approve(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user: AuthUser) {
    return this.topicsService.approve(id, user.userId);
  }

  @Post(':id/reject')
  reject(
    @Param('id', ParsedIdPipe) id: bigint,
    @CurrentUser() user: AuthUser,
    @Body() dto: RejectTopicDto,
  ) {
    return this.topicsService.reject(id, user.userId, dto.note);
  }
}

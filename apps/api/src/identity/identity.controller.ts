import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { PolicyService } from './policy.service';
import { ReviewTopicApplicationDto, SubmitTopicApplicationDto, TopicApplicationsQuery, UpdateTopicApplicationDto } from './dto/topic-application.dto';
import { TopicApplicationsService } from './topic-applications.service';
import { ParsedIdPipe } from '../common/parsed-id.pipe';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class IdentityController {
  constructor(private readonly policy: PolicyService, private readonly applications: TopicApplicationsService) {}

  @ApiTags('identity')
  @Get('me/capabilities')
  capabilities(@CurrentUser() user: AuthUser) {
    return this.policy.capabilities(user.userId);
  }

  @ApiTags('topic-applications')
  @Post('topic-applications')
  submit(@CurrentUser() user: AuthUser, @Body() dto: SubmitTopicApplicationDto) {
    return this.applications.submit(user.userId, dto);
  }

  @ApiTags('topic-applications')
  @Get('topic-applications/mine')
  listMine(@CurrentUser() user: AuthUser, @Query() query: TopicApplicationsQuery) {
    return this.applications.listMine(user.userId, query.page || 1, query.limit || 20);
  }

  @ApiTags('topic-applications')
  @Patch('topic-applications/:id')
  updateMine(@CurrentUser() user: AuthUser, @Param('id', ParsedIdPipe) id: bigint, @Body() dto: UpdateTopicApplicationDto) {
    return this.applications.updateMine(user.userId, id, dto);
  }

  @ApiTags('topic-applications')
  @Get('topic-applications/:id/revisions')
  revisions(@CurrentUser() user: AuthUser, @Param('id', ParsedIdPipe) id: bigint) {
    return this.applications.revisions(user.userId, id);
  }

  @ApiTags('editorial')
  @Get('editorial/topic-applications')
  list(@CurrentUser() user: AuthUser, @Query() query: TopicApplicationsQuery) {
    return this.applications.list(user.userId, {
      status: query.status,
      organizationId: query.organizationId ? BigInt(query.organizationId) : undefined,
      page: query.page || 1,
      limit: query.limit || 20,
    });
  }

  @ApiTags('editorial')
  @Patch('editorial/topic-applications/:id')
  review(
    @CurrentUser() user: AuthUser,
    @Param('id', ParsedIdPipe) id: bigint,
    @Body() dto: ReviewTopicApplicationDto,
  ) {
    return this.applications.review(user.userId, id, dto.status, dto.note);
  }
}

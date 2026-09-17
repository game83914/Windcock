import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ParsedIdPipe } from '../common/parsed-id.pipe';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CapabilityGuard } from '../identity/capability.guard';
import { RequiresCapability } from '../identity/capability.decorator';
import { Capability } from '../identity/policy.service';
import { TopicsService } from './topics.service';
import { CreateTopicDto, CreateQuickTopicDto, CreateSurveyDto, FeaturedCandidatesQuery, FeaturedTopicsDto, ListTopicsQuery } from './dto/topic.dto';
import { VoteDto } from './dto/vote.dto';
import { SaveRankDto } from './dto/rank.dto';
import { TopicAnalyticsService } from './topic-analytics.service';
import { TopicDemographicAnalyticsQuery } from './dto/topic-analytics.dto';
import { TopicAccessService } from './topic-access.service';
import { RedeemTopicShareDto } from './dto/topic-share.dto';

@ApiTags('topics')
@Controller('topics')
export class TopicsController {
  constructor(
    private readonly topicsService: TopicsService,
    private readonly analytics: TopicAnalyticsService,
    private readonly access: TopicAccessService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(@Query() query: ListTopicsQuery, @CurrentUser() user?: AuthUser) {
    return this.topicsService.list(user?.userId ?? null, {
      category: query.category,
      creatorId: query.creatorId ? BigInt(query.creatorId) : undefined,
      search: query.search,
      sort: query.sort,
      kind: query.kind,
      participation: query.participation,
      status: query.status,
      page: query.page || 1,
      limit: query.limit || 20,
    });
  }

  @Get('quick')
  @UseGuards(OptionalJwtAuthGuard)
  listQuick(@CurrentUser() user?: AuthUser) {
    return this.topicsService.listQuick(user?.userId ?? null);
  }

  @Get('me/quick')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  listQuickMine(@CurrentUser() user: AuthUser, @Query() query: ListTopicsQuery) {
    return this.topicsService.listQuickMine(user.userId, query.page || 1, query.limit || 20);
  }

  @Post('quick')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  createQuick(@CurrentUser() user: AuthUser, @Body() dto: CreateQuickTopicDto) {
    return this.topicsService.createQuick(user.userId, dto);
  }

  @Get('me/surveys')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  listSurveysMine(@CurrentUser() user: AuthUser, @Query() query: ListTopicsQuery) {
    return this.topicsService.listSurveysMine(user.userId, query.page || 1, query.limit || 20);
  }

  @Post('surveys')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  createSurvey(@CurrentUser() user: AuthUser, @Body() dto: CreateSurveyDto) {
    return this.topicsService.createSurvey(user.userId, dto);
  }

  @Get('following/mine')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  followedTopics(@CurrentUser() user: AuthUser, @Query() query: ListTopicsQuery) {
    return this.topicsService.list(user.userId, {
      search: query.search,
      sort: query.sort,
      participation: 'FOLLOWING',
      page: query.page || 1,
      limit: query.limit || 20,
    });
  }

  @Get('featured')
  @UseGuards(OptionalJwtAuthGuard)
  featured(@CurrentUser() user?: AuthUser) {
    return this.topicsService.featured(user?.userId ?? null);
  }

  @Post('share-links/redeem')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  redeemShareLink(@CurrentUser() user: AuthUser, @Body() dto: RedeemTopicShareDto) {
    return this.access.redeem(dto.token, user.userId);
  }

  @Get('featured/candidates')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), CapabilityGuard)
  @RequiresCapability(Capability.TOPIC_FEATURE)
  featureCandidates(@CurrentUser() user: AuthUser, @Query() query: FeaturedCandidatesQuery) {
    return this.topicsService.listForFeature(user.userId, { search: query.search, limit: query.limit || 100 });
  }

  @Put('featured')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), CapabilityGuard)
  @RequiresCapability(Capability.TOPIC_FEATURE)
  setFeatured(@CurrentUser() user: AuthUser, @Body() dto: FeaturedTopicsDto) {
    return this.topicsService.setFeatured(user.userId, dto.topicIds);
  }

  @Get(':id/analytics/access')
  @UseGuards(OptionalJwtAuthGuard)
  analyticsAccess(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user?: AuthUser) {
    return this.analytics.access(id, user?.userId ?? null);
  }

  @Get(':id/analytics/trends')
  @UseGuards(OptionalJwtAuthGuard)
  analyticsTrends(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user?: AuthUser) {
    return this.analytics.trends(id, user?.userId ?? null);
  }

  @Get(':id/analytics/demographics')
  @UseGuards(OptionalJwtAuthGuard)
  analyticsDemographics(@Param('id', ParsedIdPipe) id: bigint, @Query() query: TopicDemographicAnalyticsQuery, @CurrentUser() user?: AuthUser) {
    return this.analytics.demographics(id, user?.userId ?? null, query.dimension);
  }

  @Get(':id/analytics/stances')
  @UseGuards(OptionalJwtAuthGuard)
  analyticsStances(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user?: AuthUser) {
    return this.analytics.stanceInsights(id, user?.userId ?? null);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  detail(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user?: AuthUser) {
    return this.topicsService.detail(id, user?.userId ?? null);
  }

  @Get('me/:id/edit')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  detailMine(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user: AuthUser) {
    return this.topicsService.detailMine(id, user.userId);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTopicDto) {
    return this.topicsService.create(user.userId, dto);
  }

  @Post(':id/follow')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  follow(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user: AuthUser) {
    return this.topicsService.follow(id, user.userId);
  }

  @Delete(':id/follow')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  unfollow(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user: AuthUser) {
    return this.topicsService.unfollow(id, user.userId);
  }

  @Post(':id/share-link')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  rotateShareLink(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user: AuthUser) {
    return this.access.rotateShareLink(id, user.userId);
  }

  @Get(':id/share-link/status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  shareLinkStatus(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user: AuthUser) {
    return this.access.shareLinkStatus(id, user.userId);
  }

  @Delete(':id/share-link')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  disableShareLink(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user: AuthUser) {
    return this.access.disableShareLink(id, user.userId);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  updatePending(
    @Param('id', ParsedIdPipe) id: bigint,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTopicDto,
  ) {
    return this.topicsService.updatePending(id, user.userId, dto);
  }

  @Post(':id/vote')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  vote(
    @Param('id', ParsedIdPipe) id: bigint,
    @CurrentUser() user: AuthUser,
    @Body() dto: VoteDto,
  ) {
    return this.topicsService.vote(id, user.userId, dto);
  }

  @Patch(':id/vote')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  revote(
    @Param('id', ParsedIdPipe) id: bigint,
    @CurrentUser() user: AuthUser,
    @Body() dto: VoteDto,
  ) {
    return this.topicsService.revote(id, user.userId, dto);
  }

  @Post(':id/rank')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  saveRank(
    @Param('id', ParsedIdPipe) id: bigint,
    @CurrentUser() user: AuthUser,
    @Body() dto: SaveRankDto,
  ) {
    return this.topicsService.saveRank(id, user.userId, dto);
  }

  @Get(':id/rankings')
  @UseGuards(OptionalJwtAuthGuard)
  communityRanking(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user?: AuthUser) {
    return this.topicsService.communityRanking(id, user?.userId ?? null);
  }
}

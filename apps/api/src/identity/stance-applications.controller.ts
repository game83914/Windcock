import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { ParsedIdPipe } from '../common/parsed-id.pipe';
import { PublishStanceApplicationDto, ResolveStanceApplicationsDto, ReviewStanceApplicationDto, StanceApplicationsQuery, SubmitStanceApplicationDto, UpdateStanceApplicationDto } from './dto/stance-application.dto';
import { StanceApplicationsService } from './stance-applications.service';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class StanceApplicationsController {
  constructor(private readonly applications: StanceApplicationsService) {}

  @ApiTags('stance-applications')
  @Post('stance-applications')
  submit(@CurrentUser() user: AuthUser, @Body() dto: SubmitStanceApplicationDto) { return this.applications.submit(user.userId, dto); }

  @ApiTags('stance-applications')
  @Get('stance-applications/mine')
  mine(@CurrentUser() user: AuthUser, @Query() query: StanceApplicationsQuery) { return this.applications.listMine(user.userId, query.page || 1, query.limit || 20); }

  @ApiTags('stance-applications')
  @Get('topics/:topicId/stance-applications/mine')
  mineForTopic(@CurrentUser() user: AuthUser, @Param('topicId', ParsedIdPipe) topicId: bigint) { return this.applications.listMineForTopic(user.userId, topicId); }

  @ApiTags('stance-applications')
  @Patch('stance-applications/:id')
  updateMine(@CurrentUser() user: AuthUser, @Param('id', ParsedIdPipe) id: bigint, @Body() dto: UpdateStanceApplicationDto) { return this.applications.updateMine(user.userId, id, dto); }

  @ApiTags('stance-applications')
  @Delete('stance-applications/:id')
  withdrawMine(@CurrentUser() user: AuthUser, @Param('id', ParsedIdPipe) id: bigint) { return this.applications.withdrawMine(user.userId, id); }

  @ApiTags('stance-applications')
  @Get('stance-applications/:id/revisions')
  revisions(@CurrentUser() user: AuthUser, @Param('id', ParsedIdPipe) id: bigint) { return this.applications.revisions(user.userId, id); }

  @ApiTags('editorial')
  @Get('editorial/stance-applications')
  list(@CurrentUser() user: AuthUser, @Query() query: StanceApplicationsQuery) {
    return this.applications.list(user.userId, { status: query.status, topicId: query.topicId ? BigInt(query.topicId) : undefined, page: query.page || 1, limit: query.limit || 20 });
  }

  @ApiTags('editorial')
  @Patch('editorial/stance-applications/:id')
  review(@CurrentUser() user: AuthUser, @Param('id', ParsedIdPipe) id: bigint, @Body() dto: ReviewStanceApplicationDto) { return this.applications.review(user.userId, id, dto); }

  @ApiTags('editorial')
  @Post('editorial/stance-applications/:id/publish')
  publish(@CurrentUser() user: AuthUser, @Param('id', ParsedIdPipe) id: bigint, @Body() dto: PublishStanceApplicationDto) { return this.applications.publish(user.userId, id, dto); }

  @ApiTags('editorial')
  @Post('editorial/stance-resolutions')
  resolve(@CurrentUser() user: AuthUser, @Body() dto: ResolveStanceApplicationsDto) { return this.applications.resolve(user.userId, dto); }
}

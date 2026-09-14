import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ParsedIdPipe } from '../common/parsed-id.pipe';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CapabilityGuard } from '../identity/capability.guard';
import { RequiresCapability } from '../identity/capability.decorator';
import { Capability } from '../identity/policy.service';
import { ReportStanceDto, SignalStanceDto, TakedownStanceDto } from './dto/stances.dto';
import { StancesService } from './stances.service';

@ApiTags('topics')
@Controller('topics')
export class StancesController {
  constructor(private readonly stancesService: StancesService) {}

  @Get(':id/stances')
  @UseGuards(OptionalJwtAuthGuard)
  list(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user?: AuthUser) {
    return this.stancesService.list(id, user?.userId ?? null);
  }

  @Delete(':id/stances/:stanceId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  remove(
    @Param('id', ParsedIdPipe) id: bigint,
    @Param('stanceId', ParsedIdPipe) stanceId: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.stancesService.remove(id, stanceId, user.userId);
  }

  @Post(':id/stances/:stanceId/signal')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  toggleSignal(
    @Param('id', ParsedIdPipe) id: bigint,
    @Param('stanceId', ParsedIdPipe) stanceId: bigint,
    @CurrentUser() user: AuthUser,
    @Body() dto: SignalStanceDto,
  ) {
    return this.stancesService.toggleSignal(id, stanceId, user.userId, dto.signal);
  }

  @Post(':id/stances/:stanceId/report')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  report(
    @Param('id', ParsedIdPipe) id: bigint,
    @Param('stanceId', ParsedIdPipe) stanceId: bigint,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReportStanceDto,
  ) {
    return this.stancesService.report(id, stanceId, user.userId, dto);
  }
}

@ApiTags('admin-stances')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CapabilityGuard)
@RequiresCapability(Capability.ADMIN)
@Controller('admin/stances')
export class AdminStancesController {
  constructor(private readonly stancesService: StancesService) {}

  @Get('reports')
  listReports(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.stancesService.listReports(Number(page) || 1, Number(limit) || 20);
  }

  @Post(':stanceId/takedown')
  takedown(
    @Param('stanceId', ParsedIdPipe) stanceId: bigint,
    @CurrentUser() user: AuthUser,
    @Body() dto: TakedownStanceDto,
  ) {
    return this.stancesService.takedown(stanceId, user.userId, dto.reason);
  }

  @Post(':stanceId/restore')
  restore(@Param('stanceId', ParsedIdPipe) stanceId: bigint) {
    return this.stancesService.restore(stanceId);
  }
}

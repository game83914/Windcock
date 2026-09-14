import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { AuthoringService } from './authoring.service';
import { CreateAuthoringSessionDto, GenerateAuthoringDraftsDto, GenerateStanceDraftsDto } from './dto/authoring.dto';

@ApiTags('authoring')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('authoring')
export class AuthoringController {
  constructor(private readonly authoring: AuthoringService) {}

  @Post('sessions')
  createSession(@CurrentUser() user: AuthUser, @Body() dto: CreateAuthoringSessionDto, @Req() request: Request) {
    return this.authoring.createSession(user.userId, dto, request.ip || 'unknown');
  }

  @Post('sessions/:sessionId/drafts')
  generateDrafts(@Param('sessionId') sessionId: string, @CurrentUser() user: AuthUser, @Body() dto: GenerateAuthoringDraftsDto, @Req() request: Request) {
    return this.authoring.generateDrafts(sessionId, user.userId, dto, request.ip || 'unknown');
  }

  @Post('stance-drafts')
  generateStanceDrafts(@CurrentUser() user: AuthUser, @Body() dto: GenerateStanceDraftsDto, @Req() request: Request) {
    return this.authoring.generateStanceDrafts(user.userId, dto, request.ip || 'unknown');
  }
}

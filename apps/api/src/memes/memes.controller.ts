import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ParsedIdPipe } from '../common/parsed-id.pipe';
import { Capability, PolicyService } from '../identity/policy.service';
import { ListMemesQuery, MyMemesQuery, ReportMemeDto, UploadMemeDto } from './dto/memes.dto';
import { memeUploadOptions } from './meme-upload.options';
import { MemesService } from './memes.service';
import { MemeUploadRateGuard } from './meme-upload-rate.guard';

@ApiTags('memes')
@Controller()
export class MemesController {
  constructor(private readonly memes: MemesService, private readonly policy: PolicyService) {}

  @Get('memes')
  @UseGuards(OptionalJwtAuthGuard)
  list(@Query() query: ListMemesQuery, @CurrentUser() user?: AuthUser) {
    return this.memes.list(user?.userId ?? null, query);
  }

  @Get('memes/:id/preview')
  @Header('Content-Type', 'image/webp')
  @Header('Cache-Control', 'public, no-cache')
  @Header('X-Content-Type-Options', 'nosniff')
  async preview(@Param('id', ParsedIdPipe) id: bigint, @Res() response: Response) {
    (await this.memes.rendition(id, 'preview')).pipe(response);
  }

  @Get('memes/:id/poster')
  @Header('Content-Type', 'image/webp')
  @Header('Cache-Control', 'public, no-cache')
  @Header('X-Content-Type-Options', 'nosniff')
  async poster(@Param('id', ParsedIdPipe) id: bigint, @Res() response: Response) {
    (await this.memes.rendition(id, 'poster')).pipe(response);
  }

  @Get('memes/:id/review-preview')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Header('Content-Type', 'image/webp')
  @Header('Cache-Control', 'private, no-store')
  async reviewPreview(
    @Param('id', ParsedIdPipe) id: bigint,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const canModerate = await this.policy.can(user.userId, Capability.ADMIN);
    (await this.memes.reviewRendition(id, user.userId, canModerate, 'preview')).pipe(response);
  }

  @Get('memes/:id/review-poster')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Header('Content-Type', 'image/webp')
  @Header('Cache-Control', 'private, no-store')
  async reviewPoster(
    @Param('id', ParsedIdPipe) id: bigint,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ) {
    const canModerate = await this.policy.can(user.userId, Capability.ADMIN);
    (await this.memes.reviewRendition(id, user.userId, canModerate, 'poster')).pipe(response);
  }

  @Get('memes/:id')
  @UseGuards(OptionalJwtAuthGuard)
  detail(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user?: AuthUser) {
    return this.memes.detail(id, user?.userId ?? null);
  }

  @Post('memes/upload')
  @UseGuards(AuthGuard('jwt'), MemeUploadRateGuard)
  @UseInterceptors(FileInterceptor('file', memeUploadOptions))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadMemeDto,
  ) {
    return this.memes.upload(user.userId, file, dto, 'USER');
  }

  @Post('memes/:id/collection')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  collect(
    @Param('id', ParsedIdPipe) id: bigint,
    @CurrentUser() user: AuthUser,
  ) {
    return this.memes.collect(id, user.userId);
  }

  @Delete('memes/:id/collection')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  uncollect(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user: AuthUser) {
    return this.memes.uncollect(id, user.userId);
  }

  @Post('memes/:id/report')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  report(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user: AuthUser, @Body() dto: ReportMemeDto) {
    return this.memes.report(id, user.userId, dto);
  }

  @Get('me/memes')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  mine(@CurrentUser() user: AuthUser, @Query() query: MyMemesQuery) {
    return this.memes.listMine(user.userId, query);
  }
}

import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { CapabilityGuard } from '../identity/capability.guard';
import { RequiresCapability } from '../identity/capability.decorator';
import { Capability } from '../identity/policy.service';
import { ParsedIdPipe } from '../common/parsed-id.pipe';
import { AdminMemesQuery, AdminUploadMemeDto, ReviewMemeDto, TakedownMemeDto } from './dto/memes.dto';
import { memeUploadOptions } from './meme-upload.options';
import { MemesService } from './memes.service';

@ApiTags('admin-memes')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), CapabilityGuard)
@RequiresCapability(Capability.ADMIN)
@Controller('admin/memes')
export class AdminMemesController {
  constructor(private readonly memes: MemesService) {}

  @Get()
  list(@Query() query: AdminMemesQuery) {
    return this.memes.listForModeration(query);
  }

  @Post('upload')
  @RequiresCapability(Capability.ADMIN)
  @UseInterceptors(FileInterceptor('file', memeUploadOptions))
  @ApiConsumes('multipart/form-data')
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: AdminUploadMemeDto,
  ) {
    return this.memes.upload(user.userId, file, { ...dto, rightsAttested: true }, 'OFFICIAL');
  }

  @Post(':id/approve')
  approve(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user: AuthUser) {
    return this.memes.approve(id, user.userId);
  }

  @Post(':id/reject')
  reject(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user: AuthUser, @Body() dto: ReviewMemeDto) {
    return this.memes.reject(id, user.userId, dto.note);
  }

  @Post(':id/takedown')
  takedown(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user: AuthUser, @Body() dto: TakedownMemeDto) {
    return this.memes.takedown(id, user.userId, dto.reason);
  }
}

import { BadRequestException, Controller, Get, Header, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { OptionImageStorageService } from './option-image-storage.service';
import { OptionImageUploadRateGuard } from './option-image-upload-rate.guard';
import { optionImageUploadOptions } from './option-image-upload.options';

@ApiTags('option-images')
@Controller('option-images')
export class OptionImagesController {
  constructor(private readonly storage: OptionImageStorageService) {}

  @Post('upload')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), OptionImageUploadRateGuard)
  @UseInterceptors(FileInterceptor('file', optionImageUploadOptions))
  async upload(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('請選擇選項圖片');
    const key = await this.storage.processUpload(file.path);
    return { imageUrl: `/api/v1/option-images/${key}` };
  }

  @Get(':key')
  @Header('Content-Type', 'image/webp')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  async uploaded(@Param('key') key: string, @Res() response: Response) {
    (await this.storage.stream(key)).pipe(response);
  }
}
import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { avatarPresetSvg } from './avatar-presets';
import { AvatarStorageService } from './avatar-storage.service';
import { NotFoundException } from '@nestjs/common';

@ApiTags('avatars')
@Controller('avatars')
export class AvatarsController {
  constructor(private readonly storage: AvatarStorageService) {}

  @Get('presets/:id')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  preset(@Param('id') id: string, @Res() response: Response) {
    const svg = avatarPresetSvg(id);
    if (!svg) throw new NotFoundException('預設頭像不存在');
    response.send(svg);
  }

  @Get(':key')
  @Header('Content-Type', 'image/webp')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  async uploaded(@Param('key') key: string, @Res() response: Response) {
    (await this.storage.stream(key)).pipe(response);
  }
}

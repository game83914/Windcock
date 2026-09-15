import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { access, mkdir, rename, rm } from 'fs/promises';
import { join, resolve } from 'path';
import sharp from 'sharp';
import { MemeStorageService } from '../memes/meme-storage.service';

@Injectable()
export class OptionImageStorageService implements OnModuleInit {
  private processingQueue: Promise<void> = Promise.resolve();

  static quarantineDirectory() {
    const root = resolve(process.env.MEDIA_ROOT || resolve(process.cwd(), '../../.local/media'));
    return join(root, 'quarantine', 'option-images');
  }

  private get optionImagesDirectory() {
    return join(MemeStorageService.rootDirectory(), 'option-images');
  }

  async onModuleInit() {
    await Promise.all([
      mkdir(OptionImageStorageService.quarantineDirectory(), { recursive: true, mode: 0o700 }),
      mkdir(this.optionImagesDirectory, { recursive: true, mode: 0o700 }),
    ]);
  }

  processUpload(path: string) {
    const task = this.processingQueue.then(() => this.processFile(path));
    this.processingQueue = task.then(() => undefined, () => undefined);
    return task;
  }

  private async processFile(path: string) {
    const key = randomUUID();
    const temporary = join(OptionImageStorageService.quarantineDirectory(), `${key}.webp`);
    const final = join(this.optionImagesDirectory, `${key}.webp`);
    try {
      const image = sharp(path, { failOn: 'warning', limitInputPixels: Number(process.env.OPTION_IMAGE_MAX_PIXELS || 16_777_216) });
      const metadata = await image.metadata();
      if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) {
        throw new BadRequestException('選項圖片只接受靜態 PNG、JPEG 或 WebP 圖片');
      }
      const width = metadata.width || 0;
      const height = metadata.height || 0;
      const maxWidth = Number(process.env.OPTION_IMAGE_MAX_WIDTH || 1024);
      const maxHeight = Number(process.env.OPTION_IMAGE_MAX_HEIGHT || 1024);
      if (!width || !height || width > maxWidth || height > maxHeight || width * height > Number(process.env.OPTION_IMAGE_MAX_PIXELS || 16_777_216)) {
        throw new BadRequestException('選項圖片尺寸過大');
      }
      await image.rotate().resize(512, 512, { fit: 'cover' }).webp({ quality: 82 }).toFile(temporary);
      await rename(temporary, final);
      return key;
    } finally {
      await rm(path, { force: true }).catch(() => undefined);
      await rm(temporary, { force: true }).catch(() => undefined);
    }
  }

  async stream(key: string) {
    if (!/^[0-9a-f-]{36}$/.test(key)) throw new BadRequestException('選項圖片識別碼無效');
    const path = join(this.optionImagesDirectory, `${key}.webp`);
    await access(path).catch(() => { throw new BadRequestException('選項圖片不存在'); });
    return createReadStream(path);
  }
}
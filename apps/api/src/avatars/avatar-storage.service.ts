import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { access, mkdir, rename, rm } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { MemeStorageService } from '../memes/meme-storage.service';

@Injectable()
export class AvatarStorageService implements OnModuleInit {
  private processingQueue: Promise<void> = Promise.resolve();

  static quarantineDirectory() {
    return join(MemeStorageService.rootDirectory(), 'quarantine', 'avatars');
  }

  private get avatarsDirectory() {
    return join(MemeStorageService.rootDirectory(), 'avatars');
  }

  async onModuleInit() {
    await Promise.all([
      mkdir(AvatarStorageService.quarantineDirectory(), { recursive: true, mode: 0o700 }),
      mkdir(this.avatarsDirectory, { recursive: true, mode: 0o700 }),
    ]);
  }

  processUpload(path: string) {
    const task = this.processingQueue.then(() => this.processFile(path));
    this.processingQueue = task.then(() => undefined, () => undefined);
    return task;
  }

  private async processFile(path: string) {
    const key = randomUUID();
    const temporary = join(AvatarStorageService.quarantineDirectory(), `${key}.webp`);
    const final = join(this.avatarsDirectory, `${key}.webp`);
    try {
      const image = sharp(path, { failOn: 'warning', limitInputPixels: Number(process.env.AVATAR_MAX_PIXELS || 16_777_216) });
      const metadata = await image.metadata();
      if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) {
        throw new BadRequestException('頭像只接受靜態 PNG、JPEG 或 WebP 圖片');
      }
      const width = metadata.width || 0;
      const height = metadata.height || 0;
      const maxWidth = Number(process.env.AVATAR_MAX_WIDTH || 4096);
      const maxHeight = Number(process.env.AVATAR_MAX_HEIGHT || 4096);
      if (!width || !height || width > maxWidth || height > maxHeight || width * height > Number(process.env.AVATAR_MAX_PIXELS || 16_777_216)) {
        throw new BadRequestException('頭像尺寸過大');
      }
      await image.rotate().resize(256, 256, { fit: 'cover' }).webp({ quality: 82 }).toFile(temporary);
      await rename(temporary, final);
      return key;
    } finally {
      await rm(path, { force: true }).catch(() => undefined);
      await rm(temporary, { force: true }).catch(() => undefined);
    }
  }

  async stream(key: string) {
    if (!/^[0-9a-f-]{36}$/.test(key)) throw new BadRequestException('頭像識別碼無效');
    const path = join(this.avatarsDirectory, `${key}.webp`);
    await access(path).catch(() => { throw new BadRequestException('頭像不存在'); });
    return createReadStream(path);
  }

  async removeReference(reference: string | null | undefined) {
    if (!reference?.startsWith('upload:')) return;
    const key = reference.slice(7);
    if (/^[0-9a-f-]{36}$/.test(key)) await rm(join(this.avatarsDirectory, `${key}.webp`), { force: true });
  }
}

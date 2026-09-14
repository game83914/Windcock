import { BadRequestException, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import type { Dirent } from 'fs';
import { access, mkdir, readFile, readdir, rename, rm, stat } from 'fs/promises';
import { resolve, join } from 'path';
import sharp from 'sharp';
import { isGifSignature } from './meme-rules';
import { PrismaService } from '../prisma/prisma.service';

export interface ProcessedMemeFile {
  storageKey: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  frameCount: number;
  durationMs: number;
  sha256: string;
}

@Injectable()
export class MemeStorageService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer?: NodeJS.Timeout;
  private processingQueue: Promise<void> = Promise.resolve();

  constructor(private readonly prisma: PrismaService) {}
  static rootDirectory() {
    return resolve(process.env.MEDIA_ROOT || resolve(process.cwd(), '../../.local/media'));
  }

  static quarantineDirectory() {
    return join(this.rootDirectory(), 'quarantine');
  }

  private get originalsDirectory() {
    return join(MemeStorageService.rootDirectory(), 'originals');
  }

  private get renditionsDirectory() {
    return join(MemeStorageService.rootDirectory(), 'renditions');
  }

  async onModuleInit() {
    await Promise.all([
      mkdir(MemeStorageService.quarantineDirectory(), { recursive: true, mode: 0o700 }),
      mkdir(this.originalsDirectory, { recursive: true, mode: 0o700 }),
      mkdir(this.renditionsDirectory, { recursive: true, mode: 0o700 }),
    ]);
    await this.cleanupQuarantine();
    await this.cleanupFinalOrphans();
    this.cleanupTimer = setInterval(() => {
      void this.cleanupQuarantine();
      void this.cleanupFinalOrphans();
    }, 60 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  processUpload(uploadPath: string): Promise<ProcessedMemeFile> {
    const task = this.processingQueue.then(() => this.processUploadFile(uploadPath));
    this.processingQueue = task.then(() => undefined, () => undefined);
    return task;
  }

  private async processUploadFile(uploadPath: string): Promise<ProcessedMemeFile> {
    const maxBytes = Number(process.env.GIF_MAX_UPLOAD_BYTES || 10 * 1024 * 1024);
    const maxWidth = Number(process.env.GIF_MAX_WIDTH || 4096);
    const maxHeight = Number(process.env.GIF_MAX_HEIGHT || 4096);
    const maxFrames = Number(process.env.GIF_MAX_FRAMES || 200);
    const maxDuration = Number(process.env.GIF_MAX_DURATION_MS || 30000);
    const maxTotalPixels = Number(process.env.GIF_MAX_TOTAL_PIXELS || 100_000_000);

    let storageKey: string | null = null;
    try {
      const fileStat = await stat(uploadPath);
      if (!fileStat.isFile() || fileStat.size <= 0 || fileStat.size > maxBytes) {
        throw new BadRequestException('GIF 檔案大小不符合限制');
      }
      const file = await readFile(uploadPath);
      if (!isGifSignature(file)) {
        throw new BadRequestException('檔案不是有效的 GIF');
      }

      const image = sharp(uploadPath, {
        animated: true,
        failOn: 'warning',
        limitInputPixels: maxWidth * maxHeight,
      });
      const metadata = await image.metadata();
      const width = metadata.width || 0;
      const frameCount = metadata.pages || 1;
      const height = metadata.pageHeight || metadata.height || 0;
      const delays = Array.isArray(metadata.delay) ? metadata.delay : [];
      const durationMs = delays.reduce((total, delay) => total + delay, 0);

      if (metadata.format !== 'gif' || frameCount < 2) throw new BadRequestException('請上傳具有動畫的 GIF');
      if (!width || !height || width > maxWidth || height > maxHeight) {
        throw new BadRequestException(`GIF 尺寸不可超過 ${maxWidth} × ${maxHeight}`);
      }
      if (frameCount > maxFrames) throw new BadRequestException(`GIF 不可超過 ${maxFrames} 幀`);
      if (durationMs > maxDuration) throw new BadRequestException(`GIF 長度不可超過 ${maxDuration / 1000} 秒`);
      if (width * height * frameCount > maxTotalPixels) throw new BadRequestException('GIF 解碼後影像量過大');

      storageKey = randomUUID();
      const tempDirectory = join(MemeStorageService.quarantineDirectory(), storageKey);
      const finalDirectory = join(this.renditionsDirectory, storageKey);
      await mkdir(tempDirectory, { recursive: true, mode: 0o700 });

      const outputWidth = Math.min(width, 400);
      const outputHeight = Math.max(1, Math.round(height * outputWidth / width));
      const watermark = Buffer.from(
        `<svg width="${outputWidth}" height="${outputHeight}"><rect x="${Math.max(0, outputWidth - 92)}" y="${Math.max(0, outputHeight - 24)}" width="92" height="24" fill="#171717" fill-opacity=".72"/><text x="${Math.max(6, outputWidth - 86)}" y="${Math.max(16, outputHeight - 7)}" font-size="11" font-family="sans-serif" font-weight="700" fill="white">輿論測風向</text></svg>`,
      );

      await sharp(uploadPath, { animated: true, limitInputPixels: maxWidth * maxHeight })
        .resize({ width: outputWidth, withoutEnlargement: true })
        .composite([{ input: watermark, gravity: 'southeast' }])
        .webp({ quality: 78, effort: 4, loop: 0 })
        .toFile(join(tempDirectory, 'preview.webp'));
      await sharp(uploadPath, { page: 0, limitInputPixels: maxWidth * maxHeight })
        .resize({ width: outputWidth, withoutEnlargement: true })
        .composite([{ input: watermark, gravity: 'southeast' }])
        .webp({ quality: 82 })
        .toFile(join(tempDirectory, 'poster.webp'));

      const generated = await sharp(join(tempDirectory, 'preview.webp'), { animated: true }).metadata();
      if (generated.format !== 'webp' || (generated.pages || 1) < 2) {
        throw new BadRequestException('GIF 動畫轉檔失敗');
      }

      await mkdir(finalDirectory, { recursive: true, mode: 0o700 });
      await rename(join(tempDirectory, 'preview.webp'), join(finalDirectory, 'preview.webp'));
      await rename(join(tempDirectory, 'poster.webp'), join(finalDirectory, 'poster.webp'));
      await rename(uploadPath, join(this.originalsDirectory, `${storageKey}.gif`));
      await rm(tempDirectory, { recursive: true, force: true });

      return {
        storageKey,
        mimeType: 'image/gif',
        byteSize: fileStat.size,
        width,
        height,
        frameCount,
        durationMs,
        sha256: createHash('sha256').update(file).digest('hex'),
      };
    } catch (error) {
      await rm(uploadPath, { force: true }).catch(() => undefined);
      if (storageKey) {
        await Promise.all([
          rm(join(MemeStorageService.quarantineDirectory(), storageKey), { recursive: true, force: true }),
          this.remove(storageKey),
        ]).catch(() => undefined);
      }
      throw error;
    }
  }

  async rendition(storageKey: string, kind: 'preview' | 'poster') {
    if (!/^[0-9a-f-]{36}$/.test(storageKey)) throw new BadRequestException('素材儲存鍵無效');
    const path = join(this.renditionsDirectory, storageKey, `${kind}.webp`);
    await access(path).catch(() => { throw new BadRequestException('GIF 預覽檔案不存在'); });
    return createReadStream(path);
  }

  async remove(storageKey: string) {
    if (!/^[0-9a-f-]{36}$/.test(storageKey)) return;
    await Promise.all([
      rm(join(this.originalsDirectory, `${storageKey}.gif`), { force: true }),
      rm(join(this.renditionsDirectory, storageKey), { recursive: true, force: true }),
    ]);
  }

  async discard(path: string) {
    await rm(path, { force: true });
  }

  private async cleanupQuarantine() {
    const directory = MemeStorageService.quarantineDirectory();
    const cutoff = Date.now() - Number(process.env.MEDIA_QUARANTINE_TTL_MINUTES || 60) * 60 * 1000;
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    await Promise.all(entries.map(async (entry) => {
      if (entry.isSymbolicLink()) return;
      const path = join(directory, entry.name);
      const details = await stat(path).catch(() => null);
      if (details && details.mtimeMs < cutoff) await rm(path, { recursive: true, force: true });
    }));
  }

  private async cleanupFinalOrphans() {
    const cutoff = Date.now() - Number(process.env.MEDIA_ORPHAN_GRACE_MINUTES || 60) * 60 * 1000;
    const entries: Dirent[] = await readdir(this.originalsDirectory, { withFileTypes: true }).catch(() => []);
    const keys = entries
      .filter((entry) => entry.isFile() && /^[0-9a-f-]{36}\.gif$/.test(entry.name))
      .map((entry) => entry.name.slice(0, -4));
    if (!keys.length) return;
    const rows = await this.prisma.meme.findMany({ where: { storageKey: { in: keys } }, select: { storageKey: true } });
    const referenced = new Set(rows.map((row) => row.storageKey));
    await Promise.all(keys.map(async (key) => {
      if (referenced.has(key)) return;
      const path = join(this.originalsDirectory, `${key}.gif`);
      const details = await stat(path).catch(() => null);
      if (details && details.mtimeMs < cutoff) await this.remove(key);
    }));
  }
}

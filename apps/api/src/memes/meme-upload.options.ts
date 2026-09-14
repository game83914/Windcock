import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { MemeStorageService } from './meme-storage.service';

export const memeUploadOptions = {
  storage: diskStorage({
    destination: (_request: unknown, _file: unknown, callback: (error: Error | null, destination: string) => void) => {
      const destination = MemeStorageService.quarantineDirectory();
      mkdirSync(destination, { recursive: true, mode: 0o700 });
      callback(null, destination);
    },
    filename: (_request: unknown, _file: unknown, callback: (error: Error | null, filename: string) => void) => {
      callback(null, `${randomUUID()}.upload`);
    },
  }),
  limits: {
    fileSize: Number(process.env.GIF_MAX_UPLOAD_BYTES || 10 * 1024 * 1024),
    files: 1,
    fields: 6,
    fieldSize: 8192,
  },
};

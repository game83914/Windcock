import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { OptionImageStorageService } from './option-image-storage.service';

export const optionImageUploadOptions = {
  storage: diskStorage({
    destination: (_request: unknown, _file: unknown, callback: (error: Error | null, destination: string) => void) => {
      const destination = OptionImageStorageService.quarantineDirectory();
      mkdirSync(destination, { recursive: true, mode: 0o700 });
      callback(null, destination);
    },
    filename: (_request: unknown, _file: unknown, callback: (error: Error | null, filename: string) => void) => callback(null, `${randomUUID()}.upload`),
  }),
  limits: { fileSize: Number(process.env.OPTION_IMAGE_MAX_UPLOAD_BYTES || 5 * 1024 * 1024), files: 1, fields: 0 },
};
import { Module } from '@nestjs/common';
import { OptionImageStorageService } from './option-image-storage.service';
import { OptionImageUploadRateGuard } from './option-image-upload-rate.guard';
import { OptionImagesController } from './option-images.controller';

@Module({
  controllers: [OptionImagesController],
  providers: [OptionImageStorageService, OptionImageUploadRateGuard],
  exports: [OptionImageStorageService],
})
export class OptionImagesModule {}
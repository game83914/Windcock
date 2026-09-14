import { Module } from '@nestjs/common';
import { AvatarsController } from './avatars.controller';
import { AvatarStorageService } from './avatar-storage.service';
import { AvatarUploadRateGuard } from './avatar-upload-rate.guard';

@Module({ controllers: [AvatarsController], providers: [AvatarStorageService, AvatarUploadRateGuard], exports: [AvatarStorageService, AvatarUploadRateGuard] })
export class AvatarsModule {}

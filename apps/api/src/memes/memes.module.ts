import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminMemesController } from './admin-memes.controller';
import { MemeStorageService } from './meme-storage.service';
import { MemesController } from './memes.controller';
import { MemesService } from './memes.service';
import { MemeUploadRateGuard } from './meme-upload-rate.guard';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [AuthModule, IdentityModule],
  controllers: [MemesController, AdminMemesController],
  providers: [MemesService, MemeStorageService, MemeUploadRateGuard],
  exports: [MemesService],
})
export class MemesModule {}

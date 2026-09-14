import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DemographicCryptoService } from './demographic-crypto.service';
import { DemographicProfilesController } from './demographic-profiles.controller';
import { DemographicProfilesService } from './demographic-profiles.service';

@Module({
  imports: [AuthModule],
  controllers: [DemographicProfilesController],
  providers: [DemographicCryptoService, DemographicProfilesService],
  exports: [DemographicCryptoService, DemographicProfilesService],
})
export class DemographicProfilesModule {}

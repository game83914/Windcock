import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IdentityController } from './identity.controller';
import { PolicyService } from './policy.service';
import { TopicApplicationsService } from './topic-applications.service';
import { CapabilityGuard } from './capability.guard';
import { DevIdentityController } from './dev-identity.controller';
import { DevIdentityService } from './dev-identity.service';
import { StanceApplicationsController } from './stance-applications.controller';
import { StanceApplicationsService } from './stance-applications.service';
import { TopicAccessModule } from '../topics/topic-access.module';

@Module({
  imports: [AuthModule, TopicAccessModule],
  controllers: [IdentityController, DevIdentityController, StanceApplicationsController],
  providers: [PolicyService, TopicApplicationsService, StanceApplicationsService, CapabilityGuard, DevIdentityService],
  exports: [PolicyService, TopicApplicationsService, StanceApplicationsService, CapabilityGuard],
})
export class IdentityModule {}

import { Module } from '@nestjs/common';
import { MemberCenterController } from './member-center.controller';
import { MemberCenterService } from './member-center.service';
import { AvatarsModule } from '../avatars/avatars.module';

@Module({ imports: [AvatarsModule], controllers: [MemberCenterController], providers: [MemberCenterService] })
export class MemberCenterModule {}

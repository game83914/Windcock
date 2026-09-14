import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsIn } from 'class-validator';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { DevIdentityService } from './dev-identity.service';

class AssumeIdentityDto {
  @IsIn(['new-member', 'senior-member', 'partner-owner', 'topic-team'])
  profileKey: string;
}

@ApiTags('development')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('dev/identities')
export class DevIdentityController {
  constructor(private readonly identities: DevIdentityService) {}

  @Get()
  profiles(@CurrentUser() user: AuthUser) { return this.identities.profiles(user); }

  @Post('assume')
  assume(@CurrentUser() user: AuthUser, @Body() dto: AssumeIdentityDto) { return this.identities.assume(user, dto.profileKey); }

  @Post('release')
  release(@CurrentUser() user: AuthUser) { return this.identities.release(user); }
}

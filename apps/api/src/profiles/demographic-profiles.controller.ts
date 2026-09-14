import { Body, Controller, Delete, Get, Put, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { DemographicProfilesService } from './demographic-profiles.service';
import { GuardianOtpDto, UpdateDemographicProfileDto, VerifyGuardianOtpDto } from './dto/demographic-profile.dto';

@ApiTags('demographic-profile')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('me/demographic-profile')
export class DemographicProfilesController {
  constructor(private readonly profiles: DemographicProfilesService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.profiles.get(user.userId);
  }

  @Get('options')
  options() {
    return this.profiles.options();
  }

  @Put()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateDemographicProfileDto) {
    return this.profiles.update(user.userId, dto);
  }

  @Delete()
  remove(@CurrentUser() user: AuthUser) {
    return this.profiles.remove(user.userId);
  }

  @Post('guardian/send')
  sendGuardianOtp(@CurrentUser() user: AuthUser, @Body() dto: GuardianOtpDto) {
    return this.profiles.sendGuardianOtp(user.userId, dto);
  }

  @Post('guardian/verify')
  verifyGuardianOtp(@CurrentUser() user: AuthUser, @Body() dto: VerifyGuardianOtpDto) {
    return this.profiles.verifyGuardianOtp(user.userId, dto);
  }
}

import { Body, Controller, Delete, Get, Put, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { UpdateAccountDto, VoteHistoryQuery, SelectAvatarPresetDto } from './dto/member-center.dto';
import { MemberCenterService } from './member-center.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes } from '@nestjs/swagger';
import { avatarUploadOptions } from '../avatars/avatar-upload.options';
import { AvatarUploadRateGuard } from '../avatars/avatar-upload-rate.guard';

@ApiTags('member-center')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('me')
export class MemberCenterController {
  constructor(private readonly memberCenter: MemberCenterService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.memberCenter.dashboard(user.userId);
  }

  @Get('votes')
  votes(@CurrentUser() user: AuthUser, @Query() query: VoteHistoryQuery) {
    return this.memberCenter.votes(user.userId, query);
  }

  @Get('points')
  points(@CurrentUser() user: AuthUser) {
    return this.memberCenter.points(user.userId);
  }

  @Put('account')
  updateAccount(@CurrentUser() user: AuthUser, @Body() dto: UpdateAccountDto) {
    return this.memberCenter.updateAccount(user.userId, dto);
  }

  @Post('avatar')
  @UseGuards(AvatarUploadRateGuard)
  @UseInterceptors(FileInterceptor('file', avatarUploadOptions))
  @ApiConsumes('multipart/form-data')
  uploadAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.memberCenter.uploadAvatar(user.userId, file);
  }

  @Put('avatar')
  selectAvatar(@CurrentUser() user: AuthUser, @Body() dto: SelectAvatarPresetDto) {
    return this.memberCenter.selectAvatar(user.userId, dto.preset);
  }

  @Delete('avatar')
  removeAvatar(@CurrentUser() user: AuthUser) {
    return this.memberCenter.removeAvatar(user.userId);
  }
}

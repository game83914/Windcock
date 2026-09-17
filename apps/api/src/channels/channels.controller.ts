import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ParsedIdPipe } from '../common/parsed-id.pipe';
import { UpdateChannelBioDto } from './dto/update-channel-bio.dto';
import { ListChannelConnectionsDto } from './dto/list-channel-connections.dto';
import { ChannelsService } from './channels.service';

@ApiTags('channels')
@Controller()
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get('users/:id/channel')
  @UseGuards(OptionalJwtAuthGuard)
  channel(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user?: AuthUser) {
    return this.channels.channelPage(id, user?.userId ?? null);
  }

  @Post('users/:id/follow')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  follow(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user: AuthUser) {
    return this.channels.follow(user.userId, id);
  }

  @Delete('users/:id/follow')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  unfollow(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user: AuthUser) {
    return this.channels.unfollow(user.userId, id);
  }

  @Get('me/channel')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  myChannel(@CurrentUser() user: AuthUser) {
    return this.channels.myChannel(user.userId);
  }

  @Patch('me/channel/bio')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  updateBio(@CurrentUser() user: AuthUser, @Body() dto: UpdateChannelBioDto) {
    return this.channels.updateBio(user.userId, dto.bio ?? '');
  }

  @Get('users/:id/followers')
  followers(@Param('id', ParsedIdPipe) id: bigint, @Query() query: ListChannelConnectionsDto) {
    return this.channels.followers(id, query.page ?? 1, query.limit ?? 20);
  }

  @Get('users/:id/following')
  following(@Param('id', ParsedIdPipe) id: bigint, @Query() query: ListChannelConnectionsDto) {
    return this.channels.followingIds(id, query.page ?? 1, query.limit ?? 20);
  }
}

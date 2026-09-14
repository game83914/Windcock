import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { ListTopicsQuery } from './dto/topic.dto';
import { TopicsService } from './topics.service';

@ApiTags('my-topics')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('me/topics')
export class MyTopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListTopicsQuery) {
    return this.topicsService.listMine(user.userId, query.page || 1, query.limit || 20);
  }
}

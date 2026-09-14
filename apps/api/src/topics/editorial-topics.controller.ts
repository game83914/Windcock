import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { ParsedIdPipe } from '../common/parsed-id.pipe';
import { EditorialTopicDto } from './dto/editorial-topic.dto';
import { ImportTopicDto } from './dto/import-topic.dto';
import { TopicsService } from './topics.service';

@ApiTags('editorial')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('editorial/topics')
export class EditorialTopicsController {
  constructor(private readonly topics: TopicsService) {}

  @Post('import')
  importTopic(@CurrentUser() user: AuthUser, @Body() dto: ImportTopicDto) {
    return this.topics.importEditorial(user.userId, dto);
  }

  @Post()
  createMain(@CurrentUser() user: AuthUser, @Body() dto: EditorialTopicDto) {
    return this.topics.createEditorial(user.userId, dto, {
      publish: dto.publish,
      applicationIds: dto.applicationIds?.map((id) => BigInt(id)),
    });
  }

  @Post(':id/publish')
  publish(@CurrentUser() user: AuthUser, @Param('id', ParsedIdPipe) id: bigint) {
    return this.topics.publishEditorial(id, user.userId);
  }
}

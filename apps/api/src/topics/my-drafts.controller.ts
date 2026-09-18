import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { ParsedIdPipe } from '../common/parsed-id.pipe';
import { CreateDraftDto, ListDraftsQuery, UpdateDraftDto } from './dto/draft.dto';
import { DraftsService } from './drafts.service';

@ApiTags('my-drafts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('me/drafts')
export class MyDraftsController {
  constructor(private readonly draftsService: DraftsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListDraftsQuery) {
    return this.draftsService.list(user.userId, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDraftDto) {
    return this.draftsService.create(user.userId, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParsedIdPipe) id: bigint,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDraftDto,
  ) {
    return this.draftsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user: AuthUser) {
    return this.draftsService.remove(user.userId, id);
  }
}

import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ParsedIdPipe } from '../common/parsed-id.pipe';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { PostsService } from './posts.service';
import { CreateCommentDto, CreatePostDto, LikeDto, PaginationQuery } from './dto/posts.dto';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

@ApiTags('posts')
@Controller()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get('topics/:id/posts')
  @UseGuards(OptionalJwtAuthGuard)
  listPosts(@Param('id', ParsedIdPipe) id: bigint, @Query() q: PaginationQuery, @CurrentUser() user?: AuthUser) {
    const stanceId = q.stanceId && /^\d+$/.test(q.stanceId) ? BigInt(q.stanceId) : null;
    return this.postsService.listPosts(id, stanceId, q.page || 1, q.limit || 20, user?.userId ?? null);
  }

  @Get('posts/:id/comments')
  @UseGuards(OptionalJwtAuthGuard)
  listComments(@Param('id', ParsedIdPipe) id: bigint, @Query() q: PaginationQuery, @CurrentUser() user?: AuthUser) {
    return this.postsService.listComments(id, q.page || 1, q.limit || 50, user?.userId ?? null);
  }

  @Get('posts/activity/recent-comments')
  recentCommentActivity() {
    return this.postsService.recentCommentActivity();
  }

  @Post('topics/:id/posts')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  createPost(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    return this.postsService.createPost(id, user.userId, dto);
  }

  @Post('posts/:id/comments')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  createComment(@Param('id', ParsedIdPipe) id: bigint, @CurrentUser() user: AuthUser, @Body() dto: CreateCommentDto) {
    return this.postsService.createComment(id, user.userId, dto);
  }

  @Post('likes')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  toggleLike(@CurrentUser() user: AuthUser, @Body() dto: LikeDto) {
    return this.postsService.toggleLike(user.userId, dto.targetType, BigInt(dto.targetId));
  }
}

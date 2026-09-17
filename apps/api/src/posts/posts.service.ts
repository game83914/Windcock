import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto, CreateCommentDto } from './dto/posts.dto';
import { MemesService } from '../memes/memes.service';
import { resolveAvatarUrl } from '../avatars/avatar-url';
import { assertClean } from '../common/sensitive';
import { PolicyService } from '../identity/policy.service';
import { RealtimeService } from '../realtime/realtime.service';
import { TopicAccessService } from '../topics/topic-access.service';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memes: MemesService,
    private readonly policy: PolicyService,
    private readonly realtime: RealtimeService,
    private readonly access: TopicAccessService,
  ) {}

  async listPosts(topicId: bigint, stanceId: bigint | null, page: number, limit: number, userId: bigint | null) {
    await this.assertCanViewTopic(topicId, userId);
    const p = Math.max(1, page);
    const l = Math.min(50, Math.max(1, limit));
    const where = stanceId ? { topicId, stanceId } : { topicId };
    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * l,
        take: l,
        include: {
          author: { select: { nickname: true, avatarUrl: true } },
          _count: { select: { comments: true } },
          memeAttachments: {
            orderBy: { sortOrder: 'asc' },
            include: { meme: { include: { creator: { select: { nickname: true, avatarUrl: true } } } } },
          },
        },
      }),
      this.prisma.post.count({ where }),
    ]);
    return {
      items: items.map((post) => ({
        id: post.id.toString(),
        topicId: post.topicId.toString(),
        stanceId: post.stanceId.toString(),
        author: post.author.nickname,
        authorAvatarUrl: resolveAvatarUrl(post.author.avatarUrl),
        content: post.content,
        likeCount: post.likeCount.toString(),
        commentCount: post._count.comments.toString(),
        createdAt: post.createdAt,
        attachments: post.memeAttachments.map((item) => this.memes.serializeEmbedded(item.meme)),
      })),
      pagination: { page: p, limit: l, total },
    };
  }

  async listComments(postId: bigint, page: number, limit: number, userId: bigint | null) {
    const p = Math.max(1, page);
    const l = Math.min(100, Math.max(1, limit));
    const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { id: true, topicId: true } });
    if (!post) throw new NotFoundException('貼文不存在');
    await this.assertCanViewTopic(post.topicId, userId);
    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { postId },
        orderBy: { createdAt: 'asc' },
        skip: (p - 1) * l,
        take: l,
        include: {
          author: { select: { nickname: true, avatarUrl: true } },
          memeAttachments: {
            orderBy: { sortOrder: 'asc' },
            include: { meme: { include: { creator: { select: { nickname: true, avatarUrl: true } } } } },
          },
        },
      }),
      this.prisma.comment.count({ where: { postId } }),
    ]);
    return {
      items: items.map((c) => ({
        id: c.id.toString(),
        postId: c.postId.toString(),
        author: c.author.nickname,
        authorAvatarUrl: resolveAvatarUrl(c.author.avatarUrl),
        content: c.content,
        likeCount: 0,
        createdAt: c.createdAt,
        attachments: c.memeAttachments.map((item) => this.memes.serializeEmbedded(item.meme)),
      })),
      pagination: { page: p, limit: l, total },
    };
  }

  async recentCommentActivity() {
    const comments = await this.prisma.comment.findMany({
      where: { post: { topic: { moderationStatus: 'APPROVED', visibility: 'PUBLIC', audience: 'MEMBER_ONLY' } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { nickname: true } },
        post: { select: { topic: { select: { id: true, title: true } } } },
      },
    });
    return comments.map((comment) => ({
      id: comment.id.toString(),
      topicId: comment.post.topic.id.toString(),
      topicTitle: comment.post.topic.title,
      author: comment.author.nickname,
      content: comment.content || '（GIF）',
      createdAt: comment.createdAt.toISOString(),
    }));
  }

  async createPost(topicId: bigint, authorId: bigint, dto: CreatePostDto) {
    await this.policy.assertPublicAction(authorId, 'DISCUSS');
    await this.assertCanInteractTopic(topicId, authorId);
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId }, select: { id: true, status: true, moderationStatus: true } });
    if (!topic) throw new NotFoundException('議題不存在');
    if (topic.status !== 'OPEN' || topic.moderationStatus !== 'APPROVED') throw new BadRequestException('此議題目前不開放討論');
    const content = dto.content?.trim() || '';
    const memeIds = dto.memeIds || [];
    if (!content && !memeIds.length) throw new BadRequestException('請輸入文字或選擇 GIF');
    assertClean(content);
    const stance = await this.prisma.topicStance.findFirst({
      where: { id: BigInt(dto.stanceId), topicId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!stance) throw new NotFoundException('立場節點不存在或已下架');
    const post = await this.prisma.$transaction(async (tx) => {
      const ids = await this.memes.assertCanUse(authorId, memeIds, tx);
      const created = await tx.post.create({
        data: {
          topicId,
          stanceId: stance.id,
          authorId,
          content,
          memeAttachments: ids.length
            ? { create: ids.map((memeId, sortOrder) => ({ memeId, sortOrder })) }
            : undefined,
        },
        include: {
          author: { select: { nickname: true, avatarUrl: true } },
          memeAttachments: {
            orderBy: { sortOrder: 'asc' },
            include: { meme: { include: { creator: { select: { nickname: true, avatarUrl: true } } } } },
          },
        },
      });
      await this.memes.recordUsage(tx, authorId, 'POST', created.id, ids);
      await tx.topic.update({ where: { id: topicId }, data: { updatedAt: new Date() } });
      return created;
    });
    return {
      id: post.id.toString(),
      topicId: post.topicId.toString(),
      stanceId: post.stanceId.toString(),
      author: post.author.nickname,
      authorAvatarUrl: resolveAvatarUrl(post.author.avatarUrl),
      content: post.content,
      likeCount: '0',
      commentCount: '0',
      createdAt: post.createdAt,
      attachments: post.memeAttachments.map((item) => this.memes.serializeEmbedded(item.meme)),
    };
  }

  async createComment(postId: bigint, authorId: bigint, dto: CreateCommentDto) {
    await this.policy.assertPublicAction(authorId, 'DISCUSS');
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, topic: { select: { id: true, title: true, status: true, moderationStatus: true, visibility: true, audience: true } } },
    });
    if (!post) throw new NotFoundException('貼文不存在');
    await this.assertCanInteractTopic(post.topic.id, authorId);
    if (post.topic.status !== 'OPEN' || post.topic.moderationStatus !== 'APPROVED') throw new BadRequestException('此議題目前不開放留言');
    const content = dto.content?.trim() || '';
    const memeIds = dto.memeIds || [];
    if (!content && !memeIds.length) throw new BadRequestException('請輸入文字或選擇 GIF');
    assertClean(content);
    const comment = await this.prisma.$transaction(async (tx) => {
      const ids = await this.memes.assertCanUse(authorId, memeIds, tx);
      const created = await tx.comment.create({
        data: {
          postId,
          authorId,
          content,
          memeAttachments: ids.length
            ? { create: ids.map((memeId, sortOrder) => ({ memeId, sortOrder })) }
            : undefined,
        },
        include: {
          author: { select: { nickname: true, avatarUrl: true } },
          memeAttachments: {
            orderBy: { sortOrder: 'asc' },
            include: { meme: { include: { creator: { select: { nickname: true, avatarUrl: true } } } } },
          },
        },
      });
      await this.memes.recordUsage(tx, authorId, 'COMMENT', created.id, ids);
      await tx.topic.update({ where: { id: post.topic.id }, data: { updatedAt: new Date() } });
      return created;
    });
    if (post.topic.visibility === 'PUBLIC' && post.topic.audience === 'MEMBER_ONLY') {
      this.realtime.broadcastCommentActivity({
        id: comment.id.toString(),
        topicId: post.topic.id.toString(),
        topicTitle: post.topic.title,
        author: comment.author.nickname,
        content: content || '（GIF）',
        createdAt: comment.createdAt.toISOString(),
      });
    }
    return {
      id: comment.id.toString(),
      postId: comment.postId.toString(),
      author: comment.author.nickname,
      authorAvatarUrl: resolveAvatarUrl(comment.author.avatarUrl),
      content: comment.content,
      createdAt: comment.createdAt,
      attachments: comment.memeAttachments.map((item) => this.memes.serializeEmbedded(item.meme)),
    };
  }

  async toggleLike(userId: bigint, targetType: 'post' | 'comment', targetId: bigint) {
    await this.policy.assertPublicAction(userId, 'DISCUSS');
    const target = targetType === 'post'
      ? await this.prisma.post.findUnique({ where: { id: targetId }, select: { topicId: true } })
      : await this.prisma.comment.findUnique({ where: { id: targetId }, select: { post: { select: { topicId: true } } } });
    const topicId = targetType === 'post' ? (target as any)?.topicId : (target as any)?.post.topicId;
    if (!topicId) throw new NotFoundException(targetType === 'post' ? '貼文不存在' : '留言不存在');
    await this.assertCanInteractTopic(topicId, userId);
    const existing = await this.prisma.like.findUnique({
      where: { userId_targetType_targetId: { userId, targetType, targetId } },
    });

    if (targetType === 'post') {
      await this.ensureExists(this.prisma.post, targetId, '貼文');
    } else {
      await this.ensureExists(this.prisma.comment, targetId, '留言');
    }

    if (existing) {
      await this.prisma.like.delete({ where: { id: existing.id } });
      if (targetType === 'post') {
        await this.prisma.post.update({ where: { id: targetId }, data: { likeCount: { decrement: 1 } } });
      }
      return { liked: false };
    }

    await this.prisma.like.create({ data: { userId, targetType, targetId } });
    if (targetType === 'post') {
      await this.prisma.post.update({ where: { id: targetId }, data: { likeCount: { increment: 1 } } });
    }
    return { liked: true };
  }

  private async ensureExists(model: any, id: bigint, name: string) {
    const found = await model.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException(`${name}不存在`);
  }

  private async assertCanViewTopic(topicId: bigint, userId: bigint | null) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId }, select: { id: true, kind: true, visibility: true, audience: true, audienceOwnerId: true } });
    if (!topic) throw new NotFoundException('議題不存在');
    await this.access.assertCanView(topic, userId);
  }

  private async assertCanInteractTopic(topicId: bigint, userId: bigint) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId }, select: { id: true, kind: true, visibility: true, audience: true, audienceOwnerId: true } });
    if (!topic) throw new NotFoundException('議題不存在');
    await this.access.assertCanInteract(topic, userId);
  }
}

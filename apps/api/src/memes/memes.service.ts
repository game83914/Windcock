import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemeOrigin, MemeStatus, MemeUsageRewardStatus, MemeUsageTargetType, Prisma } from '@prisma/client';
import { Express } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminMemesQuery,
  ListMemesQuery,
  MyMemesQuery,
  ReportMemeDto,
  UploadMemeDto,
} from './dto/memes.dto';
import { MemeStorageService } from './meme-storage.service';
import { resolveAvatarUrl } from '../avatars/avatar-url';
import { PolicyService } from '../identity/policy.service';

const memeInclude = {
  creator: { select: { nickname: true, avatarUrl: true } },
} satisfies Prisma.MemeInclude;

@Injectable()
export class MemesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MemeStorageService,
    private readonly policy: PolicyService,
  ) {}

  async list(userId: bigint | null, query: ListMemesQuery) {
    const where: Prisma.MemeWhereInput = {
      status: 'APPROVED',
      ...(query.search ? { title: { contains: query.search.trim(), mode: 'insensitive' } } : {}),
    };
    const orderBy: Prisma.MemeOrderByWithRelationInput = query.sort === 'POPULAR'
      ? { usageCount: 'desc' }
        : { createdAt: 'desc' };
    const [items, total] = await Promise.all([
      this.prisma.meme.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          ...memeInclude,
          collections: userId
            ? { where: { userId }, select: { id: true }, take: 1 }
            : false,
        },
      }),
      this.prisma.meme.count({ where }),
    ]);
    return {
      items: items.map((item) => this.serialize(item, userId)),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async detail(id: bigint, userId: bigint | null) {
    const meme = await this.prisma.meme.findFirst({
      where: { id, status: 'APPROVED' },
      include: {
        ...memeInclude,
        collections: userId ? { where: { userId }, select: { id: true }, take: 1 } : false,
      },
    });
    if (!meme) throw new NotFoundException('GIF 不存在或尚未公開');
    return this.serialize(meme, userId);
  }

  async listMine(userId: bigint, query: MyMemesQuery) {
    const where: Prisma.MemeWhereInput = query.scope === 'created'
      ? { creatorId: userId }
      : { status: 'APPROVED', collections: { some: { userId } } };
    const [items, total] = await Promise.all([
      this.prisma.meme.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          ...memeInclude,
          collections: { where: { userId }, select: { id: true }, take: 1 },
        },
      }),
      this.prisma.meme.count({ where }),
    ]);
    return {
      items: items.map((item) => this.serialize(item, userId, true)),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async listForModeration(query: AdminMemesQuery) {
    const where: Prisma.MemeWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { title: { contains: query.search.trim(), mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.meme.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          ...memeInclude,
          reports: {
            where: { status: 'OPEN' },
            orderBy: { createdAt: 'desc' },
            include: { reporter: { select: { nickname: true } } },
          },
        },
      }),
      this.prisma.meme.count({ where }),
    ]);
    return {
      items: items.map((item) => this.serialize(item, null, true)),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async upload(userId: bigint, file: Express.Multer.File | undefined, dto: UploadMemeDto, origin: MemeOrigin) {
    if (!file) throw new BadRequestException('請選擇 GIF 檔案');

    const processed = await this.storage.processUpload(file.path);
    try {
      const meme = await this.prisma.meme.create({
        data: {
          creatorId: userId,
          title: dto.title.trim(),
          origin,
          ...processed,
          rightsAttestedAt: new Date(),
          status: origin === 'OFFICIAL' ? 'APPROVED' : 'PENDING_REVIEW',
          reviewedById: origin === 'OFFICIAL' ? userId : null,
          reviewedAt: origin === 'OFFICIAL' ? new Date() : null,
        },
        include: memeInclude,
      });
      return this.serialize(meme, userId, true);
    } catch (error) {
      await this.storage.remove(processed.storageKey);
      throw error;
    }
  }

  async collect(id: bigint, userId: bigint) {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: bigint }>>`SELECT id FROM memes WHERE id = ${id} FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('GIF 不存在或已下架');
      const meme = await tx.meme.findUnique({ where: { id }, select: { status: true } });
      if (!meme || meme.status !== 'APPROVED') throw new NotFoundException('GIF 不存在或已下架');
      const created = await tx.memeCollection.createMany({ data: [{ userId, memeId: id }], skipDuplicates: true });
      if (created.count) await tx.meme.update({ where: { id }, data: { collectionCount: { increment: 1 } } });
    });
    return { meme: await this.detail(id, userId) };
  }

  async uncollect(id: bigint, userId: bigint) {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: bigint }>>`SELECT id FROM memes WHERE id = ${id} FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('GIF 不存在');
      const removed = await tx.memeCollection.deleteMany({ where: { userId, memeId: id } });
      if (removed.count) await tx.meme.update({ where: { id }, data: { collectionCount: { decrement: 1 } } });
    });
    return { meme: await this.detail(id, userId) };
  }

  async approve(id: bigint, reviewerId: bigint) {
    const updated = await this.prisma.meme.updateMany({
      where: { id, status: 'PENDING_REVIEW' },
      data: { status: 'APPROVED', reviewedById: reviewerId, reviewedAt: new Date(), moderationNote: null },
    });
    if (!updated.count) throw new BadRequestException('GIF 不存在或已完成複核');
    return this.adminDetail(id);
  }

  async reject(id: bigint, reviewerId: bigint, note: string) {
    const updated = await this.prisma.meme.updateMany({
      where: { id, status: 'PENDING_REVIEW' },
      data: { status: 'REJECTED', reviewedById: reviewerId, reviewedAt: new Date(), moderationNote: note.trim() },
    });
    if (!updated.count) throw new BadRequestException('GIF 不存在或已完成複核');
    return this.adminDetail(id);
  }

  async takedown(id: bigint, adminId: bigint, reason: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM memes WHERE id = ${id} FOR UPDATE`;
      const meme = await tx.meme.findUnique({ where: { id } });
      if (!meme) throw new NotFoundException('GIF 不存在');
      if (meme.status === 'TAKEN_DOWN') return;
      if (meme.status !== 'APPROVED') throw new BadRequestException('只有已核准 GIF 可以下架');
      await tx.memeCollection.deleteMany({ where: { memeId: id } });
      await tx.meme.update({
        where: { id },
        data: {
          status: 'TAKEN_DOWN',
          takenDownById: adminId,
          takenDownAt: new Date(),
          takedownReason: reason.trim(),
          collectionCount: 0,
        },
      });
      await tx.memeReport.updateMany({ where: { memeId: id, status: 'OPEN' }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.adminDetail(id);
  }

  async report(id: bigint, reporterId: bigint, dto: ReportMemeDto) {
    await this.policy.assertPublicAction(reporterId, 'REPORT');
    const meme = await this.prisma.meme.findFirst({ where: { id, status: 'APPROVED' }, select: { id: true, creatorId: true } });
    if (!meme) throw new NotFoundException('GIF 不存在或已下架');
    if (meme.creatorId === reporterId) throw new BadRequestException('不能檢舉自己的 GIF');
    try {
      await this.prisma.memeReport.create({
        data: { memeId: id, reporterId, reason: dto.reason, detail: dto.detail?.trim() || null },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('你已檢舉過此 GIF');
      }
      throw error;
    }
    return { success: true };
  }

  async assertCanUse(userId: bigint, memeIds: string[], tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    const uniqueIds = [...new Set(memeIds)];
    if (!uniqueIds.length) return [];
    if (uniqueIds.some((id) => !/^\d+$/.test(id))) throw new BadRequestException('GIF ID 格式不正確');
    const ids = uniqueIds.map(BigInt);
    const memes = await tx.meme.findMany({
      where: {
        id: { in: ids },
        status: 'APPROVED',
      },
      select: { id: true },
    });
    if (memes.length !== ids.length) throw new ForbiddenException('包含未核准或已下架的 GIF');
    return ids;
  }

  async recordUsage(
    tx: Prisma.TransactionClient,
    actorUserId: bigint,
    targetType: MemeUsageTargetType,
    targetId: bigint,
    memeIds: bigint[],
  ) {
    const ids = [...new Set(memeIds.map(String))].map(BigInt);
    if (!ids.length) return;
    const memes = await tx.meme.findMany({
      where: { id: { in: ids }, status: 'APPROVED' },
      select: { id: true, title: true, creatorId: true, origin: true },
      orderBy: { id: 'asc' },
    });
    if (memes.length !== ids.length) throw new ConflictException('使用的 GIF 已無法使用');
    const userIds = [...new Set([actorUserId, ...memes.map((meme) => meme.creatorId)].map(String))].map(BigInt).sort(compareBigInt);
    await tx.$queryRaw`SELECT id FROM users WHERE id IN (${Prisma.join(userIds)}) ORDER BY id FOR UPDATE`;
    const rewardDate = taipeiRewardDate();
    const actorLimit = Number(process.env.MEME_USAGE_ACTOR_DAILY_LIMIT || 10);
    const creatorLimit = Number(process.env.MEME_USAGE_CREATOR_DAILY_LIMIT || 50);

    for (const meme of memes) {
      let rewardStatus: MemeUsageRewardStatus = 'REWARDED';
      if (meme.origin === 'OFFICIAL') rewardStatus = 'OFFICIAL';
      else if (meme.creatorId === actorUserId) rewardStatus = 'SELF_USE';
      else if (await tx.memeUsageEvent.findFirst({ where: { actorUserId, memeId: meme.id, rewardDate, rewardStatus: 'REWARDED' }, select: { id: true } })) rewardStatus = 'DUPLICATE_DAILY_USE';
      else if (await tx.memeUsageEvent.count({ where: { actorUserId, rewardDate, rewardStatus: 'REWARDED' } }) >= actorLimit) rewardStatus = 'ACTOR_DAILY_LIMIT';
      else if (await tx.memeUsageEvent.count({ where: { creatorId: meme.creatorId, rewardDate, rewardStatus: 'REWARDED' } }) >= creatorLimit) rewardStatus = 'CREATOR_DAILY_LIMIT';

      const event = await tx.memeUsageEvent.create({
        data: { memeId: meme.id, actorUserId, creatorId: meme.creatorId, targetType, targetId, rewardDate, rewardStatus, rewardPoints: rewardStatus === 'REWARDED' ? 1 : 0 },
      });
      await tx.meme.update({ where: { id: meme.id }, data: { usageCount: { increment: 1 }, rewardedUseCount: rewardStatus === 'REWARDED' ? { increment: 1 } : undefined } });
      if (rewardStatus !== 'REWARDED') continue;
      const creator = await tx.user.findUniqueOrThrow({ where: { id: meme.creatorId }, select: { pointsBalance: true } });
      const after = creator.pointsBalance + BigInt(1);
      const transaction = await tx.pointTransaction.create({
        data: { userId: meme.creatorId, amount: 1, balanceBefore: creator.pointsBalance, balanceAfter: after, txType: 'MEME_USAGE_REWARD', referenceType: 'MEME_USAGE', referenceId: event.id.toString(), idempotencyKey: `MEME_USAGE_${event.id}`, note: `GIF 被使用：${meme.title}` },
      });
      await tx.memeUsageEvent.update({ where: { id: event.id }, data: { pointTransactionId: transaction.id } });
      await tx.user.update({ where: { id: meme.creatorId }, data: { pointsBalance: after } });
    }
  }

  serializeEmbedded(meme: any) {
    return this.serialize(meme, null);
  }

  rendition(id: bigint, kind: 'preview' | 'poster') {
    return this.prisma.meme.findFirst({ where: { id, status: 'APPROVED' }, select: { storageKey: true } })
      .then((meme) => {
        if (!meme) throw new NotFoundException('GIF 不存在或已下架');
        return this.storage.rendition(meme.storageKey, kind);
      });
  }

  async reviewRendition(id: bigint, userId: bigint, canModerate: boolean, kind: 'preview' | 'poster') {
    const meme = await this.prisma.meme.findUnique({ where: { id }, select: { creatorId: true, storageKey: true } });
    if (!meme) throw new NotFoundException('GIF 不存在');
    if (!canModerate && meme.creatorId !== userId) throw new ForbiddenException('沒有權限預覽此 GIF');
    return this.storage.rendition(meme.storageKey, kind);
  }

  private async adminDetail(id: bigint) {
    const meme = await this.prisma.meme.findUnique({ where: { id }, include: memeInclude });
    if (!meme) throw new NotFoundException('GIF 不存在');
    return this.serialize(meme, null, true);
  }

  private serialize(meme: any, userId: bigint | null, privileged = false) {
    const approved = meme.status === 'APPROVED';
    const creatorOwned = userId !== null && meme.creatorId === userId;
    const collected = Array.isArray(meme.collections) && meme.collections.length > 0;
    const base = (process.env.MEDIA_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3001}/api/v1`).replace(/\/$/, '');
    return {
      id: meme.id.toString(),
      title: meme.title,
      origin: meme.origin,
      status: meme.status,
      collectionCount: meme.collectionCount.toString(),
      usageCount: meme.usageCount.toString(),
      rewardedUseCount: meme.rewardedUseCount.toString(),
      creator: meme.origin === 'OFFICIAL'
        ? { nickname: '編輯部', avatarUrl: null }
        : { nickname: meme.creator.nickname, avatarUrl: resolveAvatarUrl(meme.creator.avatarUrl) },
      width: meme.width,
      height: meme.height,
      frameCount: meme.frameCount,
      durationMs: meme.durationMs,
      createdAt: meme.createdAt,
      collected,
      isCreator: creatorOwned,
      usable: approved,
      previewUrl: approved ? `${base}/memes/${meme.id}/preview` : null,
      posterUrl: approved ? `${base}/memes/${meme.id}/poster` : null,
      reviewPreviewUrl: privileged ? `${base}/memes/${meme.id}/review-preview` : null,
      reviewPosterUrl: privileged ? `${base}/memes/${meme.id}/review-poster` : null,
      moderationNote: privileged ? meme.moderationNote : null,
      takedownReason: privileged ? meme.takedownReason : null,
      reports: privileged && Array.isArray(meme.reports)
        ? meme.reports.map((report: any) => ({
            id: report.id.toString(),
            reason: report.reason,
            detail: report.detail,
            reporter: report.reporter.nickname,
            createdAt: report.createdAt,
          }))
        : [],
    };
  }

}

function compareBigInt(a: bigint, b: bigint) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function taipeiRewardDate() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return new Date(`${values.get('year')}-${values.get('month')}-${values.get('day')}T00:00:00.000Z`);
}

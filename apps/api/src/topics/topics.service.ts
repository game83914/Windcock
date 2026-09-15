import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TopicKind, TopicModerationStatus, TopicType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateTopicDto, CreateQuickTopicDto, MAX_FEATURED_TOPICS } from './dto/topic.dto';
import { ImportTopicDto, ImportTopicStanceDto } from './dto/import-topic.dto';
import { VoteDto } from './dto/vote.dto';
import { DemographicCryptoService, deriveDemographics } from '../profiles/demographic-crypto.service';
import { DEMOGRAPHIC_CONSENT_VERSION } from '../profiles/demographic-profiles.service';
import { resolveAvatarUrl } from '../avatars/avatar-url';
import { Capability, PolicyScope, PolicyService } from '../identity/policy.service';
import { CategoriesService } from '../categories/categories.service';
import { assertClean } from '../common/sensitive';

export interface VoteResult {
  success: boolean;
  optionId: string | null;
  spectrumValue: number | null;
  rewardPoints: number;
  newBalance: string;
}

@Injectable()
export class TopicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly redis: RedisService,
    private readonly demographicCrypto: DemographicCryptoService,
    private readonly policy: PolicyService,
    private readonly categories: CategoriesService,
  ) {}

  list(userId: bigint | null, query: {
    category?: string;
    search?: string;
    sort?: 'POPULAR' | 'NEWEST' | 'ENDING_SOON' | 'ACTIVITY';
    kind?: 'FORMAL' | 'QUICK' | 'ALL';
    participation?: 'ALL' | 'VOTED' | 'UNVOTED' | 'FOLLOWING';
    page: number;
    limit: number;
  }) {
    const page = Math.max(1, query.page);
    const limit = Math.min(50, Math.max(1, query.limit));
    const participation = query.participation || 'ALL';
    if (participation !== 'ALL' && !userId) throw new ForbiddenException('請先登入再篩選會員議題');
    const kind = query.kind || 'FORMAL';
    const where: Prisma.TopicWhereInput = {
      status: 'OPEN',
      moderationStatus: 'APPROVED',
      voteEndAt: { gt: new Date() },
    };
    if (kind !== 'ALL') where.kind = kind === 'QUICK' ? TopicKind.QUICK : TopicKind.FORMAL;
    if (query.category) where.category = query.category;
    const search = query.search?.trim();
    if (search) where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
    if (participation === 'VOTED') where.votes = { some: { userId: userId! } };
    if (participation === 'UNVOTED') where.votes = { none: { userId: userId! } };

    const orderBy: Prisma.TopicOrderByWithRelationInput[] = query.sort === 'NEWEST'
      ? [{ createdAt: 'desc' }]
      : query.sort === 'ENDING_SOON'
        ? [{ voteEndAt: 'asc' }, { createdAt: 'desc' }]
        : query.sort === 'ACTIVITY'
          ? [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
          : [{ totalVotes: 'desc' }, { createdAt: 'desc' }];

    return this.prisma.$transaction(async (tx) => {
      let followedRootIds: bigint[] = [];
      if (userId) {
        const follows = await tx.topicFollow.findMany({ where: { userId }, select: { topicId: true } });
        followedRootIds = follows.map((follow) => follow.topicId);
      }
      if (participation === 'FOLLOWING') {
        where.AND = [{ id: { in: followedRootIds } }];
      }
      const categoryWhere = { ...where, kind: TopicKind.FORMAL };
      delete categoryWhere.category;
      const [topics, total] = await Promise.all([
        tx.topic.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: { options: { orderBy: { id: 'asc' } } },
        }),
        tx.topic.count({ where }),
      ]);
      const categoryCounts = await tx.topic.groupBy({
        by: ['category'],
        where: categoryWhere,
        _count: { _all: true },
      });

      let votedTopicIds: Set<string> = new Set();
      if (userId && topics.length > 0) {
        const votes = await tx.vote.findMany({
          where: { userId, topicId: { in: topics.map((t) => t.id) } },
          select: { topicId: true },
        });
        votedTopicIds = new Set(votes.map((v) => v.topicId.toString()));
      }

      return {
        items: topics.map((t) => this.serialize(
          t,
          votedTopicIds.has(t.id.toString()),
          followedRootIds.includes(t.id),
        )),
        categoryCounts: Object.fromEntries(categoryCounts.map((item) => [item.category, item._count._all])),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    });
  }

  async featured() {
    const topics = await this.prisma.topic.findMany({
      where: {
        featuredOrder: { not: null },
        kind: TopicKind.FORMAL,
        moderationStatus: 'APPROVED',
        status: { in: ['OPEN', 'LOCKED', 'SETTLED'] },
      },
      orderBy: [{ featuredOrder: 'asc' }, { createdAt: 'desc' }],
      take: MAX_FEATURED_TOPICS,
      include: { options: { orderBy: { id: 'asc' } } },
    });
    return topics.map((topic) => this.serialize(topic, false));
  }

  async setFeatured(userId: bigint, topicIds: string[]) {
    await this.policy.assert(userId, Capability.TOPIC_FEATURE);
    const ids = [...new Set(topicIds)].map((id) => BigInt(id));
    if (ids.length > MAX_FEATURED_TOPICS) throw new BadRequestException(`置頂議題最多 ${MAX_FEATURED_TOPICS} 筆`);
    const topics = await this.prisma.topic.findMany({
      where: { id: { in: ids } },
      select: { id: true, moderationStatus: true, status: true },
    });
    if (topics.length !== ids.length) throw new NotFoundException('部分議題不存在');
    if (topics.some((topic) => topic.moderationStatus !== 'APPROVED' || !['OPEN', 'LOCKED', 'SETTLED'].includes(topic.status))) {
      throw new BadRequestException('只有已核准且公開的議題可以置頂');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.topic.updateMany({ where: { featuredOrder: { not: null } }, data: { featuredOrder: null } });
      for (const [index, id] of ids.entries()) {
        await tx.topic.update({ where: { id }, data: { featuredOrder: index } });
      }
    });
    return this.featured();
  }

  async detail(topicId: bigint, userId: bigint | null) {
    const topic = await this.prisma.topic.findFirst({
      where: {
        id: topicId,
        status: { in: ['OPEN', 'LOCKED', 'SETTLED'] },
        moderationStatus: 'APPROVED',
      },
      include: {
        options: { orderBy: { id: 'asc' } },
        contentBlocks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        creator: { select: { nickname: true, avatarUrl: true } },
        applicationResults: { include: { application: { select: { applicantType: true, submitter: { select: { nickname: true } }, organization: { select: { name: true } } } } } },
      },
    });
    if (!topic) throw new NotFoundException('議題不存在');

    let hasVoted = false;
    let isFollowing = false;
    let myVote: { choice: string; spectrumValue: number | null } | null = null;
    if (userId) {
      const [vote, follow] = await Promise.all([
        this.prisma.vote.findUnique({
          where: { userId_topicId: { userId, topicId } },
          select: { option: { select: { label: true } }, spectrumValue: true },
        }),
        this.prisma.topicFollow.findUnique({
          where: { userId_topicId: { userId, topicId: topic.id } },
          select: { userId: true },
        }),
      ]);
      hasVoted = !!vote;
      isFollowing = !!follow;
      if (vote) {
        myVote = {
          choice: vote.option?.label ?? `${vote.spectrumValue} 分`,
          spectrumValue: vote.spectrumValue,
        };
      }
    }

    return { ...this.serialize(topic, hasVoted, isFollowing), myVote };
  }

  async follow(topicId: bigint, userId: bigint) {
    const topic = await this.publicTopicIdentity(topicId);
    await this.prisma.topicFollow.upsert({
      where: { userId_topicId: { userId, topicId: topic.id } },
      create: { userId, topicId: topic.id },
      update: { notificationsEnabled: true },
    });
    return { following: true };
  }

  async unfollow(topicId: bigint, userId: bigint) {
    const topic = await this.publicTopicIdentity(topicId);
    await this.prisma.topicFollow.deleteMany({
      where: { userId, topicId: topic.id },
    });
    return { following: false };
  }

  private async publicTopicIdentity(topicId: bigint) {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, moderationStatus: 'APPROVED', status: { in: ['OPEN', 'LOCKED', 'SETTLED'] } },
      select: { id: true },
    });
    if (!topic) throw new NotFoundException('議題不存在');
    return topic;
  }

  async create(userId: bigint, dto: CreateTopicDto) {
    await this.policy.assert(userId, Capability.FORMAL_TOPIC_AUTHOR);
    const title = dto.title.trim();
    const description = dto.description?.trim() || null;
    this.validateTopicInput(dto);
    await this.categories.assertActiveCategory(dto.category);

    const duplicate = await this.prisma.topic.findFirst({
      where: {
        title: { equals: title, mode: 'insensitive' },
        moderationStatus: { not: 'REJECTED' },
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('已有相同標題的議題，請先參與既有討論');
    await this.checkCreationRateLimit(userId);

    const topic = await this.prisma.topic.create({
      data: {
        title,
        description,
        category: dto.category,
        topicType: dto.topicType,
        status: 'DRAFT',
        moderationStatus: 'PENDING_REVIEW',
        creatorId: userId,
        voteDurationDays: dto.voteDurationDays,
        voteEndAt: null,
        options:
          dto.topicType === TopicType.SPECTRUM
            ? undefined
            : { create: (dto.options || []).map((label) => ({ label: label.trim() })) },
        contentBlocks: dto.blocks?.length
          ? {
              create: dto.blocks.map((item, index) => ({
                type: item.type,
                title: item.title.trim(),
                content: (item.content || '').trim(),
                sourceLabel: item.sourceLabel?.trim() || null,
                sourceUrl: item.sourceUrl?.trim() || null,
                occurredAt: item.occurredAt ? new Date(item.occurredAt) : null,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      include: {
        options: { orderBy: { id: 'asc' } },
        contentBlocks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        creator: { select: { nickname: true, avatarUrl: true } },
      },
    });
    return this.serialize(topic, false);
  }

  async createQuick(userId: bigint, dto: CreateQuickTopicDto) {
    await this.policy.assertSeniorMember(userId);
    const title = dto.title.trim();
    const optionLabels = (dto.options || []).map((label) => label.trim()).filter(Boolean);
    assertClean(title, '標題');
    optionLabels.forEach((label) => assertClean(label, '選項'));
    if (dto.topicType === TopicType.BINARY && optionLabels.length !== 2) {
      throw new BadRequestException('二元題必須設定 2 個選項');
    }
    if (dto.topicType === TopicType.MULTIPLE && (optionLabels.length < 2 || optionLabels.length > 4)) {
      throw new BadRequestException('多選題必須設定 2 到 4 個選項');
    }
    if (new Set(optionLabels).size !== optionLabels.length) {
      throw new BadRequestException('選項不可重複');
    }
    await this.categories.assertActiveCategory(dto.category ?? 'quick');
    await this.checkQuickCreationRateLimit(userId);

    const duplicate = await this.prisma.topic.findFirst({
      where: { title: { equals: title, mode: 'insensitive' }, moderationStatus: { not: 'REJECTED' } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('已有相同標題的議題，請先參與既有討論');

    const data: Prisma.TopicUncheckedCreateInput = {
      title,
      kind: TopicKind.QUICK,
      category: dto.category ?? 'quick',
      topicType: dto.topicType,
      status: 'OPEN',
      moderationStatus: 'APPROVED',
      creatorId: userId,
      voteDurationHours: dto.voteDurationHours,
      minVotes: dto.minVotes ?? null,
      voteEndAt: new Date(Date.now() + dto.voteDurationHours * 3_600_000),
      options: { create: optionLabels.map((label) => ({ label })) },
    };

    const topic = await this.prisma.topic.create({
      data,
      include: {
        options: { orderBy: { id: 'asc' } },
        contentBlocks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        creator: { select: { nickname: true, avatarUrl: true } },
      },
    });
    return this.serialize(topic, false);
  }

  async listQuick() {
    const topics = await this.prisma.topic.findMany({
      where: {
        kind: TopicKind.QUICK,
        status: 'OPEN',
        moderationStatus: 'APPROVED',
        voteEndAt: { gt: new Date() },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 8,
      include: { options: { orderBy: { id: 'asc' } } },
    });
    return topics.map((topic) => this.serialize(topic, false));
  }

  async listQuickMine(userId: bigint, pageInput: number, limitInput: number) {
    const page = Math.max(1, pageInput);
    const limit = Math.min(50, Math.max(1, limitInput));
    const where: Prisma.TopicWhereInput = { kind: TopicKind.QUICK, creatorId: userId };
    const [items, total] = await Promise.all([
      this.prisma.topic.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { options: { orderBy: { id: 'asc' } } },
      }),
      this.prisma.topic.count({ where }),
    ]);
    return {
      items: items.map((topic) => this.serialize(topic, false)),
      pagination: { page, limit, total },
    };
  }

  async listMine(userId: bigint, page: number, limit: number) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const where = { creatorId: userId };
    const [items, total] = await Promise.all([
      this.prisma.topic.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        include: {
          options: { orderBy: { id: 'asc' } },
          contentBlocks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          creator: { select: { nickname: true, avatarUrl: true } },
        },
      }),
      this.prisma.topic.count({ where }),
    ]);
    return {
      items: items.map((topic) => this.serialize(topic, false)),
      pagination: { page: safePage, limit: safeLimit, total },
    };
  }

  async detailMine(topicId: bigint, userId: bigint) {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, creatorId: userId },
      include: {
        options: { orderBy: { id: 'asc' } },
        contentBlocks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        creator: { select: { nickname: true, avatarUrl: true } },
      },
    });
    if (!topic) throw new NotFoundException('議題不存在');
    return this.serialize(topic, false);
  }

  async updatePending(topicId: bigint, userId: bigint, dto: CreateTopicDto) {
    await this.policy.assert(userId, Capability.FORMAL_TOPIC_AUTHOR, { topicId });
    const existing = await this.prisma.topic.findFirst({
      where: { id: topicId },
      select: { id: true, status: true, moderationStatus: true },
    });
    if (!existing) throw new NotFoundException('議題不存在');
    if (existing.status !== 'DRAFT' || existing.moderationStatus !== 'PENDING_REVIEW') {
      throw new ForbiddenException('議題核准後不可再修改');
    }

    this.validateTopicInput(dto);
    await this.categories.assertActiveCategory(dto.category);
    const title = dto.title.trim();
    const duplicate = await this.prisma.topic.findFirst({
      where: {
        id: { not: topicId },
        title: { equals: title, mode: 'insensitive' },
        moderationStatus: { not: 'REJECTED' },
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('已有相同標題的議題，請先參與既有討論');

    const topic = await this.prisma.$transaction(async (tx) => {
      await tx.topicOption.deleteMany({ where: { topicId } });
      await tx.topicContentBlock.deleteMany({ where: { topicId } });
      return tx.topic.update({
        where: { id: topicId },
        data: {
          title,
          description: dto.description?.trim() || null,
          category: dto.category,
          topicType: dto.topicType,
          voteDurationDays: dto.voteDurationDays,
          options:
            dto.topicType === TopicType.SPECTRUM
              ? undefined
              : { create: (dto.options || []).map((label) => ({ label: label.trim() })) },
          contentBlocks: dto.blocks?.length
            ? {
                create: dto.blocks.map((item, index) => ({
                  type: item.type,
                  title: item.title.trim(),
                  content: (item.content || '').trim(),
                  sourceLabel: item.sourceLabel?.trim() || null,
                  sourceUrl: item.sourceUrl?.trim() || null,
                  occurredAt: item.occurredAt ? new Date(item.occurredAt) : null,
                  sortOrder: index,
                })),
              }
            : undefined,
        },
        include: {
          options: { orderBy: { id: 'asc' } },
          contentBlocks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          creator: { select: { nickname: true, avatarUrl: true } },
        },
      });
    });
    return this.serialize(topic, false);
  }

  async listForModeration(query: {
    moderationStatus?: TopicModerationStatus;
    category?: string;
    page: number;
    limit: number;
  }) {
    const page = Math.max(1, query.page);
    const limit = Math.min(50, Math.max(1, query.limit));
    const where: any = { creatorId: { not: null } };
    if (query.moderationStatus) where.moderationStatus = query.moderationStatus;
    if (query.category) where.category = query.category;
    const [items, total] = await Promise.all([
      this.prisma.topic.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          options: { orderBy: { id: 'asc' } },
          contentBlocks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          creator: { select: { nickname: true, avatarUrl: true } },
        },
      }),
      this.prisma.topic.count({ where }),
    ]);
    return {
      items: items.map((topic) => this.serialize(topic, false)),
      pagination: { page, limit, total },
    };
  }

  async listForFeature(userId: bigint, query: { search?: string; limit: number }) {
    await this.policy.assert(userId, Capability.TOPIC_FEATURE);
    const limit = Math.min(100, Math.max(1, query.limit));
    const where: any = { moderationStatus: 'APPROVED', status: { in: ['OPEN', 'LOCKED', 'SETTLED'] } };
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };
    const items = await this.prisma.topic.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });
    return items.map((topic) => this.serialize(topic, false));
  }

  async approve(topicId: bigint, reviewerId: bigint) {
    return this.review(topicId, reviewerId, 'APPROVED', null);
  }

  async reject(topicId: bigint, reviewerId: bigint, note: string) {
    return this.review(topicId, reviewerId, 'REJECTED', note.trim());
  }

  async createEditorial(
    userId: bigint,
    dto: CreateTopicDto,
    options: { applicationIds?: bigint[]; publish: boolean },
  ) {
    const applicationIds = Array.from(new Set(options.applicationIds ?? []));
    const applications = applicationIds.length
      ? await this.prisma.topicApplication.findMany({ where: { id: { in: applicationIds } }, include: { _count: { select: { results: true } } } })
      : [];
    if (applications.length !== applicationIds.length) throw new NotFoundException('部分提案不存在');
    if (applications.some((application) => application._count.results || !['PENDING', 'IN_REVIEW'].includes(application.status))) {
      throw new ConflictException('部分提案已完成處理');
    }
    const organizationIds = new Set(applications.map((application) => application.organizationId?.toString() ?? 'member'));
    if (organizationIds.size > 1) throw new BadRequestException('不同提案人類型或合作組織的議題提案不可合併');
    const organizationId = applications[0]?.organizationId;
    const scope = organizationId ? { organizationId } : {};
    await this.policy.assert(userId, Capability.TOPIC_DRAFT, scope);
    if (options.publish) await this.policy.assert(userId, Capability.TOPIC_PUBLISH, scope);

    this.validateTopicInput(dto);
    await this.categories.assertActiveCategory(dto.category);
    const title = dto.title.trim();
    const duplicate = await this.prisma.topic.findFirst({
      where: { title: { equals: title, mode: 'insensitive' }, moderationStatus: { not: 'REJECTED' } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('已有相同標題的議題');

    const topic = await this.prisma.$transaction(async (tx) => {
      if (applicationIds.length) {
        const sortedIds = [...applicationIds].sort((a, b) => (a < b ? -1 : 1));
        await tx.$queryRaw(Prisma.sql`SELECT id FROM topic_applications WHERE id IN (${Prisma.join(sortedIds)}) ORDER BY id FOR UPDATE`);
        const current = await tx.topicApplication.findMany({ where: { id: { in: applicationIds } }, include: { _count: { select: { results: true } } } });
        if (current.some((application) => application._count.results || !['PENDING', 'IN_REVIEW'].includes(application.status))) {
          throw new ConflictException('部分提案已完成處理');
        }
      }
      const created = await tx.topic.create({
        data: {
          title,
          creatorId: userId,
          description: dto.description?.trim() || null,
          category: dto.category,
          topicType: dto.topicType,
          status: options.publish ? 'OPEN' : 'DRAFT',
          moderationStatus: 'APPROVED',
          voteDurationDays: dto.voteDurationDays,
          voteEndAt: options.publish ? new Date(Date.now() + dto.voteDurationDays * 86_400_000) : null,
          options: dto.topicType === TopicType.SPECTRUM
            ? undefined
            : { create: (dto.options || []).map((label) => ({ label: label.trim() })) },
          contentBlocks: dto.blocks?.length ? {
            create: dto.blocks.map((item, index) => ({
              type: item.type,
              title: item.title.trim(),
              content: (item.content || '').trim(),
              sourceLabel: item.sourceLabel?.trim() || null,
              sourceUrl: item.sourceUrl?.trim() || null,
              occurredAt: item.occurredAt ? new Date(item.occurredAt) : null,
              sortOrder: index,
            })),
          } : undefined,
        },
        include: {
          options: { orderBy: { id: 'asc' } },
          contentBlocks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          creator: { select: { nickname: true, avatarUrl: true } },
        },
      });
      for (const application of applications) {
        await tx.topicApplication.update({
          where: { id: application.id },
          data: {
            status: 'APPROVED',
            results: { create: { topicId: created.id } },
          },
        });
        await tx.topicApplicationRevision.update({
          where: { applicationId_revisionNumber: { applicationId: application.id, revisionNumber: application.revisionNumber } },
          data: { status: 'APPROVED', reviewedById: userId, reviewedAt: new Date() },
        });
      }
      return created;
    });
    return this.serialize(topic, false);
  }

  async importEditorial(userId: bigint, dto: ImportTopicDto) {
    const scope: PolicyScope = {};
    await this.policy.assert(userId, Capability.TOPIC_DRAFT, scope);
    if (dto.publish) await this.policy.assert(userId, Capability.TOPIC_PUBLISH, scope);

    const maxDepth = Number(process.env.STANCE_MAX_DEPTH || 4);
    this.assertStanceTreeDepth(dto.stances ?? [], 0, maxDepth);

    this.validateTopicInput(dto);
    await this.categories.assertActiveCategory(dto.category);
    const title = dto.title.trim();
    const duplicate = await this.prisma.topic.findFirst({
      where: { title: { equals: title, mode: 'insensitive' }, moderationStatus: { not: 'REJECTED' } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('已有相同標題的議題');

    const topic = await this.prisma.$transaction(async (tx) => {
      const created = await tx.topic.create({
        data: {
          title,
          creatorId: userId,
          description: dto.description?.trim() || null,
          category: dto.category,
          topicType: dto.topicType,
          status: dto.publish ? 'OPEN' : 'DRAFT',
          moderationStatus: 'APPROVED',
          voteDurationDays: dto.voteDurationDays,
          voteEndAt: dto.publish ? new Date(Date.now() + dto.voteDurationDays * 86_400_000) : null,
          options: dto.topicType === TopicType.SPECTRUM
            ? undefined
            : { create: (dto.options || []).map((label) => ({ label: label.trim() })) },
          contentBlocks: dto.blocks?.length ? {
            create: dto.blocks.map((item, index) => ({
              type: item.type,
              title: item.title.trim(),
              content: (item.content || '').trim(),
              sourceLabel: item.sourceLabel?.trim() || null,
              sourceUrl: item.sourceUrl?.trim() || null,
              occurredAt: item.occurredAt ? new Date(item.occurredAt) : null,
              sortOrder: index,
            })),
          } : undefined,
        },
        include: {
          options: { orderBy: { id: 'asc' } },
          contentBlocks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          creator: { select: { nickname: true, avatarUrl: true } },
        },
      });
      if (dto.stances?.length) {
        await this.createStanceTree(tx, created.id, userId, dto.stances, null, 0);
      }
      return created;
    });
    return this.serialize(topic, false);
  }

  private async createStanceTree(
    tx: Prisma.TransactionClient,
    topicId: bigint,
    creatorId: bigint,
    nodes: ImportTopicStanceDto[],
    parentId: bigint | null,
    depth: number,
  ) {
    for (const node of nodes) {
      const stance = await tx.topicStance.create({
        data: {
          topicId,
          parentId,
          creatorId,
          title: node.title.trim(),
          rationale: node.rationale?.trim() || null,
          depth,
          status: 'ACTIVE',
        },
      });
      if (node.children?.length) {
        await this.createStanceTree(tx, topicId, creatorId, node.children, stance.id, depth + 1);
      }
    }
  }

  private assertStanceTreeDepth(nodes: ImportTopicStanceDto[], depth: number, maxDepth: number) {
    for (const node of nodes) {
      if (depth > maxDepth) throw new BadRequestException(`立場最深只能到第 ${maxDepth} 層`);
      this.assertStanceTreeDepth(node.children ?? [], depth + 1, maxDepth);
    }
  }

  async publishEditorial(topicId: bigint, userId: bigint) {
    await this.policy.assert(userId, Capability.TOPIC_PUBLISH, { topicId });
    const existing = await this.prisma.topic.findUnique({ where: { id: topicId } });
    if (!existing) throw new NotFoundException('議題不存在');
    if (existing.status !== 'DRAFT' || existing.moderationStatus !== 'APPROVED') {
      throw new BadRequestException('只有編輯部已核准草稿可直接發布');
    }
    const topic = await this.prisma.$transaction(async (tx) => {
      const published = await tx.topic.update({
        where: { id: topicId },
        data: { status: 'OPEN', voteEndAt: new Date(Date.now() + existing.voteDurationDays * 86_400_000) },
        include: {
          options: { orderBy: { id: 'asc' } },
          contentBlocks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          creator: { select: { nickname: true, avatarUrl: true } },
        },
      });
      return published;
    });
    return this.serialize(topic, false);
  }

  async vote(topicId: bigint, userId: bigint, dto: VoteDto): Promise<VoteResult> {
    await this.policy.assertPublicAction(userId, 'VOTE');
    const configuredRewardPoints = Number(process.env.VOTE_REWARD_POINTS || 5);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${userId})`;
      const lockedTopic = await tx.$queryRaw<Array<{ id: bigint }>>`SELECT id FROM topics WHERE id = ${topicId} FOR UPDATE`;
      if (!lockedTopic.length) throw new NotFoundException('議題不存在');
      const topic = await tx.topic.findUnique({ where: { id: topicId }, include: { options: true } });
      if (!topic) throw new NotFoundException('議題不存在');
      if (topic.status !== 'OPEN') throw new ForbiddenException('議題不在開放投票狀態');
      if (topic.moderationStatus !== 'APPROVED') throw new ForbiddenException('議題尚未通過複核');
      if (!topic.voteEndAt) throw new ForbiddenException('議題尚未設定投票期限');
      if (topic.voteEndAt.getTime() <= Date.now()) throw new ForbiddenException('議題已截止投票');
      const existing = await tx.vote.findUnique({
        where: { userId_topicId: { userId, topicId } },
        select: { id: true },
      });
      if (existing) throw new ConflictException('您已投票過此議題');

      const rewardPoints = configuredRewardPoints;

      const lock = await tx.$queryRaw<
        Array<{ id: bigint; points_balance: bigint }>
      >`SELECT id, points_balance FROM users WHERE id = ${userId} FOR UPDATE`;

      let optionId: bigint | null = null;
      let spectrumValue: number | null = null;

      if (topic.topicType === 'SPECTRUM') {
        if (dto.spectrumValue === undefined || dto.spectrumValue === null) {
          throw new BadRequestException('光譜題必須提供 spectrumValue（0~100）');
        }
        spectrumValue = dto.spectrumValue;
      } else {
        if (!dto.optionId) throw new BadRequestException('必須選擇一個選項');
        const chosenOptionId = BigInt(dto.optionId);
        const valid = topic.options.some((o) => o.id === chosenOptionId);
        if (!valid) throw new BadRequestException('選項不存在於此議題');
        optionId = chosenOptionId;
      }

      const createdVote = await tx.vote.create({ data: { userId, topicId, optionId, spectrumValue } });

      if (optionId) {
        await tx.topicOption.update({
          where: { id: optionId },
          data: { voteCount: { increment: 1 } },
        });
      }

      await tx.topic.update({
        where: { id: topicId },
        data: { totalVotes: { increment: 1 }, voterCount: { increment: 1 } },
      });

      const before = lock[0]?.points_balance ?? BigInt(0);
      const after = before + BigInt(rewardPoints);

      if (rewardPoints > 0) {
        await tx.pointTransaction.create({
          data: {
            userId,
            amount: rewardPoints,
            balanceBefore: before,
            balanceAfter: after,
            txType: 'VOTE_REWARD',
            referenceType: 'VOTE',
            referenceId: topicId.toString(),
            idempotencyKey: `VOTE_${topicId}_${userId}`,
            note: `投票獎勵：${topic.title}`,
          },
        });
        await tx.user.update({ where: { id: userId }, data: { pointsBalance: after } });
      }

      return { voteId: createdVote.id, votedAt: createdVote.createdAt, after, optionId: optionId?.toString() ?? null, rewardPoints, topicType: topic.topicType };
    });

    const snapshotPromise = this.createDemographicSnapshot(result.voteId, userId);

    if (result.topicType === 'SPECTRUM') {
      await Promise.all([snapshotPromise, this.recomputeSpectrum(topicId)]);
    } else {
      await snapshotPromise;
    }
    const [optionCounts, updatedTopic] = await Promise.all([
      this.loadOptionCounts(topicId),
      this.prisma.topic.findUnique({ where: { id: topicId }, select: { totalVotes: true } }),
    ]);
    await this.realtime.broadcastTopicVotes(topicId, optionCounts, updatedTopic?.totalVotes);

    return {
      success: true,
      optionId: result.optionId,
      spectrumValue: dto.spectrumValue ?? null,
      rewardPoints: result.rewardPoints,
      newBalance: result.after.toString(),
    };
  }

  async revote(topicId: bigint, userId: bigint, dto: VoteDto): Promise<VoteResult> {
    await this.policy.assertPublicAction(userId, 'VOTE');

    interface RevoteTransaction {
      voteId: bigint;
      optionId: string | null;
      spectrumValue: number | null;
      newBalance: bigint;
    }

    const result = await this.prisma.$transaction(async (tx): Promise<RevoteTransaction> => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${userId})`;
      const lockedTopic = await tx.$queryRaw<Array<{ id: bigint }>>`SELECT id FROM topics WHERE id = ${topicId} FOR UPDATE`;
      if (!lockedTopic.length) throw new NotFoundException('議題不存在');
      const topic = await tx.topic.findUnique({ where: { id: topicId }, include: { options: true } });
      if (!topic) throw new NotFoundException('議題不存在');
      if (topic.kind !== TopicKind.QUICK) throw new ForbiddenException('此議題送出後不可更改');
      if (topic.status !== 'OPEN') throw new ForbiddenException('議題不在開放投票狀態');
      if (topic.moderationStatus !== 'APPROVED') throw new ForbiddenException('議題尚未通過複核');
      if (!topic.voteEndAt) throw new ForbiddenException('議題尚未設定投票期限');
      if (topic.voteEndAt.getTime() <= Date.now()) throw new ForbiddenException('議題已截止投票');

      const existing = await tx.vote.findUnique({ where: { userId_topicId: { userId, topicId } } });
      if (!existing) throw new NotFoundException('尚未投票，無法更改');

      let optionId: bigint | null = null;
      let spectrumValue: number | null = null;
      if (topic.topicType === 'SPECTRUM') {
        if (dto.spectrumValue === undefined || dto.spectrumValue === null) {
          throw new BadRequestException('光譜題必須提供 spectrumValue（0~100）');
        }
        spectrumValue = dto.spectrumValue;
      } else {
        if (!dto.optionId) throw new BadRequestException('必須選擇一個選項');
        const chosenOptionId = BigInt(dto.optionId);
        const valid = topic.options.some((o) => o.id === chosenOptionId);
        if (!valid) throw new BadRequestException('選項不存在於此議題');
        optionId = chosenOptionId;
      }
      if (existing.optionId !== null && existing.optionId === optionId) {
        const unchanged = await tx.user.findUnique({ where: { id: userId }, select: { pointsBalance: true } });
        return {
          voteId: existing.id,
          optionId: existing.optionId.toString(),
          spectrumValue: existing.spectrumValue,
          newBalance: unchanged?.pointsBalance ?? BigInt(0),
        };
      }

      if (existing.optionId) {
        await tx.topicOption.update({
          where: { id: existing.optionId },
          data: { voteCount: { decrement: 1 } },
        });
      }
      await tx.vote.delete({ where: { id: existing.id } });
      const createdVote = await tx.vote.create({ data: { userId, topicId, optionId, spectrumValue } });
      if (optionId) {
        await tx.topicOption.update({
          where: { id: optionId },
          data: { voteCount: { increment: 1 } },
        });
      }
      await tx.topic.update({ where: { id: topicId }, data: { updatedAt: new Date() } });

      const user = await tx.user.findUnique({ where: { id: userId }, select: { pointsBalance: true } });
      return {
        voteId: createdVote.id,
        optionId: optionId?.toString() ?? null,
        spectrumValue,
        newBalance: user?.pointsBalance ?? BigInt(0),
      };
    });

    const snapshotPromise = this.createDemographicSnapshot(result.voteId, userId);
    if (result.spectrumValue !== null) {
      await Promise.all([snapshotPromise, this.recomputeSpectrum(topicId)]);
    } else {
      await snapshotPromise;
    }
    const [optionCounts, updatedTopic] = await Promise.all([
      this.loadOptionCounts(topicId),
      this.prisma.topic.findUnique({ where: { id: topicId }, select: { totalVotes: true } }),
    ]);
    await this.realtime.broadcastTopicVotes(topicId, optionCounts, updatedTopic?.totalVotes);

    return {
      success: true,
      optionId: result.optionId,
      spectrumValue: result.spectrumValue,
      rewardPoints: 0,
      newBalance: result.newBalance.toString(),
    };
  }

  private async createDemographicSnapshot(voteId: bigint, userId: bigint) {
    try {
      const profile = await this.prisma.userDemographicProfile.findUnique({ where: { userId }, include: { guardianConsent: true } });
      const canSnapshot =
        profile?.analyticsConsent &&
        profile.consentVersion === DEMOGRAPHIC_CONSENT_VERSION &&
        profile.birthDateCiphertext &&
        profile.birthDateIv &&
        profile.birthDateAuthTag &&
        (!profile.isMinor || (
          profile.guardianConsentStatus === 'VERIFIED' &&
          profile.guardianConsent?.consentVersion === DEMOGRAPHIC_CONSENT_VERSION &&
          !profile.guardianConsent.revokedAt
        ));
      if (canSnapshot) {
        const birthDate = this.demographicCrypto.decryptBirthDate(
          profile.birthDateCiphertext!,
          profile.birthDateIv!,
          profile.birthDateAuthTag!,
          profile.birthDateKeyVersion || 1,
        );
        const derived = deriveDemographics(birthDate);
        await this.prisma.voteDemographicSnapshot.create({
          data: {
            voteId,
            ageBand: derived.ageBand,
            gender: profile.gender,
            occupation: profile.occupation,
            region: profile.region,
            district: profile.region && profile.district ? `${profile.region}${profile.district}` : null,
            personalityType: disclosed(profile.personalityType),
            employmentStatus: disclosed(profile.employmentStatus),
            industry: disclosed(profile.industry),
            annualIncome: disclosed(profile.annualIncome),
            education: disclosed(profile.education),
            relationship: disclosed(profile.relationship),
            livingArrangement: disclosed(profile.livingArrangement),
            parentingStage: disclosed(profile.parentingStage),
            housingStatus: disclosed(profile.housingStatus),
            westernZodiac: derived.westernZodiac,
            chineseZodiac: derived.chineseZodiac,
            isMinor: derived.isMinor,
            consentVersion: DEMOGRAPHIC_CONSENT_VERSION,
          },
        });
      }
    } catch {
      // Demographic data is optional and must never prevent the vote itself.
    }
  }

  private async recomputeSpectrum(topicId: bigint) {
    try {
      const agg = await this.prisma.$queryRaw<
        Array<{ median: number | null; stddev: number | null }>
      >`
        SELECT
          percentile_cont(0.5) WITHIN GROUP (ORDER BY spectrum_value)::float8 AS median,
          stddev(spectrum_value)::float8 AS stddev
        FROM votes
        WHERE topic_id = ${topicId} AND spectrum_value IS NOT NULL
      `;
      const row = agg[0];
      await this.prisma.topic.update({
        where: { id: topicId },
        data: {
          spectrumMedian: row?.median ?? null,
          spectrumStddev: row?.stddev ?? null,
        },
      });
    } catch (e) {
      // best-effort; stats refresh can be retried later
    }
  }

  private async loadOptionCounts(topicId: bigint) {
    const options = await this.prisma.topicOption.findMany({
      where: { topicId },
      select: { id: true, voteCount: true },
    });
    return options.map((o) => ({ optionId: o.id.toString(), voteCount: o.voteCount.toString() }));
  }

  private async checkCreationRateLimit(userId: bigint) {
    const cooldownKey = `topic:create:${userId}:cooldown`;
    const cooldown = await this.redis.raw.set(cooldownKey, '1', 'EX', 600, 'NX');
    if (!cooldown) throw new HttpException('每次發起議題需間隔 10 分鐘', 429);

    const dailyKey = `topic:create:${userId}:day`;
    const dailyCount = await this.redis.incr(dailyKey);
    if (dailyCount === 1) await this.redis.expire(dailyKey, 86400);
    if (dailyCount > 3) {
      await this.redis.del(cooldownKey);
      throw new HttpException('今日發起議題數量已達上限', 429);
    }
  }

  private async checkQuickCreationRateLimit(userId: bigint) {
    const dailyKey = `topic:quick:create:${userId}:day`;
    const dailyCount = await this.redis.incr(dailyKey);
    if (dailyCount === 1) await this.redis.expire(dailyKey, 86400);
    if (dailyCount > 3) {
      throw new HttpException('今日發起快問數量已達上限（最多 3 則）', 429);
    }
  }

  private validateTopicInput(dto: CreateTopicDto) {
    const options = (dto.options || []).map((option) => option.trim()).filter(Boolean);
    if (dto.topicType === 'SPECTRUM' && options.length > 0) {
      throw new BadRequestException('光譜題不需要設定選項');
    }
    if (dto.topicType === 'BINARY' && options.length !== 2) {
      throw new BadRequestException('二元題必須設定 2 個選項');
    }
    if (dto.topicType === 'MULTIPLE' && (options.length < 2 || options.length > 6)) {
      throw new BadRequestException('多選題必須設定 2 到 6 個選項');
    }
    if (new Set(options).size !== options.length) {
      throw new BadRequestException('選項不可重複');
    }
    if (dto.blocks?.some((block) => block.type === 'SOURCE' && !block.sourceUrl)) {
      throw new BadRequestException('來源連結模組必須提供網址');
    }
  }

  private async review(
    topicId: bigint,
    reviewerId: bigint,
    moderationStatus: 'APPROVED' | 'REJECTED',
    note: string | null,
  ) {
    const existing = await this.prisma.topic.findUnique({ where: { id: topicId } });
    if (!existing) throw new NotFoundException('議題不存在');
    if (!existing.creatorId) throw new BadRequestException('官方議題不需要會員內容複核');
    if (existing.moderationStatus !== 'PENDING_REVIEW') {
      throw new BadRequestException('此議題已完成複核');
    }
    const topic = await this.prisma.$transaction(async (tx) => {
      const reviewed = await tx.topic.update({
        where: { id: topicId },
        data: {
          moderationStatus,
          status: moderationStatus === 'REJECTED' ? 'CANCELLED' : 'OPEN',
          voteEndAt:
            moderationStatus === 'APPROVED'
              ? new Date(Date.now() + existing.voteDurationDays * 24 * 60 * 60 * 1000)
              : null,
          moderationNote: note,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
        include: {
          options: { orderBy: { id: 'asc' } },
          contentBlocks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          creator: { select: { nickname: true, avatarUrl: true } },
        },
      });

      return reviewed;
    });
    return this.serialize(topic, false);
  }

  private serialize(topic: any, hasVoted: boolean, isFollowing = false) {
    return {
      id: topic.id.toString(),
      title: topic.title,
      description: topic.description,
      category: topic.category,
      kind: topic.kind,
      featuredOrder: topic.featuredOrder ?? null,
      topicType: topic.topicType,
      status: topic.status,
      moderationStatus: topic.moderationStatus,
      moderationNote: topic.moderationNote ?? null,
      creator: { nickname: '議題小組', avatarUrl: null, type: 'OFFICIAL' },
      proposedBy: Array.from(new Map((topic.applicationResults || []).map((result: any) => {
        const application = result.application;
        const type = application.applicantType === 'ORGANIZATION' ? 'ORGANIZATION' : 'MEMBER';
        const label = type === 'ORGANIZATION' ? application.organization?.name : application.submitter.nickname;
        return [`${type}:${label}`, { type, label }];
      })).values()),
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
      voteEndAt: topic.voteEndAt,
      voteDurationDays: topic.voteDurationDays,
      voteDurationHours: topic.voteDurationHours ?? null,
      minVotes: topic.minVotes ?? null,
      totalVotes: topic.totalVotes.toString(),
      voterCount: topic.voterCount.toString(),
      spectrumMedian: topic.spectrumMedian?.toString() ?? null,
      spectrumStddev: topic.spectrumStddev?.toString() ?? null,
      hasVoted,
      isFollowing,
      blocks: (topic.contentBlocks || []).map((item: any) => ({
        id: item.id.toString(),
        type: item.type,
        title: item.title,
        content: item.content,
        sourceLabel: item.sourceLabel ?? null,
        sourceUrl: item.sourceUrl ?? null,
        occurredAt: item.occurredAt ?? null,
      })),
      options: (topic.options || []).map((o: any) => ({
        id: o.id.toString(),
        label: o.label,
        voteCount: o.voteCount.toString(),
      })),
    };
  }
}

function disclosed<T>(value: T | null | undefined): T | null {
  return value === undefined || value === null || String(value) === 'PREFER_NOT_TO_SAY' ? null : value;
}

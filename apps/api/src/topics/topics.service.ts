import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma, TopicAudience, TopicKind, TopicModerationStatus, TopicType, TopicVisibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateTopicDto, CreateQuickTopicDto, CreateSurveyDto, CreateSurveyQuestionDto, MAX_FEATURED_TOPICS } from './dto/topic.dto';
import { ImportTopicDto, ImportTopicStanceDto } from './dto/import-topic.dto';
import { VoteDto } from './dto/vote.dto';
import { SaveRankDto } from './dto/rank.dto';
import { DemographicCryptoService, deriveDemographics } from '../profiles/demographic-crypto.service';
import { DEMOGRAPHIC_CONSENT_VERSION } from '../profiles/demographic-profiles.service';
import { resolveAvatarUrl } from '../avatars/avatar-url';
import { Capability, PolicyScope, PolicyService } from '../identity/policy.service';
import { CategoriesService } from '../categories/categories.service';
import { assertClean } from '../common/sensitive';
import { TopicAccessService } from './topic-access.service';

export interface VoteResult {
  success: boolean;
  optionId: string | null;
  optionIds: string[];
  spectrumValue: number | null;
  answerText: string | null;
  rewardPoints: number;
  newBalance: string;
}

type QuickQuestionInput = {
  topicType: TopicType;
  options?: string[];
  optionImages?: (string | null)[];
  matches?: string[];
  weights?: number[];
  prompt?: string;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  maxSelections?: number;
};

@Injectable()
export class TopicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly redis: RedisService,
    private readonly demographicCrypto: DemographicCryptoService,
    private readonly policy: PolicyService,
    private readonly categories: CategoriesService,
    private readonly access: TopicAccessService,
  ) {}

  list(userId: bigint | null, query: {
    category?: string;
    creatorId?: bigint;
    search?: string;
    sort?: 'POPULAR' | 'NEWEST' | 'ENDING_SOON' | 'ACTIVITY';
    kind?: 'FORMAL' | 'QUICK' | 'SURVEY' | 'ALL';
    participation?: 'ALL' | 'VOTED' | 'UNVOTED' | 'FOLLOWING';
    status?: 'ACTIVE' | 'ENDED' | 'ALL';
    page: number;
    limit: number;
  }) {
    const page = Math.max(1, query.page);
    const limit = Math.min(50, Math.max(1, query.limit));
    const participation = query.participation || 'ALL';
    if (participation !== 'ALL' && !userId) throw new ForbiddenException('請先登入再篩選會員議題');
    const kind = query.kind || 'FORMAL';
    const search = query.search?.trim();
    const status = query.status || (search ? 'ALL' : 'ACTIVE');
    const where: Prisma.TopicWhereInput = query.creatorId
      ? { status: { in: ['OPEN', 'LOCKED', 'SETTLED'] }, moderationStatus: 'APPROVED' }
      : { moderationStatus: 'APPROVED' };
    if (!query.creatorId) {
      if (status === 'ENDED') {
        this.appendAnd(where, {
          OR: [
            { status: { in: ['LOCKED', 'SETTLED'] } },
            { status: 'OPEN', voteEndAt: { lte: new Date() } },
          ],
        });
      } else if (status === 'ALL') {
        this.appendAnd(where, { status: { in: ['OPEN', 'LOCKED', 'SETTLED'] } });
      } else {
        this.appendAnd(where, { status: 'OPEN', voteEndAt: { gt: new Date() } });
      }
    }
    this.appendAnd(where, this.access.discoveryWhere(userId));
    where.parentTopicId = null;
    if (kind !== 'ALL') where.kind = kind === 'QUICK' ? TopicKind.QUICK : kind === 'SURVEY' ? TopicKind.SURVEY : TopicKind.FORMAL;
    if (query.creatorId) {
      where.audienceOwnerId = query.creatorId;
    }
    if (query.category) where.category = query.category;
    if (search) where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { options: { some: { label: { contains: search, mode: 'insensitive' } } } },
    ];

    const orderBy: Prisma.TopicOrderByWithRelationInput[] = query.sort === 'NEWEST'
      ? [{ createdAt: 'desc' }]
      : query.sort === 'ENDING_SOON'
        ? [{ voteEndAt: 'asc' }, { createdAt: 'desc' }]
        : query.sort === 'ACTIVITY'
          ? [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
          : [{ totalVotes: 'desc' }, { createdAt: 'desc' }];

    return this.prisma.$transaction(async (tx) => {
      let followedRootIds: bigint[] = [];
      const involvement = new Set<bigint>();
      if (userId) {
        if (participation === 'VOTED' || participation === 'UNVOTED') {
          const [votes, rankResults] = await Promise.all([
            tx.vote.findMany({ where: { userId }, select: { topicId: true } }),
            tx.topicRankResult.findMany({ where: { userId }, select: { topicId: true } }),
          ]);
          for (const vote of votes) involvement.add(vote.topicId);
          for (const rankResult of rankResults) involvement.add(rankResult.topicId);
          if (participation === 'VOTED') {
            where.id = { in: [...involvement] };
          } else {
            where.id = { notIn: [...involvement] };
          }
        }
        const follows = await tx.topicFollow.findMany({ where: { userId }, select: { topicId: true } });
        followedRootIds = follows.map((follow) => follow.topicId);
        if (participation === 'FOLLOWING') {
            this.appendAnd(where, { id: { in: followedRootIds } });
        }
      }
      const categoryWhere = { ...where, kind: TopicKind.FORMAL };
      delete categoryWhere.category;
      const [topics, total] = await Promise.all([
        tx.topic.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            options: { orderBy: { id: 'asc' } },
            creator: { select: { nickname: true, avatarUrl: true } },
            audienceOwner: { select: { nickname: true, avatarUrl: true } },
          },
        }),
        tx.topic.count({ where }),
      ]);
      const categoryCounts = await tx.topic.groupBy({
        by: ['category'],
        where: categoryWhere,
        _count: { _all: true },
      });

      const rankDataById = new Map<string, { ranking: string[]; comparisons: number }>();
      if (userId && topics.length > 0) {
        const pageIds = topics.map((t) => t.id);
        const [pageVotes, pageRanks] = await Promise.all([
          tx.vote.findMany({ where: { userId, topicId: { in: pageIds } }, select: { topicId: true } }),
          tx.topicRankResult.findMany({
            where: { userId, topicId: { in: pageIds } },
            select: { topicId: true, ranking: true, comparisons: true },
          }),
        ]);
        for (const vote of pageVotes) involvement.add(vote.topicId);
        for (const rankResult of pageRanks) {
          involvement.add(rankResult.topicId);
          rankDataById.set(rankResult.topicId.toString(), {
            ranking: rankResult.ranking as string[],
            comparisons: rankResult.comparisons,
          });
        }
      }

      return {
        items: topics.map((t) => this.serialize(
          t,
          involvement.has(t.id),
          followedRootIds.includes(t.id),
          rankDataById.get(t.id.toString()) ?? null,
        )),
        categoryCounts: Object.fromEntries(categoryCounts.map((item) => [item.category, item._count._all])),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    });
  }

  async featured(userId: bigint | null = null) {
    const topics = await this.prisma.topic.findMany({
      where: {
        featuredOrder: { not: null },
        kind: TopicKind.FORMAL,
        moderationStatus: 'APPROVED',
        status: { in: ['OPEN', 'LOCKED', 'SETTLED'] },
        AND: [this.access.discoveryWhere(userId)],
      },
      orderBy: [{ featuredOrder: 'asc' }, { createdAt: 'desc' }],
      take: MAX_FEATURED_TOPICS,
      include: {
        options: { orderBy: { id: 'asc' } },
        creator: { select: { nickname: true, avatarUrl: true } },
      },
    });
    return topics.map((topic) => this.serialize(topic, false));
  }

  async setFeatured(userId: bigint, topicIds: string[]) {
    await this.policy.assert(userId, Capability.TOPIC_FEATURE);
    const ids = [...new Set(topicIds)].map((id) => BigInt(id));
    if (ids.length > MAX_FEATURED_TOPICS) throw new BadRequestException(`置頂議題最多 ${MAX_FEATURED_TOPICS} 筆`);
    const topics = await this.prisma.topic.findMany({
      where: { id: { in: ids } },
      select: { id: true, moderationStatus: true, status: true, visibility: true, audience: true },
    });
    if (topics.length !== ids.length) throw new NotFoundException('部分議題不存在');
    if (topics.some((topic) => topic.moderationStatus !== 'APPROVED' || !['OPEN', 'LOCKED', 'SETTLED'].includes(topic.status) || topic.visibility !== TopicVisibility.PUBLIC || topic.audience !== TopicAudience.MEMBER_ONLY)) {
      throw new BadRequestException('只有已核准且公開的議題可以置頂');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.topic.updateMany({ where: { featuredOrder: { not: null } }, data: { featuredOrder: null } });
      for (const [index, id] of ids.entries()) {
        await tx.topic.update({ where: { id }, data: { featuredOrder: index } });
      }
    });
    return this.featured(userId);
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
        audienceOwner: { select: { nickname: true, avatarUrl: true } },
        questions: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: {
            options: { orderBy: { id: 'asc' } },
            creator: { select: { nickname: true, avatarUrl: true } },
          },
        },
        applicationResults: { include: { application: { select: { applicantType: true, submitter: { select: { nickname: true } }, organization: { select: { name: true } } } } } },
      },
    });
    if (!topic) throw new NotFoundException('議題不存在');
    await this.access.assertCanView(topic, userId);

    let hasVoted = false;
    let isFollowing = false;
    let myVote: { choice: string; optionId: string | null; optionIds: string[]; spectrumValue: number | null } | null = null;
    let myRanking: string[] | null = null;
    let myRankingComparisons = 0;
    if (userId) {
      const [vote, follow, rankResult] = await Promise.all([
        this.prisma.vote.findUnique({
          where: { userId_topicId: { userId, topicId } },
          select: {
            option: { select: { label: true } },
            optionId: true,
            spectrumValue: true,
            answerText: true,
            selections: { orderBy: { optionId: 'asc' }, select: { optionId: true, option: { select: { label: true } } } },
          },
        }),
        this.prisma.topicFollow.findUnique({
          where: { userId_topicId: { userId, topicId: topic.id } },
          select: { userId: true },
        }),
        topic.topicType === 'IMAGE_RANK'
          ? this.prisma.topicRankResult.findUnique({
              where: { userId_topicId: { userId, topicId: topic.id } },
              select: { ranking: true, comparisons: true },
            })
          : null,
      ]);
      hasVoted = topic.topicType === 'IMAGE_RANK' ? !!rankResult : !!vote;
      isFollowing = !!follow;
      if (rankResult) {
        myRanking = rankResult.ranking as string[];
        myRankingComparisons = rankResult.comparisons;
      }
      if (vote) {
        myVote = {
          choice: this.voteChoice(vote),
          optionId: vote.optionId != null ? vote.optionId.toString() : null,
          optionIds: vote.selections.map((selection) => selection.optionId.toString()),
          spectrumValue: vote.spectrumValue,
        };
      }
    }

    let surveyQuestions: any[] | null = null;
    let surveyAnsweredCount = 0;
    if (topic.kind === 'SURVEY') {
      const childTopics: any[] = (topic as any).questions || [];
      const childIds = childTopics.map((question) => question.id);
      const [childVotes, childRanks] = userId && childIds.length
        ? await Promise.all([
            this.prisma.vote.findMany({
              where: { userId, topicId: { in: childIds } },
              select: {
                topicId: true,
                optionId: true,
                spectrumValue: true,
                answerText: true,
                option: { select: { label: true } },
                selections: { orderBy: { optionId: 'asc' }, select: { optionId: true, option: { select: { label: true } } } },
              },
            }),
            this.prisma.topicRankResult.findMany({
              where: { userId, topicId: { in: childIds } },
              select: { topicId: true, ranking: true, comparisons: true },
            }),
          ])
        : [[], []];
      const voteByTopic = new Map(childVotes.map((vote) => [vote.topicId.toString(), vote]));
      const rankByTopic = new Map(childRanks.map((rank) => [rank.topicId.toString(), rank]));
      surveyQuestions = await Promise.all(childTopics.map(async (question) => {
        const vote = voteByTopic.get(question.id.toString());
        const rank = rankByTopic.get(question.id.toString());
        const questionHasVoted = question.topicType === 'IMAGE_RANK' ? !!rank : !!vote;
        if (questionHasVoted) surveyAnsweredCount += 1;
        return {
          ...this.serialize(question, questionHasVoted),
          myVote: vote
            ? {
                choice: this.voteChoice(vote),
                optionId: vote.optionId != null ? vote.optionId.toString() : null,
                optionIds: vote.selections.map((selection) => selection.optionId.toString()),
                spectrumValue: vote.spectrumValue,
              }
            : null,
          myRanking: rank ? (rank.ranking as string[]) : null,
          myRankingComparisons: rank?.comparisons ?? 0,
          responses: await this.loadResponses(question),
        };
      }));
    }

    return {
      ...this.serialize(topic, hasVoted, isFollowing),
      myVote,
      myRanking,
      myRankingComparisons,
      responses: await this.loadResponses(topic),
      ...(surveyQuestions
        ? { questions: surveyQuestions, surveyQuestionCount: surveyQuestions.length, surveyAnsweredCount }
        : {}),
    };
  }

  private async loadResponses(topic: any) {
    if (topic.topicType !== 'SHORT_ANSWER') return [];
    const votes = await this.prisma.vote.findMany({
      where: { topicId: topic.id, answerText: { not: null } },
      select: { id: true, answerText: true, createdAt: true, user: { select: { nickname: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return votes.map((vote) => ({
      id: vote.id.toString(),
      nickname: vote.user.nickname,
      avatarUrl: vote.user.avatarUrl,
      answerText: vote.answerText,
      createdAt: vote.createdAt,
    }));
  }

  async follow(topicId: bigint, userId: bigint) {
    const topic = await this.publicTopicIdentity(topicId, userId);
    await this.prisma.topicFollow.upsert({
      where: { userId_topicId: { userId, topicId: topic.id } },
      create: { userId, topicId: topic.id },
      update: { notificationsEnabled: true },
    });
    return { following: true };
  }

  async unfollow(topicId: bigint, userId: bigint) {
    const topic = await this.publicTopicIdentity(topicId, userId);
    await this.prisma.topicFollow.deleteMany({
      where: { userId, topicId: topic.id },
    });
    return { following: false };
  }

  private async publicTopicIdentity(topicId: bigint, userId: bigint | null = null) {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, moderationStatus: 'APPROVED', status: { in: ['OPEN', 'LOCKED', 'SETTLED'] } },
      select: { id: true, kind: true, visibility: true, audience: true, audienceOwnerId: true },
    });
    if (!topic) throw new NotFoundException('議題不存在');
    await this.access.assertCanView(topic, userId);
    return topic;
  }

  async create(userId: bigint, dto: CreateTopicDto) {
    await this.policy.assert(userId, Capability.FORMAL_TOPIC_AUTHOR);
    const title = dto.title.trim();
    const description = dto.description?.trim() || null;
    this.validateTopicInput(dto);
    this.assertOptionImagesLength(dto);
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
        audienceOwnerId: userId,
        audience: dto.audience ?? TopicAudience.MEMBER_ONLY,
        visibility: TopicVisibility.PUBLIC,
        voteDurationDays: dto.voteDurationDays,
        voteEndAt: null,
        options:
          dto.topicType === TopicType.SPECTRUM
            ? undefined
            : { create: (dto.options || []).map((label, index) => ({ label: label.trim(), data: this.optionImageData(dto, index) })) },
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
    assertClean(title, '標題');
    const optionCreates = this.prepareQuickQuestion(dto);
    await this.categories.assertActiveCategory(dto.category ?? 'quick');

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
      description: dto.topicType === TopicType.SHORT_ANSWER ? dto.prompt?.trim() || null : null,
      status: 'OPEN',
      moderationStatus: 'APPROVED',
      creatorId: userId,
      audienceOwnerId: userId,
      audience: dto.audience ?? TopicAudience.MEMBER_ONLY,
      visibility: dto.visibility ?? TopicVisibility.PUBLIC,
      voteDurationHours: dto.voteDurationHours,
      minVotes: dto.minVotes ?? null,
      scaleMinLabel: dto.topicType === TopicType.LIKERT_5 || dto.topicType === TopicType.LIKERT_7 ? dto.scaleMinLabel!.trim() : null,
      scaleMaxLabel: dto.topicType === TopicType.LIKERT_5 || dto.topicType === TopicType.LIKERT_7 ? dto.scaleMaxLabel!.trim() : null,
      maxSelections: dto.topicType === TopicType.MULTI_SELECT ? dto.maxSelections! : null,
      voteEndAt: new Date(Date.now() + dto.voteDurationHours * 3_600_000),
      options: { create: optionCreates },
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.topic.create({
        data,
        include: {
          options: { orderBy: { id: 'asc' } },
          contentBlocks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          creator: { select: { nickname: true, avatarUrl: true } },
        },
      });
      if (created.visibility === TopicVisibility.PUBLIC) await this.fanOutChannelNewTopic(tx, userId, created);
      const share = created.visibility === TopicVisibility.PRIVATE_LINK
        ? await this.access.createShareLink(tx, created.id)
        : null;
      return { topic: created, share };
    });
    const serialized = this.serialize(result.topic, false);
    return result.share ? { ...serialized, ...result.share } : serialized;
  }

  private prepareQuickQuestion(dto: QuickQuestionInput): Prisma.TopicOptionUncheckedCreateWithoutTopicInput[] {
    const isImageType = dto.topicType === TopicType.IMAGE_MULTIPLE || dto.topicType === TopicType.IMAGE_RANK;
    const scaleSize = dto.topicType === TopicType.STAR_RATING || dto.topicType === TopicType.LIKERT_5
      ? 5
      : dto.topicType === TopicType.LIKERT_7 ? 7 : null;
    const rawOptionLabels = scaleSize
      ? Array.from({ length: scaleSize }, (_, index) => String(index + 1))
      : (dto.options || []).map((label) => label.trim());
    const optionLabels = rawOptionLabels.filter(Boolean);
    const optionCount = isImageType ? rawOptionLabels.length : optionLabels.length;
    const matchLabels = (dto.matches || []).map((label) => label.trim()).filter(Boolean);
    const weights = (dto.weights || []).filter((weight) => Number.isFinite(weight) && weight > 0);
    optionLabels.forEach((label) => assertClean(label, '選項'));
    if (!isImageType && rawOptionLabels.some((label) => !label)) {
      throw new BadRequestException('選項不可空白');
    }
    this.assertOptionImagesLength(dto);

    const optionTypes: TopicType[] = [TopicType.BINARY, TopicType.MULTIPLE, TopicType.STAR_RATING, TopicType.LIKERT_5, TopicType.LIKERT_7, TopicType.MULTI_SELECT, TopicType.IMAGE_MULTIPLE, TopicType.IMAGE_RANK, TopicType.MATCHING, TopicType.PUZZLE, TopicType.SCRATCH, TopicType.SPIN_WHEEL, TopicType.LOTTERY];
    const noOptionTypes: TopicType[] = [TopicType.SPECTRUM, TopicType.SHORT_ANSWER];
    if (optionTypes.includes(dto.topicType) && !optionCount) {
      throw new BadRequestException('此題型必須設定選項');
    }
    if (noOptionTypes.includes(dto.topicType) && optionCount) {
      throw new BadRequestException('此題型不需設定選項');
    }
    switch (dto.topicType) {
      case TopicType.BINARY:
        if (optionCount !== 2) throw new BadRequestException('選項題（二選一）必須正好 2 個選項');
        break;
      case TopicType.MULTIPLE:
        if (optionCount < 2 || optionCount > 10) throw new BadRequestException('選項題必須設定 2 到 10 個選項');
        break;
      case TopicType.STAR_RATING:
        break;
      case TopicType.LIKERT_5:
      case TopicType.LIKERT_7:
        const scaleMinLabel = dto.scaleMinLabel?.trim();
        const scaleMaxLabel = dto.scaleMaxLabel?.trim();
        if (!scaleMinLabel || !scaleMaxLabel) {
          throw new BadRequestException('量表題必須設定最小值與最大值標籤');
        }
        assertClean(scaleMinLabel, '量表最小值標籤');
        assertClean(scaleMaxLabel, '量表最大值標籤');
        if (scaleMinLabel === scaleMaxLabel) throw new BadRequestException('量表兩端標籤不可相同');
        break;
      case TopicType.MULTI_SELECT:
        if (optionCount < 2 || optionCount > 10) throw new BadRequestException('複選題必須設定 2 到 10 個選項');
        if (!dto.maxSelections || dto.maxSelections > optionCount) {
          throw new BadRequestException('複選題最多可選數量必須介於 1 與選項數量之間');
        }
        break;
      case TopicType.IMAGE_MULTIPLE:
        if (optionCount < 2 || optionCount > 10) throw new BadRequestException('圖片選項題必須設定 2 到 10 個選項');
        break;
      case TopicType.IMAGE_RANK:
        if (optionCount < 4 || optionCount > 50) throw new BadRequestException('二選一排名賽必須設定 4 到 50 張圖片');
        break;
      case TopicType.MATCHING:
        if (optionCount < 2 || optionCount > 6) throw new BadRequestException('連連看必須設定 2 到 6 組配對');
        if (matchLabels.length !== optionCount) throw new BadRequestException('連連看的右側配對需與左側一一對應、數量相同');
        matchLabels.forEach((label) => assertClean(label, '配對'));
        break;
      case TopicType.PUZZLE:
        if (optionCount < 2 || optionCount > 4) throw new BadRequestException('拼圖題必須設定 2 到 4 個提示');
        break;
      case TopicType.SCRATCH:
        if (optionCount < 1 || optionCount > 9) throw new BadRequestException('刮刮樂必須設定 1 到 9 張卡片');
        break;
      case TopicType.SPIN_WHEEL:
        if (optionCount < 2 || optionCount > 8) throw new BadRequestException('轉盤抽獎必須設定 2 到 8 個選項');
        if (weights.length !== 0 && weights.length !== optionCount) throw new BadRequestException('轉盤權重數量需與選項相同');
        break;
      case TopicType.LOTTERY:
        if (optionCount < 2 || optionCount > 10) throw new BadRequestException('日式搖獎必須設定 2 到 10 顆球');
        break;
    }
    if (!isImageType && optionLabels.length && new Set(optionLabels).size !== optionLabels.length) {
      throw new BadRequestException('選項不可重複');
    }
    if (matchLabels.length && new Set(matchLabels).size !== matchLabels.length) {
      throw new BadRequestException('右側配對不可重複');
    }

    return (isImageType ? rawOptionLabels : optionLabels).map((label, index) => {
      const optionData: Record<string, string | number> = {};
      if (scaleSize) optionData.value = index + 1;
      if (!isImageType && matchLabels.length === optionCount) optionData.match = matchLabels[index];
      if (!isImageType && weights.length === optionCount) optionData.weight = weights[index];
      const imageUrl = this.optionImageAt(dto, index);
      if (imageUrl) optionData.imageUrl = imageUrl;
      return { label, ...(Object.keys(optionData).length ? { data: optionData } : {}) };
    });
  }

  async createSurvey(userId: bigint, dto: CreateSurveyDto) {
    await this.policy.assertSeniorMember(userId);
    const title = dto.title.trim();
    assertClean(title, '標題');
    const questions = dto.questions.map((question) => {
      const questionTitle = question.title.trim();
      assertClean(questionTitle, '題目');
      return { question, questionTitle, optionCreates: this.prepareQuickQuestion(question) };
    });

    await this.categories.assertActiveCategory('quick');

    const duplicate = await this.prisma.topic.findFirst({
      where: { title: { equals: title, mode: 'insensitive' }, moderationStatus: { not: 'REJECTED' } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('已有相同標題的議題，請先參與既有討論');

    const voteEndAt = new Date(Date.now() + dto.voteDurationHours * 3_600_000);
    const audience = dto.audience ?? TopicAudience.MEMBER_ONLY;
    const visibility = dto.visibility ?? TopicVisibility.PUBLIC;

    const result = await this.prisma.$transaction(async (tx) => {
      const parent = await tx.topic.create({
        data: {
          title,
          kind: TopicKind.SURVEY,
          topicType: TopicType.SURVEY,
          category: 'quick',
          status: 'OPEN',
          moderationStatus: 'APPROVED',
          creatorId: userId,
          audienceOwnerId: userId,
          audience,
          visibility,
          voteDurationHours: dto.voteDurationHours,
          minVotes: dto.minVotes ?? null,
          voteEndAt,
        },
        include: {
          options: { orderBy: { id: 'asc' } },
          creator: { select: { nickname: true, avatarUrl: true } },
        },
      });
      for (const [index, item] of questions.entries()) {
        await tx.topic.create({
          data: {
            title: item.questionTitle,
            kind: TopicKind.QUICK,
            parentTopicId: parent.id,
            sortOrder: index,
            category: 'quick',
            topicType: item.question.topicType,
            description: item.question.topicType === TopicType.SHORT_ANSWER ? item.question.prompt?.trim() || null : null,
            status: 'OPEN',
            moderationStatus: 'APPROVED',
            creatorId: userId,
            audienceOwnerId: userId,
            audience,
            visibility,
            voteDurationHours: dto.voteDurationHours,
            voteEndAt,
            scaleMinLabel: item.question.topicType === TopicType.LIKERT_5 || item.question.topicType === TopicType.LIKERT_7 ? item.question.scaleMinLabel!.trim() : null,
            scaleMaxLabel: item.question.topicType === TopicType.LIKERT_5 || item.question.topicType === TopicType.LIKERT_7 ? item.question.scaleMaxLabel!.trim() : null,
            maxSelections: item.question.topicType === TopicType.MULTI_SELECT ? item.question.maxSelections! : null,
            options: { create: item.optionCreates },
          },
        });
      }
      if (visibility === TopicVisibility.PUBLIC) await this.fanOutChannelNewTopic(tx, userId, parent);
      const share = visibility === TopicVisibility.PRIVATE_LINK
        ? await this.access.createShareLink(tx, parent.id)
        : null;
      return { parent, share };
    });

    const serialized = this.serialize(result.parent, false);
    return { ...serialized, questionCount: questions.length, ...(result.share ?? {}) };
  }

  private async fanOutChannelNewTopic(tx: Prisma.TransactionClient, channelOwnerId: bigint, topic: { id: bigint; kind: TopicKind; title: string }) {
    const followers = await tx.channelFollow.findMany({
      where: { channelOwnerId },
      select: { followingId: true },
    });
    if (followers.length === 0) return;
    const kindLabel = topic.kind === TopicKind.QUICK ? '快問' : topic.kind === TopicKind.SURVEY ? '問卷' : '議題';
    const creator = await tx.user.findUnique({
      where: { id: channelOwnerId },
      select: { nickname: true },
    });
    for (let index = 0; index < followers.length; index += 1000) {
      await tx.notification.createMany({
        data: followers.slice(index, index + 1000).map(({ followingId }) => ({
          userId: followingId,
          type: NotificationType.CHANNEL_NEW_TOPIC,
          title: `「${creator?.nickname ?? '成員'}」發布了新${kindLabel}`,
          message: topic.title,
          topicId: topic.id,
        })),
      });
    }
  }


  async listQuick(userId: bigint | null = null) {
    const topics = await this.prisma.topic.findMany({
      where: {
        kind: TopicKind.QUICK,
        parentTopicId: null,
        status: 'OPEN',
        moderationStatus: 'APPROVED',
        voteEndAt: { gt: new Date() },
        AND: [this.access.discoveryWhere(userId)],
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 8,
      include: {
        options: { orderBy: { id: 'asc' } },
        creator: { select: { nickname: true, avatarUrl: true } },
      },
    });
    return topics.map((topic) => this.serialize(topic, false));
  }

  async listQuickMine(userId: bigint, pageInput: number, limitInput: number) {
    const page = Math.max(1, pageInput);
    const limit = Math.min(50, Math.max(1, limitInput));
    const where: Prisma.TopicWhereInput = { kind: TopicKind.QUICK, parentTopicId: null, creatorId: userId };
    const [items, total] = await Promise.all([
      this.prisma.topic.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          options: { orderBy: { id: 'asc' } },
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

  async listSurveysMine(userId: bigint, pageInput: number, limitInput: number) {
    const page = Math.max(1, pageInput);
    const limit = Math.min(50, Math.max(1, limitInput));
    const where: Prisma.TopicWhereInput = { kind: TopicKind.SURVEY, creatorId: userId };
    const [items, total] = await Promise.all([
      this.prisma.topic.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          options: { orderBy: { id: 'asc' } },
          creator: { select: { nickname: true, avatarUrl: true } },
          _count: { select: { questions: true } },
        },
      }),
      this.prisma.topic.count({ where }),
    ]);
    return {
      items: items.map((topic) => ({ ...this.serialize(topic, false), surveyQuestionCount: topic._count.questions })),
      pagination: { page, limit, total },
    };
  }

  async listMine(userId: bigint, page: number, limit: number) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const where = { creatorId: userId, kind: TopicKind.FORMAL };
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
    this.assertOptionImagesLength(dto);
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
          audience: dto.audience ?? TopicAudience.MEMBER_ONLY,
          options:
            dto.topicType === TopicType.SPECTRUM
              ? undefined
              : { create: (dto.options || []).map((label, index) => ({ label: label.trim(), data: this.optionImageData(dto, index) })) },
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
      include: { creator: { select: { nickname: true, avatarUrl: true } } },
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
    const audience = applications.length ? applications[0].audience : (dto.audience ?? TopicAudience.MEMBER_ONLY);
    const memberSubmitterIds = new Set(applications.filter((application) => application.applicantType === 'MEMBER').map((application) => application.submitterId.toString()));
    const audienceOwnerId = applications.length > 0 && memberSubmitterIds.size === 1 && applications.every((application) => application.applicantType === 'MEMBER')
      ? applications[0].submitterId
      : null;
    if (audience === TopicAudience.FOLLOWERS_ONLY && !audienceOwnerId) {
      throw new BadRequestException('追蹤者限定議題必須由會員提案建立');
    }
    if (audience === TopicAudience.FOLLOWERS_ONLY && applications.some((application) => application.submitterId !== audienceOwnerId)) {
      throw new BadRequestException('不同發布者的追蹤者限定提案不可合併');
    }
    if (applications.some((application) => application.audience !== audience)) {
      throw new BadRequestException('不同查看資格的議題提案不可合併');
    }
    const scope = organizationId ? { organizationId } : {};
    await this.policy.assert(userId, Capability.TOPIC_DRAFT, scope);
    if (options.publish) await this.policy.assert(userId, Capability.TOPIC_PUBLISH, scope);

    this.validateTopicInput(dto);
    this.assertOptionImagesLength(dto);
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
          audienceOwnerId,
          audience,
          visibility: TopicVisibility.PUBLIC,
          description: dto.description?.trim() || null,
          category: dto.category,
          topicType: dto.topicType,
          status: options.publish ? 'OPEN' : 'DRAFT',
          moderationStatus: 'APPROVED',
          voteDurationDays: dto.voteDurationDays,
          voteEndAt: options.publish ? new Date(Date.now() + dto.voteDurationDays * 86_400_000) : null,
          options: dto.topicType === TopicType.SPECTRUM
            ? undefined
            : { create: (dto.options || []).map((label, index) => ({ label: label.trim(), data: this.optionImageData(dto, index) })) },
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
          audienceOwner: { select: { nickname: true, avatarUrl: true } },
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
      if (options.publish && audienceOwnerId) await this.fanOutChannelNewTopic(tx, audienceOwnerId, created);
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
    this.assertOptionImagesLength(dto);
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
            : { create: (dto.options || []).map((label, index) => ({ label: label.trim(), data: this.optionImageData(dto, index) })) },
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
          audienceOwner: { select: { nickname: true, avatarUrl: true } },
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
      if (existing.audienceOwnerId) await this.fanOutChannelNewTopic(tx, existing.audienceOwnerId, published);
      return published;
    });
    return this.serialize(topic, false);
  }

  async vote(topicId: bigint, userId: bigint, dto: VoteDto): Promise<VoteResult> {
    await this.policy.assertPublicAction(userId, 'VOTE');
    await this.assertTopicInteraction(topicId, userId);
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

      const lock = await tx.$queryRaw<
        Array<{ id: bigint; points_balance: bigint }>
      >`SELECT id, points_balance FROM users WHERE id = ${userId} FOR UPDATE`;

      let optionId: bigint | null = null;
      let optionIds: bigint[] = [];
      let spectrumValue: number | null = null;
      let answerText: string | null = null;

      if (topic.topicType === TopicType.MULTI_SELECT) {
        optionIds = this.validateMultiSelect(topic, dto.optionIds);
      } else if (topic.topicType === 'SPECTRUM') {
        if (dto.spectrumValue === undefined || dto.spectrumValue === null) {
          throw new BadRequestException('光譜題必須提供 spectrumValue（0~100）');
        }
        spectrumValue = dto.spectrumValue;
      } else if (topic.topicType === 'SHORT_ANSWER') {
        const text = dto.answerText?.trim();
        if (!text) throw new BadRequestException('簡答題必須提供文字回答');
        answerText = text;
      } else {
        if (!dto.optionId) throw new BadRequestException('必須選擇一個選項');
        const chosenOptionId = BigInt(dto.optionId);
        const valid = topic.options.some((o) => o.id === chosenOptionId);
        if (!valid) throw new BadRequestException('選項不存在於此議題');
        optionId = chosenOptionId;
      }

      const createdVote = await tx.vote.create({ data: { userId, topicId, optionId, spectrumValue, answerText } });

      if (optionIds.length) {
        await tx.voteSelection.createMany({
          data: optionIds.map((selectedOptionId) => ({ voteId: createdVote.id, optionId: selectedOptionId })),
        });
      }

      for (const selectedOptionId of optionId ? [optionId] : optionIds) {
        await tx.topicOption.update({ where: { id: selectedOptionId }, data: { voteCount: { increment: 1 } } });
      }

      await tx.topic.update({
        where: { id: topicId },
        data: { totalVotes: { increment: 1 }, voterCount: { increment: 1 } },
      });

      const before = lock[0]?.points_balance ?? BigInt(0);
      let rewardPoints = 0;
      let rewardTopicId = topicId;
      let rewardTitle = topic.title;
      if (topic.parentTopicId == null) {
        rewardPoints = configuredRewardPoints;
      } else if (await this.isSurveyComplete(tx, topic.parentTopicId, userId)) {
        const parent = await tx.topic.findUnique({ where: { id: topic.parentTopicId }, select: { title: true } });
        await this.ensureSurveyCompletionVote(tx, topic.parentTopicId, userId);
        rewardPoints = configuredRewardPoints;
        rewardTopicId = topic.parentTopicId;
        rewardTitle = parent?.title ?? topic.title;
      }
      const idempotencyKey = topic.parentTopicId != null
        ? `SURVEY_${topic.parentTopicId}_${userId}`
        : `VOTE_${topicId}_${userId}`;
      if (rewardPoints > 0) {
        const alreadyGranted = await tx.pointTransaction.findFirst({ where: { idempotencyKey }, select: { id: true } });
        if (alreadyGranted) rewardPoints = 0;
      }
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
            referenceId: rewardTopicId.toString(),
            idempotencyKey,
            note: `投票獎勵：${rewardTitle}`,
          },
        });
        await tx.user.update({ where: { id: userId }, data: { pointsBalance: after } });
      }

      return {
        voteId: createdVote.id,
        votedAt: createdVote.createdAt,
        after,
        optionId: optionId?.toString() ?? null,
        optionIds: optionIds.map(String),
        answerText,
        rewardPoints,
        topicType: topic.topicType,
      };
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
      optionIds: result.optionIds,
      spectrumValue: dto.spectrumValue ?? null,
      answerText: result.answerText,
      rewardPoints: result.rewardPoints,
      newBalance: result.after.toString(),
    };
  }

  async revote(topicId: bigint, userId: bigint, dto: VoteDto): Promise<VoteResult> {
    await this.policy.assertPublicAction(userId, 'VOTE');
    await this.assertTopicInteraction(topicId, userId);

    interface RevoteTransaction {
      voteId: bigint;
      optionId: string | null;
      optionIds: string[];
      spectrumValue: number | null;
      answerText: string | null;
      newBalance: bigint;
      changed: boolean;
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

      const existing = await tx.vote.findUnique({
        where: { userId_topicId: { userId, topicId } },
        include: { selections: { select: { optionId: true } } },
      });
      if (!existing) throw new NotFoundException('尚未投票，無法更改');

      let optionId: bigint | null = null;
      let optionIds: bigint[] = [];
      let spectrumValue: number | null = null;
      let answerText: string | null = null;
      if (topic.topicType === TopicType.MULTI_SELECT) {
        optionIds = this.validateMultiSelect(topic, dto.optionIds);
      } else if (topic.topicType === 'SPECTRUM') {
        if (dto.spectrumValue === undefined || dto.spectrumValue === null) {
          throw new BadRequestException('光譜題必須提供 spectrumValue（0~100）');
        }
        spectrumValue = dto.spectrumValue;
      } else if (topic.topicType === 'SHORT_ANSWER') {
        const text = dto.answerText?.trim();
        if (!text) throw new BadRequestException('簡答題必須提供文字回答');
        answerText = text;
      } else {
        if (!dto.optionId) throw new BadRequestException('必須選擇一個選項');
        const chosenOptionId = BigInt(dto.optionId);
        const valid = topic.options.some((o) => o.id === chosenOptionId);
        if (!valid) throw new BadRequestException('選項不存在於此議題');
        optionId = chosenOptionId;
      }
      const existingOptionIds = existing.selections.map((selection) => selection.optionId);
      const sameAnswer = topic.topicType === TopicType.MULTI_SELECT
        ? this.sameBigIntSet(existingOptionIds, optionIds)
        : topic.topicType === 'SHORT_ANSWER'
          ? existing.answerText === answerText
          : topic.topicType === 'SPECTRUM'
            ? existing.spectrumValue === spectrumValue
          : existing.optionId !== null && existing.optionId === optionId;
      if (sameAnswer) {
        const unchanged = await tx.user.findUnique({ where: { id: userId }, select: { pointsBalance: true } });
        return {
          voteId: existing.id,
          optionId: existing.optionId?.toString() ?? null,
          optionIds: existingOptionIds.map(String),
          spectrumValue: existing.spectrumValue,
          answerText: existing.answerText,
          newBalance: unchanged?.pointsBalance ?? BigInt(0),
          changed: false,
        };
      }

      if (topic.topicType === TopicType.MULTI_SELECT) {
        const previous = new Set(existingOptionIds.map(String));
        const next = new Set(optionIds.map(String));
        const removed = existingOptionIds.filter((id) => !next.has(id.toString()));
        const added = optionIds.filter((id) => !previous.has(id.toString()));
        if (removed.length) {
          await tx.voteSelection.deleteMany({ where: { voteId: existing.id, optionId: { in: removed } } });
        }
        if (added.length) {
          await tx.voteSelection.createMany({
            data: added.map((selectedOptionId) => ({ voteId: existing.id, optionId: selectedOptionId })),
          });
        }
        for (const removedOptionId of removed) {
          await tx.topicOption.update({ where: { id: removedOptionId }, data: { voteCount: { decrement: 1 } } });
        }
        for (const addedOptionId of added) {
          await tx.topicOption.update({ where: { id: addedOptionId }, data: { voteCount: { increment: 1 } } });
        }
        await tx.topic.update({ where: { id: topicId }, data: { updatedAt: new Date() } });
        const user = await tx.user.findUnique({ where: { id: userId }, select: { pointsBalance: true } });
        return {
          voteId: existing.id,
          optionId: null,
          optionIds: optionIds.map(String),
          spectrumValue: null,
          answerText: null,
          newBalance: user?.pointsBalance ?? BigInt(0),
          changed: true,
        };
      }

      if (existing.optionId) {
        await tx.topicOption.update({
          where: { id: existing.optionId },
          data: { voteCount: { decrement: 1 } },
        });
      }
      await tx.vote.delete({ where: { id: existing.id } });
      const createdVote = await tx.vote.create({ data: { userId, topicId, optionId, spectrumValue, answerText } });
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
        optionIds: [],
        spectrumValue,
        answerText,
        newBalance: user?.pointsBalance ?? BigInt(0),
        changed: true,
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
      optionIds: result.optionIds,
      spectrumValue: result.spectrumValue,
      answerText: result.answerText,
      rewardPoints: 0,
      newBalance: result.newBalance.toString(),
    };
  }

  async saveRank(topicId: bigint, userId: bigint, dto: SaveRankDto) {
    await this.policy.assertPublicAction(userId, 'VOTE');
    await this.assertTopicInteraction(topicId, userId);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${userId})`;
      const lockedTopic = await tx.$queryRaw<Array<{ id: bigint }>>`SELECT id FROM topics WHERE id = ${topicId} FOR UPDATE`;
      if (!lockedTopic.length) throw new NotFoundException('議題不存在');
      const topic = await tx.topic.findUnique({ where: { id: topicId }, include: { options: { select: { id: true } } } });
      if (!topic) throw new NotFoundException('議題不存在');
      if (topic.topicType !== TopicType.IMAGE_RANK) throw new BadRequestException('此題型不支援排名結果');
      if (topic.status !== 'OPEN') throw new ForbiddenException('議題不在開放狀態');
      if (topic.moderationStatus !== 'APPROVED') throw new ForbiddenException('議題尚未通過複核');
      if (!topic.voteEndAt || topic.voteEndAt.getTime() <= Date.now()) throw new ForbiddenException('議題已截止');

      const validIds = new Set(topic.options.map((option) => option.id.toString()));
      if (!dto.ranking.length || dto.ranking.length !== topic.options.length) {
        throw new BadRequestException('排名必須完整覆蓋全部選項');
      }
      if (new Set(dto.ranking).size !== dto.ranking.length) {
        throw new BadRequestException('排名不可重複');
      }
      for (const id of dto.ranking) {
        if (!validIds.has(String(id))) throw new BadRequestException('排名中包含不屬於此議題的選項');
      }

      const ranking = dto.ranking.map((id) => String(id));
      const previous = await tx.topicRankResult.findUnique({
        where: { userId_topicId: { userId, topicId: topic.id } },
        select: { id: true },
      });

      await tx.topicRankResult.upsert({
        where: { userId_topicId: { userId, topicId: topic.id } },
        create: { userId, topicId: topic.id, ranking, comparisons: dto.comparisons ?? 0 },
        update: { ranking, comparisons: dto.comparisons ?? 0 },
      });

      if (!previous) {
        await tx.topic.update({ where: { id: topic.id }, data: { voterCount: { increment: 1 } } });
        if (topic.parentTopicId && await this.isSurveyComplete(tx, topic.parentTopicId, userId)) {
          await this.ensureSurveyCompletionVote(tx, topic.parentTopicId, userId);
        }
      }

      return { isNew: !previous };
    });

    const playCount = await this.prisma.topicRankResult.count({ where: { topicId } });
    return { success: true, rewardPoints: 0, isNew: result.isNew, playCount };
  }

  async communityRanking(topicId: bigint, userId: bigint | null = null) {
    const topic = await this.publicTopicIdentity(topicId, userId);
    const rows = await this.prisma.$queryRaw<Array<{ optionId: string; avgRank: number; plays: bigint }>>`
      SELECT rank_entry.value AS "optionId",
             AVG(rank_entry.position) AS "avgRank",
             COUNT(*)::bigint AS plays
      FROM topic_rank_results
      CROSS JOIN LATERAL jsonb_array_elements_text(ranking) WITH ORDINALITY AS rank_entry(value, position)
      WHERE topic_id = ${topic.id}
      GROUP BY rank_entry.value
      ORDER BY AVG(rank_entry.position) ASC, rank_entry.value ASC
      `;
    const playCount = await this.prisma.topicRankResult.count({ where: { topicId: topic.id } });
    return {
      topicId: topicId.toString(),
      playCount: Number(playCount),
      ranking: rows.map((row) => ({
        optionId: row.optionId,
        rank: Number(row.avgRank),
        plays: Number(row.plays),
      })),
    };
  }

  private async isSurveyComplete(tx: Prisma.TransactionClient, parentTopicId: bigint, userId: bigint): Promise<boolean> {
    const questions = await tx.topic.findMany({
      where: { parentTopicId },
      select: { id: true, topicType: true },
    });
    if (questions.length === 0) return false;
    const voteIds = questions.filter((question) => question.topicType !== 'IMAGE_RANK').map((question) => question.id);
    const rankIds = questions.filter((question) => question.topicType === 'IMAGE_RANK').map((question) => question.id);
    const [voted, ranked] = await Promise.all([
      voteIds.length ? tx.vote.count({ where: { userId, topicId: { in: voteIds } } }) : Promise.resolve(0),
      rankIds.length ? tx.topicRankResult.count({ where: { userId, topicId: { in: rankIds } } }) : Promise.resolve(0),
    ]);
    return voted + ranked >= questions.length;
  }

  private async ensureSurveyCompletionVote(tx: Prisma.TransactionClient, parentTopicId: bigint, userId: bigint) {
    const existing = await tx.vote.findUnique({
      where: { userId_topicId: { userId, topicId: parentTopicId } },
      select: { id: true },
    });
    if (existing) return;
    await tx.vote.create({ data: { userId, topicId: parentTopicId } });
    await tx.topic.update({
      where: { id: parentTopicId },
      data: { totalVotes: { increment: 1 }, voterCount: { increment: 1 } },
    });
  }

  private validateMultiSelect(
    topic: { options: Array<{ id: bigint }>; maxSelections: number | null },
    input: number[] | undefined,
  ): bigint[] {
    const optionIds = [...new Set(input ?? [])].map(BigInt);
    if (!optionIds.length) throw new BadRequestException('複選題至少必須選擇一個選項');
    if (!topic.maxSelections || optionIds.length > topic.maxSelections) {
      throw new BadRequestException(`複選題最多可選 ${topic.maxSelections ?? 0} 個選項`);
    }
    const validOptionIds = new Set(topic.options.map((option) => option.id.toString()));
    if (optionIds.some((optionId) => !validOptionIds.has(optionId.toString()))) {
      throw new BadRequestException('選項不存在於此議題');
    }
    return optionIds;
  }

  private sameBigIntSet(left: bigint[], right: bigint[]) {
    return left.length === right.length && new Set(left.map(String)).size === right.length && right.every((id) => left.some((item) => item === id));
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

  private validateTopicInput(dto: CreateTopicDto) {
    const imageType = dto.topicType === 'IMAGE_MULTIPLE' || dto.topicType === 'IMAGE_RANK';
    const rawOptions = dto.options || [];
    const options = rawOptions.map((option) => option.trim());
    if (!imageType && options.some((option) => !option)) {
      throw new BadRequestException('選項不可空白');
    }
    const filledOptions = options.filter(Boolean);
    if (dto.topicType === 'SPECTRUM' && filledOptions.length > 0) {
      throw new BadRequestException('光譜題不需要設定選項');
    }
    if (dto.topicType === 'BINARY' && filledOptions.length !== 2) {
      throw new BadRequestException('二元題必須設定 2 個選項');
    }
    if (dto.topicType === 'MULTIPLE' && (filledOptions.length < 2 || filledOptions.length > 6)) {
      throw new BadRequestException('多選題必須設定 2 到 6 個選項');
    }
    if (imageType && (rawOptions.length < 2 || rawOptions.length > 6)) {
      throw new BadRequestException('圖片選項題必須設定 2 到 6 個選項');
    }
    if (!imageType && new Set(filledOptions).size !== filledOptions.length) {
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
      const transitioned = await tx.topic.updateMany({
        where: { id: topicId, moderationStatus: 'PENDING_REVIEW' },
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
      });
      if (transitioned.count !== 1) throw new BadRequestException('此議題已完成複核');
      const reviewed = await tx.topic.findUniqueOrThrow({
        where: { id: topicId },
        include: {
          options: { orderBy: { id: 'asc' } },
          contentBlocks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          creator: { select: { nickname: true, avatarUrl: true } },
        },
      });
      if (moderationStatus === 'APPROVED' && existing.creatorId != null) {
        await this.fanOutChannelNewTopic(tx, existing.creatorId, reviewed);
      }
      return reviewed;
    });
    return this.serialize(topic, false);
  }

  private assertOptionImagesLength(dto: { topicType: TopicType; options?: string[]; optionImages?: (string | null)[] }) {
    if (dto.topicType === TopicType.IMAGE_MULTIPLE || dto.topicType === TopicType.IMAGE_RANK) {
      const kindLabel = dto.topicType === TopicType.IMAGE_MULTIPLE ? '圖片選項題' : '二選一排名賽';
      const count = (dto.options || []).length;
      if (!dto.optionImages || dto.optionImages.length !== count) {
        throw new BadRequestException(`${kindLabel}必須為每個選項提供圖片`);
      }
      for (const imageUrl of dto.optionImages) {
        if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('/api/v1/option-images/')) {
          throw new BadRequestException(`${kindLabel}的每個選項都必須是指定格式的圖片路徑`);
        }
      }
      return;
    }
    if (dto.optionImages?.some(Boolean)) {
      throw new BadRequestException('此題型不支援選項圖片');
    }
  }

  private optionImageAt(dto: { optionImages?: (string | null)[] }, index: number): string | null {
    return dto.optionImages?.[index] && dto.optionImages[index] !== null ? dto.optionImages[index]! : null;
  }

  private optionImageData(dto: { topicType: TopicType; optionImages?: (string | null)[] }, index: number) {
    if (dto.topicType !== TopicType.IMAGE_MULTIPLE && dto.topicType !== TopicType.IMAGE_RANK) return undefined;
    const imageUrl = this.optionImageAt(dto, index);
    return imageUrl ? { imageUrl } : undefined;
  }

  private appendAnd(where: Prisma.TopicWhereInput, condition: Prisma.TopicWhereInput) {
    const existing = where.AND;
    where.AND = [
      ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
      condition,
    ];
  }

  private async assertTopicInteraction(topicId: bigint, userId: bigint) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      select: { id: true, kind: true, visibility: true, audience: true, audienceOwnerId: true },
    });
    if (!topic) throw new NotFoundException('議題不存在');
    await this.access.assertCanInteract(topic, userId);
  }

  private voteChoice(vote: {
    option: { label: string } | null;
    spectrumValue: number | null;
    answerText: string | null;
    selections: Array<{ option: { label: string } }>;
  }) {
    if (vote.selections.length) return vote.selections.map((selection) => selection.option.label).join('、');
    if (vote.option) return vote.option.label;
    if (vote.spectrumValue !== null) return `${vote.spectrumValue} 分`;
    return vote.answerText ?? '';
  }

  private serialize(topic: any, hasVoted: boolean, isFollowing = false, myRankData: { ranking: string[]; comparisons: number } | null = null) {
    return {
      id: topic.id.toString(),
      title: topic.title,
      description: topic.description,
      category: topic.category,
      kind: topic.kind,
      visibility: topic.visibility ?? TopicVisibility.PUBLIC,
      audience: topic.audience ?? TopicAudience.MEMBER_ONLY,
      featuredOrder: topic.featuredOrder ?? null,
      topicType: topic.topicType,
      status: topic.status,
      moderationStatus: topic.moderationStatus,
      moderationNote: topic.moderationNote ?? null,
      creator:
        topic.audienceOwnerId && topic.audienceOwner
          ? {
              id: topic.audienceOwnerId.toString(),
              nickname: topic.audienceOwner.nickname,
              avatarUrl: resolveAvatarUrl(topic.audienceOwner.avatarUrl),
              type: 'MEMBER',
            }
          :           topic.creatorId && topic.creator && (
          topic.kind === TopicKind.QUICK ||
          topic.kind === TopicKind.SURVEY ||
          topic.reviewedAt ||
          topic.moderationStatus === 'PENDING_REVIEW'
        )
          ? {
              id: topic.creatorId.toString(),
              nickname: topic.creator.nickname,
              avatarUrl: resolveAvatarUrl(topic.creator.avatarUrl),
              type: 'MEMBER',
            }
          : { id: null, nickname: '議題小組', avatarUrl: null, type: 'OFFICIAL' },
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
      scaleMinLabel: topic.scaleMinLabel ?? null,
      scaleMaxLabel: topic.scaleMaxLabel ?? null,
      maxSelections: topic.maxSelections ?? null,
      totalVotes: topic.totalVotes.toString(),
      voterCount: topic.voterCount.toString(),
      spectrumMedian: topic.spectrumMedian?.toString() ?? null,
      spectrumStddev: topic.spectrumStddev?.toString() ?? null,
      hasVoted,
      isFollowing,
      myRanking: myRankData?.ranking ?? null,
      myRankingComparisons: myRankData?.comparisons ?? 0,
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
        data: o.data ?? null,
      })),
    };
  }
}

function disclosed<T>(value: T | null | undefined): T | null {
  return value === undefined || value === null || String(value) === 'PREFER_NOT_TO_SAY' ? null : value;
}

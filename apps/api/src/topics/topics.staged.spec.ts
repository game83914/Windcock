import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TopicKind, TopicType } from '@prisma/client';
import { TopicsService } from './topics.service';

function stagedDto(overrides: Record<string, unknown> = {}) {
  return {
    title: '連續三天的晚餐抉擇挑戰',
    totalRounds: 3,
    voteDurationHours: 24,
    question: { title: '今晚想吃什麼', topicType: TopicType.MULTIPLE, options: ['火鍋', '燒肉'] },
    ...overrides,
  };
}

function createService(prismaOverrides: Record<string, unknown> = {}) {
  const create = jest.fn();
  const prisma = {
    topic: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback({ topic: { create } })),
    ...prismaOverrides,
  };
  const policy = { assertSeniorMember: jest.fn().mockResolvedValue(undefined) };
  const categories = { assertActiveCategory: jest.fn().mockResolvedValue(undefined) };
  const access = { createShareLink: jest.fn().mockResolvedValue(null), assertCanView: jest.fn().mockResolvedValue(undefined) };
  const service = new TopicsService(
    prisma as never,
    {} as never,
    { incr: jest.fn().mockResolvedValue(1), expire: jest.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    policy as never,
    categories as never,
    access as never,
  );
  jest.spyOn(service as never as { serialize: () => unknown }, 'serialize').mockReturnValue({ id: '10' });
  jest.spyOn(service as never as { fanOutChannelNewTopic: () => Promise<void> }, 'fanOutChannelNewTopic').mockResolvedValue(undefined);
  return { service, create, prisma };
}

describe('TopicsService createStaged', () => {
  it('creates a STAGED parent plus a first QUICK round with sortOrder 0', async () => {
    const { service, create } = createService();
    create
      .mockResolvedValueOnce({ id: 10n, title: '連續三天的晚餐抉擇挑戰' })
      .mockResolvedValue({ id: 11n });

    const result = await service.createStaged(1n, stagedDto() as never);

    expect(result).toEqual({ id: '10', totalRounds: 3, currentRound: 1 });
    expect(create).toHaveBeenCalledTimes(2);

    const parentData = create.mock.calls[0][0].data;
    expect(parentData.kind).toBe(TopicKind.STAGED);
    expect(parentData.topicType).toBe(TopicType.STAGED);
    expect(parentData.category).toBe('quick');
    expect(parentData.status).toBe('OPEN');
    expect(parentData.moderationStatus).toBe('APPROVED');
    expect(parentData.totalRounds).toBe(3);
    expect(parentData.parentTopicId).toBeUndefined();

    const firstRound = create.mock.calls[1][0].data;
    expect(firstRound.kind).toBe(TopicKind.QUICK);
    expect(firstRound.parentTopicId).toBe(10n);
    expect(firstRound.sortOrder).toBe(0);
    expect(firstRound.status).toBe('OPEN');
    expect(firstRound.topicType).toBe(TopicType.MULTIPLE);
    expect(firstRound.options.create.map((option: { label: string }) => option.label)).toEqual(['火鍋', '燒肉']);
    expect(firstRound.voteEndAt).toBeInstanceOf(Date);
  });
});

describe('TopicsService publishRound', () => {
  const roundDto = () => ({
    feedback: '上一回合火鍋勝出，今晚換個口味吧',
    question: { title: '明晚想吃什麼', topicType: TopicType.MULTIPLE, options: ['壽司', '拉麵'] },
  });

  function parentWithRounds(roundCount: number, ownerId = 1n, totalRounds = 3) {
    return {
      id: 10n,
      kind: TopicKind.STAGED,
      status: 'OPEN',
      creatorId: ownerId,
      audienceOwnerId: ownerId,
      audience: 'MEMBER_ONLY',
      visibility: 'PUBLIC',
      voteDurationHours: 24,
      totalRounds,
      questions: Array.from({ length: roundCount }, (_, index) => ({ id: BigInt(11 + index), sortOrder: index, status: 'OPEN' })),
    };
  }

  function publishService(parent: unknown) {
    const update = jest.fn().mockResolvedValue({});
    const create = jest.fn().mockResolvedValue({ id: 20n });
    const prisma = {
      topic: { findFirst: jest.fn().mockResolvedValue(parent) },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback({ topic: { update, create } })),
    };
    const service = new TopicsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(service as never as { serialize: () => unknown }, 'serialize').mockReturnValue({ id: '20' });
    return { service, update, create, prisma };
  }

  it('locks the previous round with feedback and opens the next round', async () => {
    const { service, update, create } = publishService(parentWithRounds(1));

    const result = await service.publishRound(10n, 1n, roundDto() as never);

    expect(result).toEqual({ id: '20', roundNumber: 2 });
    expect(update).toHaveBeenCalledWith({
      where: { id: 11n },
      data: { status: 'LOCKED', roundFeedback: '上一回合火鍋勝出，今晚換個口味吧' },
    });
    const newRound = create.mock.calls[0][0].data;
    expect(newRound.kind).toBe(TopicKind.QUICK);
    expect(newRound.parentTopicId).toBe(10n);
    expect(newRound.sortOrder).toBe(1);
    expect(newRound.status).toBe('OPEN');
    expect(newRound.voteEndAt.getTime()).toBeGreaterThan(Date.now());
    expect(update).toHaveBeenCalledWith({ where: { id: 10n }, data: { voteEndAt: newRound.voteEndAt } });
  });

  it('rejects publishing beyond totalRounds', async () => {
    const { service, create } = publishService(parentWithRounds(3, 1n, 3));

    await expect(service.publishRound(10n, 1n, roundDto() as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a non-owner publisher', async () => {
    const { service, create, update } = publishService(parentWithRounds(1));

    await expect(service.publishRound(10n, 2n, roundDto() as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe('TopicsService finishStaged', () => {
  it('locks all rounds with final feedback on the latest round and settles the parent', async () => {
    const updateMany = jest.fn().mockResolvedValue({});
    const update = jest.fn().mockResolvedValue({});
    const settled = { id: 10n, title: '連續三天的晚餐抉擇挑戰' };
    const prisma = {
      topic: {
        findFirst: jest.fn().mockResolvedValue({
          id: 10n,
          kind: TopicKind.STAGED,
          status: 'OPEN',
          audienceOwnerId: 1n,
          totalRounds: 3,
          questions: [{ id: 11n, status: 'LOCKED' }, { id: 12n, status: 'LOCKED' }, { id: 13n, status: 'OPEN' }],
        }),
        findUnique: jest.fn().mockResolvedValue(settled),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback({ topic: { updateMany, update } })),
    };
    const service = new TopicsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    jest.spyOn(service as never as { serialize: () => unknown }, 'serialize').mockReturnValue({ id: '10' });

    const result = await service.finishStaged(10n, 1n, { feedback: '三回合挑戰結束，感謝參與' } as never);

    expect(updateMany).toHaveBeenCalledWith({
      where: { parentTopicId: 10n },
      data: { status: 'LOCKED' },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 13n },
      data: { roundFeedback: '三回合挑戰結束，感謝參與' },
    });
    expect(update).toHaveBeenCalledWith({ where: { id: 10n }, data: { status: 'SETTLED' } });
    expect(result).toEqual({ id: '10', totalRounds: 3, currentRound: 3 });
  });

  it('rejects a non-owner finisher', async () => {
    const prisma = {
      topic: {
        findFirst: jest.fn().mockResolvedValue({
          id: 10n,
          kind: TopicKind.STAGED,
          status: 'OPEN',
          audienceOwnerId: 1n,
          totalRounds: 3,
          questions: [{ id: 11n, status: 'OPEN' }],
        }),
      },
      $transaction: jest.fn(),
    };
    const service = new TopicsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.finishStaged(10n, 2n, { feedback: '結束' } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('TopicsService staged detail', () => {
  function baseTopic(overrides: Record<string, unknown> = {}) {
    return {
      id: 10n,
      title: '連續三天的晚餐抉擇挑戰',
      description: null,
      category: 'quick',
      kind: 'STAGED',
      featuredOrder: null,
      topicType: 'STAGED',
      status: 'OPEN',
      moderationStatus: 'APPROVED',
      moderationNote: null,
      creatorId: 1n,
      creator: { nickname: '會員', avatarUrl: null },
      audienceOwnerId: 1n,
      audienceOwner: null,
      visibility: 'PUBLIC',
      audience: 'MEMBER_ONLY',
      reviewedAt: null,
      createdAt: new Date('2026-09-20T00:00:00Z'),
      updatedAt: new Date('2026-09-20T00:00:00Z'),
      voteEndAt: new Date('2026-09-21T00:00:00Z'),
      voteDurationDays: 7,
      voteDurationHours: 24,
      minVotes: null,
      totalRounds: 3,
      roundFeedback: null,
      totalVotes: 0n,
      voterCount: 0n,
      spectrumMedian: null,
      spectrumStddev: null,
      contentBlocks: [],
      options: [],
      applicationResults: [],
      ...overrides,
    };
  }

  function roundTopic(id: bigint, sortOrder: number, roundFeedback: string | null) {
    return {
      ...baseTopic({ id, kind: 'QUICK', topicType: 'MULTIPLE', roundFeedback }),
      options: [{ id: 101n, label: '火鍋', voteCount: 2n, data: null }],
    };
  }

  it('returns rounds with roundNumber, roundFeedback and myVote', async () => {
    const parent = {
      ...baseTopic(),
      questions: [roundTopic(11n, 0, '首回合回饋'), roundTopic(12n, 1, null)],
    };
    const prisma = {
      topic: { findFirst: jest.fn().mockResolvedValue(parent) },
      vote: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          {
            topicId: 11n,
            optionId: 101n,
            spectrumValue: null,
            answerText: null,
            option: { label: '火鍋' },
            selections: [],
          },
        ]),
      },
      topicFollow: { findUnique: jest.fn().mockResolvedValue(null) },
      topicRankResult: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const access = { assertCanView: jest.fn().mockResolvedValue(undefined) };
    const service = new TopicsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      access as never,
    );

    const result = (await service.detail(10n, 7n)) as unknown as {
      totalRounds: number;
      currentRound: number;
      rounds: Array<{ roundNumber: number; roundFeedback: string | null; myVote: unknown }>;
    };

    expect(result.totalRounds).toBe(3);
    expect(result.currentRound).toBe(2);
    expect(result.rounds).toHaveLength(2);
    expect(result.rounds[0]).toMatchObject({ roundNumber: 1, roundFeedback: '首回合回饋' });
    expect(result.rounds[0].myVote).toMatchObject({ choice: '火鍋', optionId: '101' });
    expect(result.rounds[1]).toMatchObject({ roundNumber: 2, roundFeedback: null, myVote: null });
  });
});

describe('TopicsService staged vote guard', () => {
  it('rejects voting directly on a STAGED parent', async () => {
    const stagedTopic = { id: 10n, kind: 'STAGED', options: [] };
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 10n }]),
      topic: { findUnique: jest.fn().mockResolvedValue(stagedTopic) },
    };
    const prisma = {
      topic: { findUnique: jest.fn().mockResolvedValue({ id: 10n }) },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
    };
    const service = new TopicsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      { assertPublicAction: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      { assertCanInteract: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await expect(service.vote(10n, 1n, { optionId: '101' } as never)).rejects.toBeInstanceOf(BadRequestException);
  });
});

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TopicKind, TopicType } from '@prisma/client';
import { TopicsService } from './topics.service';

process.env.VOTE_REWARD_POINTS = '5';

function baseService(prisma: any, tx: any) {
  const fullPrisma = {
    $transaction: jest.fn((cb: (c: unknown) => unknown) => cb(tx)),
    userDemographicProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    topicOption: { findMany: jest.fn().mockResolvedValue([]) },
    topic: { findUnique: jest.fn().mockResolvedValue({ totalVotes: 1n }), ...(prisma?.topic ?? {}) },
    ...prisma,
  };
  const instance = new TopicsService(
    fullPrisma as never,
    { broadcastTopicVotes: jest.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    {} as never,
    { assertPublicAction: jest.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    { assertCanInteract: jest.fn().mockResolvedValue(undefined) } as never,
  );
  jest.spyOn(instance as never as { assertTopicInteraction: () => Promise<void> }, 'assertTopicInteraction').mockResolvedValue(undefined);
  jest.spyOn(instance as never as { createDemographicSnapshot: () => Promise<void> }, 'createDemographicSnapshot').mockResolvedValue(undefined);
  return instance;
}

function openTopic(overrides: Record<string, any> = {}) {
  return {
    id: 10n,
    title: '測試題',
    kind: TopicKind.QUICK,
    parentTopicId: null,
    topicType: TopicType.MULTIPLE,
    maxSelections: null,
    status: 'OPEN',
    moderationStatus: 'APPROVED',
    voteEndAt: new Date(Date.now() + 60_000),
    options: [{ id: 101n }, { id: 102n }],
    ...overrides,
  };
}

function voteTx(topic: any, opts: { existingVote?: any; questions?: any[]; voteCount?: number; rankCount?: number } = {}) {
  const tx: any = {
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValueOnce([{ id: 10n }]).mockResolvedValue([{ id: 1n, points_balance: 7n }]),
    topic: {
      findUnique: jest.fn().mockResolvedValue(topic),
      findMany: jest.fn().mockResolvedValue(opts.questions ?? []),
      update: jest.fn().mockResolvedValue(undefined),
    },
    vote: {
      findUnique: jest.fn().mockResolvedValue(opts.existingVote ?? null),
      create: jest.fn().mockResolvedValue({ id: 20n, createdAt: new Date() }),
      count: jest.fn().mockResolvedValue(opts.voteCount ?? 0),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    voteSelection: { createMany: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({}) },
    topicOption: { update: jest.fn().mockResolvedValue(undefined) },
    topicRankResult: { count: jest.fn().mockResolvedValue(opts.rankCount ?? 0) },
    pointTransaction: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(undefined) },
    user: { update: jest.fn().mockResolvedValue(undefined), findUnique: jest.fn().mockResolvedValue({ pointsBalance: 7n }) },
  };
  return tx;
}

describe('TopicsService vote reward gate (FORMAL only)', () => {
  it('grants configured points for FORMAL topics', async () => {
    const topic = openTopic({ kind: TopicKind.FORMAL, topicType: TopicType.MULTIPLE });
    const tx = voteTx(topic);
    const service = baseService({}, tx);

    const result = await service.vote(10n, 1n, { optionId: '101' } as never);

    expect(result.rewardPoints).toBe(5);
    expect(result.newBalance).toBe('12');
    expect(tx.pointTransaction.create).toHaveBeenCalledTimes(1);
  });

  it('returns 0 and creates no pointTransaction for QUICK single questions', async () => {
    const topic = openTopic({ kind: TopicKind.QUICK });
    const tx = voteTx(topic);
    const service = baseService({}, tx);

    const result = await service.vote(10n, 1n, { optionId: '101' } as never);

    expect(result.rewardPoints).toBe(0);
    expect(tx.pointTransaction.create).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('keeps survey completion marker count-only with 0 reward', async () => {
    const topic = openTopic({ kind: TopicKind.QUICK, parentTopicId: 9n });
    const tx = voteTx(topic, {
      questions: [{ id: 10n, topicType: 'MULTIPLE' }, { id: 11n, topicType: 'MULTIPLE' }],
      voteCount: 2,
    });
    // isSurveyComplete counts votes on child ids; ensure completion path triggers
    tx.topic.findUnique.mockResolvedValueOnce(topic).mockResolvedValue({ kind: TopicKind.SURVEY });
    tx.vote.count.mockResolvedValue(2);
    const service = baseService({}, tx);

    const result = await service.vote(10n, 1n, { optionId: '101' } as never);

    expect(result.rewardPoints).toBe(0);
    expect(tx.pointTransaction.create).not.toHaveBeenCalled();
    // completion marker retained: parent vote created + parent counters incremented
    expect(tx.vote.create).toHaveBeenCalledTimes(2);
    expect(tx.topic.update).toHaveBeenCalledWith({
      where: { id: 9n },
      data: { totalVotes: { increment: 1 }, voterCount: { increment: 1 } },
    });
  });
});

describe('TopicsService survey sub-question locks', () => {
  it('revote on a survey child is 403', async () => {
    const topic = openTopic({ parentTopicId: 9n });
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 10n }]),
      topic: { findUnique: jest.fn().mockResolvedValue(topic) },
      vote: { findUnique: jest.fn() },
    };
    const service = baseService({}, tx);
    await expect(service.revote(10n, 1n, { optionId: '101' } as never)).rejects.toMatchObject({
      status: 403,
      message: '問卷送出後不可更改',
    });
    expect(tx.vote.findUnique).not.toHaveBeenCalled();
  });

  it('second saveRank on a survey child is 403 but first save is allowed', async () => {
    const topic = {
      id: 10n,
      topicType: TopicType.IMAGE_RANK,
      status: 'OPEN',
      moderationStatus: 'APPROVED',
      voteEndAt: new Date(Date.now() + 60_000),
      parentTopicId: 9n,
      options: [{ id: 1n }, { id: 2n }],
    };
    const blockedTx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 10n }]),
      topic: { findUnique: jest.fn().mockResolvedValue(topic) },
      topicRankResult: { findUnique: jest.fn().mockResolvedValue({ id: 5n }) },
    };
    const blocked = baseService({}, blockedTx);
    await expect(blocked.saveRank(10n, 1n, { ranking: ['1', '2'] } as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(blocked.saveRank(10n, 1n, { ranking: ['1', '2'] } as never)).rejects.toMatchObject({
      message: '問卷送出後不可更改',
    });

    const firstTx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 10n }]),
      topic: {
        findUnique: jest.fn().mockResolvedValue(topic),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(undefined),
      },
      topicRankResult: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
      vote: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(0) },
    };
    const firstPrisma = {
      topicRankResult: { count: jest.fn().mockResolvedValue(1) },
      topic: { findUnique: jest.fn() },
    };
    const first = baseService(firstPrisma, firstTx);
    const res = await first.saveRank(10n, 1n, { ranking: ['1', '2'] } as never);
    expect(res.success).toBe(true);
    expect(res.isNew).toBe(true);
  });
});

describe('TopicsService withdrawVote', () => {
  function withdrawSetup(existing: any, topicOverrides: Record<string, any> = {}) {
    const topic = openTopic(topicOverrides);
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 10n }]),
      topic: { findUnique: jest.fn().mockResolvedValue(topic), update: jest.fn().mockResolvedValue(undefined) },
      vote: { findUnique: jest.fn().mockResolvedValue(existing), delete: jest.fn().mockResolvedValue(undefined) },
      voteSelection: { deleteMany: jest.fn().mockResolvedValue({}) },
      topicOption: { update: jest.fn().mockResolvedValue(undefined) },
      user: { findUnique: jest.fn().mockResolvedValue({ pointsBalance: 7n }) },
    };
    return { topic, tx };
  }

  it('decrements counters and returns balance without touching pointTransaction', async () => {
    const existing = { id: 20n, optionId: 101n, spectrumValue: null, selections: [] };
    const { tx } = withdrawSetup(existing);
    const service = baseService({}, tx);
    (service as any).prisma.pointTransaction = { create: jest.fn() };

    const result = await service.withdrawVote(10n, 1n);

    expect(result).toEqual({ success: true, newBalance: '7' });
    expect(tx.voteSelection.deleteMany).toHaveBeenCalledWith({ where: { voteId: 20n } });
    expect(tx.vote.delete).toHaveBeenCalledWith({ where: { id: 20n } });
    expect(tx.topicOption.update).toHaveBeenCalledWith({ where: { id: 101n }, data: { voteCount: { decrement: 1 } } });
    expect(tx.topic.update).toHaveBeenCalledWith({
      where: { id: 10n },
      data: { totalVotes: { decrement: 1 }, voterCount: { decrement: 1 } },
    });
  });

  it('decrements each multi-select option once', async () => {
    const existing = { id: 21n, optionId: null, spectrumValue: null, selections: [{ optionId: 1n }, { optionId: 2n }] };
    const { tx } = withdrawSetup(existing, { topicType: TopicType.MULTI_SELECT });
    const service = baseService({}, tx);

    await service.withdrawVote(10n, 1n);

    expect(tx.topicOption.update).toHaveBeenCalledTimes(2);
  });

  it('allows re-voting after withdrawal with no reward for QUICK', async () => {
    const existing = { id: 20n, optionId: 101n, spectrumValue: null, selections: [] };
    const { tx: wtx } = withdrawSetup(existing);
    const serviceW = baseService({}, wtx);
    await serviceW.withdrawVote(10n, 1n);

    const topic = openTopic({ kind: TopicKind.QUICK });
    const vtx = voteTx(topic);
    const serviceV = baseService({}, vtx);
    const revoteResult = await serviceV.vote(10n, 1n, { optionId: '101' } as never);
    expect(revoteResult.rewardPoints).toBe(0);
    expect(vtx.pointTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects survey children with 403', async () => {
    const { tx } = withdrawSetup({ id: 20n, optionId: 101n, spectrumValue: null, selections: [] }, { parentTopicId: 9n });
    // withdraw checks parent before loading the vote; force vote lookup to fail if reached
    tx.vote.findUnique.mockRejectedValue(new Error('should not reach vote lookup'));
    const service = baseService({}, tx);
    await expect(service.withdrawVote(10n, 1n)).rejects.toMatchObject({ status: 403, message: '問卷送出後不可取消' });
  });

  it('returns 404 when there is no vote', async () => {
    const { tx } = withdrawSetup(null);
    const service = baseService({}, tx);
    await expect(service.withdrawVote(10n, 1n)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TopicsService withdrawRank', () => {
  function rankSetup(existing: any, topicOverrides: Record<string, any> = {}) {
    const topic = {
      id: 10n,
      topicType: TopicType.IMAGE_RANK,
      status: 'OPEN',
      moderationStatus: 'APPROVED',
      voteEndAt: new Date(Date.now() + 60_000),
      parentTopicId: null,
      ...topicOverrides,
    };
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 10n }]),
      topic: { findUnique: jest.fn().mockResolvedValue(topic), update: jest.fn().mockResolvedValue(undefined) },
      topicRankResult: {
        findUnique: jest.fn().mockResolvedValue(existing),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    };
    return { tx };
  }

  it('deletes the rank result and decrements voterCount', async () => {
    const { tx } = rankSetup({ id: 5n });
    const service = baseService({}, tx);

    const result = await service.withdrawRank(10n, 1n);

    expect(result).toEqual({ success: true });
    expect(tx.topicRankResult.delete).toHaveBeenCalledWith({ where: { id: 5n } });
    expect(tx.topic.update).toHaveBeenCalledWith({ where: { id: 10n }, data: { voterCount: { decrement: 1 } } });
  });

  it('rejects survey children with 403', async () => {
    const { tx } = rankSetup({ id: 5n }, { parentTopicId: 9n });
    const service = baseService({}, tx);
    await expect(service.withdrawRank(10n, 1n)).rejects.toMatchObject({ status: 403, message: '問卷送出後不可取消' });
    expect(tx.topicRankResult.delete).not.toHaveBeenCalled();
  });

  it('returns 404 when there is no rank result', async () => {
    const { tx } = rankSetup(null);
    const service = baseService({}, tx);
    await expect(service.withdrawRank(10n, 1n)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TopicsService serialize parentTopicId', () => {
  it('exposes parentTopicId as string|null', async () => {
    const service = new TopicsService({} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    const base = {
      id: 10n,
      title: 't',
      description: null,
      category: 'quick',
      kind: TopicKind.QUICK,
      topicType: TopicType.MULTIPLE,
      status: 'OPEN',
      moderationStatus: 'APPROVED',
      createdAt: new Date(),
      updatedAt: new Date(),
      voteEndAt: new Date(),
      voteDurationDays: 7,
      totalVotes: 0n,
      voterCount: 0n,
      spectrumMedian: null,
      spectrumStddev: null,
      contentBlocks: [],
      options: [],
    };
    expect((service as any).serialize({ ...base, parentTopicId: null }, false).parentTopicId).toBeNull();
    expect((service as any).serialize({ ...base, parentTopicId: 9n }, false).parentTopicId).toBe('9');
  });
});

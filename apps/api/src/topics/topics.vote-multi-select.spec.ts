import { TopicKind, TopicType } from '@prisma/client';
import { TopicsService } from './topics.service';

describe('TopicsService multi-select voting', () => {
  const topic = {
    id: 10n,
    title: '複選題',
    kind: TopicKind.QUICK,
    parentTopicId: null,
    topicType: TopicType.MULTI_SELECT,
    maxSelections: 2,
    status: 'OPEN',
    moderationStatus: 'APPROVED',
    voteEndAt: new Date(Date.now() + 60_000),
    options: [{ id: 1n }, { id: 2n }, { id: 3n }],
  };

  function service(tx: Record<string, any>) {
    const prisma = {
      $transaction: jest.fn((callback: (client: unknown) => unknown) => callback(tx)),
      userDemographicProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      topicOption: { findMany: jest.fn().mockResolvedValue([]) },
      topic: { findUnique: jest.fn().mockResolvedValue({ totalVotes: 1n }) },
    };
    const instance = new TopicsService(
      prisma as never,
      { broadcastTopicVotes: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      {} as never,
      { assertPublicAction: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      { assertCanInteract: jest.fn().mockResolvedValue(undefined) } as never,
    );
    jest.spyOn(instance as never as { assertTopicInteraction: () => Promise<void> }, 'assertTopicInteraction').mockResolvedValue(undefined);
    return instance;
  }

  it('deduplicates selections and increments each selected option once', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      $queryRaw: jest.fn().mockResolvedValueOnce([{ id: 10n }]).mockResolvedValueOnce([{ id: 1n, points_balance: 0n }]),
      topic: {
        findUnique: jest.fn().mockResolvedValue(topic),
        update: jest.fn().mockResolvedValue(undefined),
      },
      vote: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 20n, createdAt: new Date() }),
      },
      voteSelection: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      topicOption: { update: jest.fn().mockResolvedValue(undefined) },
      pointTransaction: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(undefined) },
      user: { update: jest.fn().mockResolvedValue(undefined) },
    };

    const result = await service(tx).vote(10n, 1n, { optionIds: [1, 1, 2] });

    expect(result.optionIds).toEqual(['1', '2']);
    expect(tx.voteSelection.createMany).toHaveBeenCalledWith({
      data: [{ voteId: 20n, optionId: 1n }, { voteId: 20n, optionId: 2n }],
    });
    expect(tx.topicOption.update).toHaveBeenCalledTimes(2);
  });

  it('keeps the Vote and only applies changed selections on revote', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 10n }]),
      topic: {
        findUnique: jest.fn().mockResolvedValue(topic),
        update: jest.fn().mockResolvedValue(undefined),
      },
      vote: {
        findUnique: jest.fn().mockResolvedValue({
          id: 20n,
          optionId: null,
          spectrumValue: null,
          answerText: null,
          selections: [{ optionId: 1n }, { optionId: 2n }],
        }),
        create: jest.fn(),
        delete: jest.fn(),
      },
      voteSelection: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      topicOption: { update: jest.fn().mockResolvedValue(undefined) },
      user: { findUnique: jest.fn().mockResolvedValue({ pointsBalance: 5n }) },
    };

    const result = await service(tx).revote(10n, 1n, { optionIds: [2, 3] });

    expect(result.optionIds).toEqual(['2', '3']);
    expect(tx.vote.delete).not.toHaveBeenCalled();
    expect(tx.vote.create).not.toHaveBeenCalled();
    expect(tx.voteSelection.deleteMany).toHaveBeenCalledWith({ where: { voteId: 20n, optionId: { in: [1n] } } });
    expect(tx.voteSelection.createMany).toHaveBeenCalledWith({ data: [{ voteId: 20n, optionId: 3n }] });
    expect(tx.topicOption.update).toHaveBeenCalledTimes(2);
  });
});

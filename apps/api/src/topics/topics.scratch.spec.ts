import { BadRequestException } from '@nestjs/common';
import { TopicKind, TopicType } from '@prisma/client';
import * as crypto from 'crypto';
import { TopicsService } from './topics.service';

jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return Object.assign(Object.create(actual), { randomInt: jest.fn() });
});

function mockRandomInt(value: number) {
  (crypto.randomInt as jest.Mock).mockReturnValue(value);
}

function scratchTopic() {
  return {
    id: 10n,
    title: '刮刮樂',
    kind: TopicKind.QUICK,
    parentTopicId: null,
    topicType: TopicType.SCRATCH,
    status: 'OPEN',
    moderationStatus: 'APPROVED',
    voteEndAt: new Date(Date.now() + 60_000),
    options: [
      { id: 101n, label: '普通', voteCount: 0n, data: { weight: 1, scratchShowText: false } },
      { id: 102n, label: '稀有', voteCount: 0n, data: { weight: 3, scratchRevealImageUrl: '/api/v1/option-images/win' } },
    ],
  };
}

function setup(existing: unknown = null) {
  const topic = scratchTopic();
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ id: 10n }]),
    topic: {
      findUnique: jest.fn().mockResolvedValue(topic),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
    },
    vote: {
      findUnique: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockResolvedValue({ id: 20n }),
      count: jest.fn().mockResolvedValue(0),
    },
    topicOption: { update: jest.fn().mockResolvedValue(undefined) },
    topicRankResult: { count: jest.fn().mockResolvedValue(0) },
    user: { findUnique: jest.fn().mockResolvedValue({ pointsBalance: 44n }) },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    userDemographicProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    topicOption: { findMany: jest.fn().mockResolvedValue([]) },
    topic: { findUnique: jest.fn().mockResolvedValue({ totalVotes: 1n }) },
  };
  const realtime = { broadcastTopicVotes: jest.fn().mockResolvedValue(undefined) };
  const service = new TopicsService(
    prisma as never,
    realtime as never,
    {} as never,
    {} as never,
    { assertPublicAction: jest.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    { assertCanInteract: jest.fn().mockResolvedValue(undefined) } as never,
  );
  jest.spyOn(service as never as { assertTopicInteraction: () => Promise<void> }, 'assertTopicInteraction').mockResolvedValue(undefined);
  jest.spyOn(service as never as { createDemographicSnapshot: () => Promise<void> }, 'createDemographicSnapshot').mockResolvedValue(undefined);
  return { service, tx, realtime, topic };
}

describe('TopicsService scratch draw', () => {
  afterEach(() => jest.restoreAllMocks());

  it('selects by positive integer weights and records a zero-reward vote', async () => {
    const { service, tx } = setup();
    mockRandomInt(2);

    const result = await service.scratchDraw(10n, 1n);

    expect(tx.vote.create).toHaveBeenCalledWith({ data: { userId: 1n, topicId: 10n, optionId: 102n } });
    expect(tx.topicOption.update).toHaveBeenCalledWith({ where: { id: 102n }, data: { voteCount: { increment: 1 } } });
    expect(result).toMatchObject({
      success: true,
      isNew: true,
      result: { optionId: '102', label: '稀有', showText: true },
      rewardPoints: 0,
      newBalance: '44',
    });
    expect(result.result.revealImageUrl).toMatch(/\/option-images\/win$/);
  });

  it('returns an existing result idempotently without incrementing counts', async () => {
    const option = scratchTopic().options[0];
    const { service, tx, realtime } = setup({ id: 19n, option });

    const result = await service.scratchDraw(10n, 1n);

    expect(result).toMatchObject({ isNew: false, result: { optionId: '101', showText: false }, newBalance: '44' });
    expect(tx.vote.create).not.toHaveBeenCalled();
    expect(tx.topicOption.update).not.toHaveBeenCalled();
    expect(realtime.broadcastTopicVotes).not.toHaveBeenCalled();
  });

  it('returns an existing result after the topic closes', async () => {
    const option = scratchTopic().options[0];
    const { service, topic } = setup({ id: 19n, option });
    topic.status = 'LOCKED';
    topic.voteEndAt = new Date(Date.now() - 60_000);

    await expect(service.scratchDraw(10n, 1n)).resolves.toMatchObject({
      isNew: false,
      result: { optionId: '101' },
    });
  });

  it('rejects SCRATCH through generic vote and change-vote paths', async () => {
    const first = setup();
    await expect(first.service.vote(10n, 1n, { optionId: 101 })).rejects.toBeInstanceOf(BadRequestException);

    const second = setup();
    await expect(second.service.revote(10n, 1n, { optionId: 101 })).rejects.toBeInstanceOf(BadRequestException);
    expect(second.tx.vote.findUnique).not.toHaveBeenCalled();
  });
});

describe('TopicsService nested topic access', () => {
  it('authorizes a child interaction through its parent topic', async () => {
    const parent = {
      id: 10n,
      kind: TopicKind.SURVEY,
      visibility: 'PRIVATE_LINK',
      audience: 'MEMBER_ONLY',
      audienceOwnerId: 2n,
    };
    const prisma = {
      topic: {
        findUnique: jest.fn().mockResolvedValue({
          id: 11n,
          kind: TopicKind.QUICK,
          visibility: 'PRIVATE_LINK',
          audience: 'MEMBER_ONLY',
          audienceOwnerId: 2n,
          parentTopic: parent,
        }),
      },
    };
    const access = { assertCanInteract: jest.fn().mockResolvedValue(undefined) };
    const service = new TopicsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      access as never,
    ) as never as { assertTopicInteraction: (topicId: bigint, userId: bigint) => Promise<void> };

    await service.assertTopicInteraction(11n, 7n);

    expect(access.assertCanInteract).toHaveBeenCalledWith(parent, 7n);
  });
});

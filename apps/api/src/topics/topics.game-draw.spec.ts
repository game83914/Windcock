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

type GameType = 'LOTTERY' | 'SPIN_WHEEL';

function gameTopic(topicType: GameType = 'LOTTERY') {
  return {
    id: 10n,
    title: '抽獎題',
    kind: TopicKind.QUICK,
    parentTopicId: null,
    topicType,
    status: 'OPEN',
    moderationStatus: 'APPROVED',
    voteEndAt: new Date(Date.now() + 60_000),
    options: [
      { id: 101n, label: '機率一', voteCount: 0n, data: { weight: 1 } },
      { id: 102n, label: '機率三', voteCount: 0n, data: { weight: 3 } },
    ],
  };
}

function setup(topicType: GameType = 'LOTTERY', existing: unknown = null) {
  const topic = gameTopic(topicType);
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

describe('TopicsService server-side game draw (LOTTERY/SPIN_WHEEL)', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['LOTTERY', 'SPIN_WHEEL'] as const)(
    'selects a weighted result via CSPRNG and records a zero-reward vote for %p',
    async (topicType) => {
      const { service, tx, realtime } = setup(topicType);
      mockRandomInt(2);

      const result = await service.gameDraw(10n, 1n);

      expect(tx.vote.create).toHaveBeenCalledWith({ data: { userId: 1n, topicId: 10n, optionId: 102n } });
      expect(tx.topicOption.update).toHaveBeenCalledWith({ where: { id: 102n }, data: { voteCount: { increment: 1 } } });
      expect(result).toMatchObject({
        success: true,
        isNew: true,
        result: { optionId: '102', label: '機率三' },
        rewardPoints: 0,
        newBalance: '44',
      });
      expect(realtime.broadcastTopicVotes).toHaveBeenCalled();
    },
  );

  it.each(['LOTTERY', 'SPIN_WHEEL'] as const)(
    'returns an existing result idempotently without incrementing counts for %p',
    async (topicType) => {
      const option = gameTopic(topicType).options[0];
      const { service, tx, realtime } = setup(topicType, { id: 19n, option });

      const result = await service.gameDraw(10n, 1n);

      expect(result).toMatchObject({ isNew: false, result: { optionId: '101' }, newBalance: '44' });
      expect(tx.vote.create).not.toHaveBeenCalled();
      expect(tx.topicOption.update).not.toHaveBeenCalled();
      expect(realtime.broadcastTopicVotes).not.toHaveBeenCalled();
    },
  );

  it('returns an existing result after the topic closes', async () => {
    const option = gameTopic().options[0];
    const { service, topic } = setup('LOTTERY', { id: 19n, option });
    topic.status = 'SETTLED';
    topic.voteEndAt = new Date(Date.now() - 60_000);

    await expect(service.gameDraw(10n, 1n)).resolves.toMatchObject({
      isNew: false,
      result: { optionId: '101' },
    });
  });

  it.each(['LOTTERY', 'SPIN_WHEEL'] as const)(
    'rejects %p through generic vote and change-vote paths',
    async (topicType) => {
      const first = setup(topicType);
      await expect(first.service.vote(10n, 1n, { optionId: 101 })).rejects.toBeInstanceOf(BadRequestException);

      const second = setup(topicType);
      await expect(second.service.revote(10n, 1n, { optionId: 101 })).rejects.toBeInstanceOf(BadRequestException);
      expect(second.tx.vote.findUnique).not.toHaveBeenCalled();
    },
  );

  it('rejects topics that are not draw games through game-draw', async () => {
    const binary = setup();
    jest.spyOn(binary.tx.topic, 'findUnique').mockResolvedValue({ ...binary.topic, topicType: TopicType.BINARY });
    await expect(binary.service.gameDraw(10n, 1n)).rejects.toBeInstanceOf(BadRequestException);

    const scratch = setup();
    jest.spyOn(scratch.tx.topic, 'findUnique').mockResolvedValue({ ...scratch.topic, topicType: TopicType.SCRATCH });
    await expect(scratch.service.gameDraw(10n, 1n)).rejects.toBeInstanceOf(BadRequestException);
  });
});
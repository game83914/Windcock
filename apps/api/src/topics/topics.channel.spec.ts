import { TopicKind } from '@prisma/client';
import { TopicsService } from './topics.service';

describe('TopicsService channel behavior', () => {
  function createService(prisma: Record<string, unknown>) {
    return new TopicsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { discoveryWhere: jest.fn().mockReturnValue({}), assertCanView: jest.fn(), assertCanInteract: jest.fn() } as never,
    );
  }

  const baseTopic = {
    id: 1n,
    title: '測試議題',
    description: null,
    category: 'social',
    kind: TopicKind.FORMAL,
    featuredOrder: null,
    topicType: 'BINARY',
    status: 'OPEN',
    moderationStatus: 'APPROVED',
    moderationNote: null,
    creatorId: 8n,
    creator: { nickname: '編輯', avatarUrl: null },
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    voteEndAt: new Date(),
    voteDurationDays: 7,
    voteDurationHours: null,
    minVotes: null,
    totalVotes: 0n,
    voterCount: 0n,
    spectrumMedian: null,
    spectrumStddev: null,
    options: [],
    contentBlocks: [],
  };

  it('keeps editorial operators private while exposing reviewed member authors', () => {
    const service = createService({});
    const serialize = (topic: Record<string, unknown>) => (service as any).serialize(topic, false);

    expect(serialize(baseTopic).creator).toMatchObject({ id: null, type: 'OFFICIAL' });
    expect(serialize({ ...baseTopic, reviewedAt: new Date() }).creator).toMatchObject({ id: '8', type: 'MEMBER' });
    expect(serialize({ ...baseTopic, moderationStatus: 'PENDING_REVIEW' }).creator).toMatchObject({ id: '8', type: 'MEMBER' });
  });

  it('lists only member-published history on a channel', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const tx = {
      topic: { findMany, count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
    };
    const service = createService({ $transaction: jest.fn((callback) => callback(tx)) });

    await service.list(null, { creatorId: 8n, kind: 'ALL', page: 1, limit: 20 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        audienceOwnerId: 8n,
        status: { in: ['OPEN', 'LOCKED', 'SETTLED'] },
      }),
    }));
  });

  it('batches channel notification inserts', async () => {
    const followers = Array.from({ length: 1001 }, (_, index) => ({ followingId: BigInt(index + 1) }));
    const createMany = jest.fn().mockResolvedValue({ count: 0 });
    const tx = {
      channelFollow: { findMany: jest.fn().mockResolvedValue(followers) },
      user: { findUnique: jest.fn().mockResolvedValue({ nickname: '會員' }) },
      notification: { createMany },
    };
    const service = createService({});

    await (service as any).fanOutChannelNewTopic(tx, 8n, { id: 3n, kind: TopicKind.QUICK, title: '快問' });

    expect(createMany).toHaveBeenCalledTimes(2);
    expect(createMany.mock.calls[0][0].data).toHaveLength(1000);
    expect(createMany.mock.calls[1][0].data).toHaveLength(1);
  });
});

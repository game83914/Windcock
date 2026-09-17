import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TopicAccessService } from './topic-access.service';

describe('TopicAccessService', () => {
  const privateTopic = { id: 5n, kind: 'QUICK', visibility: 'PRIVATE_LINK', audience: 'MEMBER_ONLY', audienceOwnerId: 9n } as const;

  it('requires an active grant for a private link viewer', async () => {
    const prisma = { topicShareGrant: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new TopicAccessService(prisma as never, { evictTopic: jest.fn() } as never);

    await expect(service.assertCanView(privateTopic, 2n)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows a current follower to view follower-only content', async () => {
    const prisma = { channelFollow: { findUnique: jest.fn().mockResolvedValue({ followingId: 2n }) } };
    const service = new TopicAccessService(prisma as never, { evictTopic: jest.fn() } as never);

    await expect(service.assertCanView({ ...privateTopic, visibility: 'PUBLIC', audience: 'FOLLOWERS_ONLY' }, 2n)).resolves.toBeUndefined();
  });

  it('rejects a non-follower from follower-only content', async () => {
    const prisma = { channelFollow: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new TopicAccessService(prisma as never, { evictTopic: jest.fn() } as never);

    await expect(service.assertCanView({ ...privateTopic, visibility: 'PUBLIC', audience: 'FOLLOWERS_ONLY' }, 2n)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('redeems an active private-link token into a user grant', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      topicShareLink: { findUnique: jest.fn().mockResolvedValue({ id: 7n, topicId: 5n, enabled: true, topic: privateTopic }) },
      topicShareGrant: { upsert },
    };
    const service = new TopicAccessService(prisma as never, { evictTopic: jest.fn() } as never);

    await expect(service.redeem('a-valid-private-token-value', 2n)).resolves.toEqual({ topicId: '5' });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { shareLinkId: 7n, topicId: 5n, userId: 2n } }));
  });
});

import { BadRequestException } from '@nestjs/common';
import { ChannelsService } from './channels.service';

describe('ChannelsService', () => {
  function createService() {
    const prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      topic: { findMany: jest.fn().mockResolvedValue([]) },
      channelFollow: {
        count: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
    };
    return { service: new ChannelsService(prisma as never, { evictUserFromTopics: jest.fn() } as never), prisma };
  }

  it('rejects following your own channel', async () => {
    const { service, prisma } = createService();

    await expect(service.follow(7n, 7n)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.channelFollow.upsert).not.toHaveBeenCalled();
  });

  it('upserts a follow and returns the updated profile', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 9n })
      .mockResolvedValueOnce({ nickname: '頻道主', avatarUrl: null, channelBio: '簡介' });
    prisma.channelFollow.upsert.mockResolvedValue({});
    prisma.channelFollow.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);

    await expect(service.follow(4n, 9n)).resolves.toMatchObject({
      id: '9',
      followerCount: 3,
      isFollowing: true,
      isSelf: false,
    });
    expect(prisma.channelFollow.upsert).toHaveBeenCalledWith({
      where: { followingId_channelOwnerId: { followingId: 4n, channelOwnerId: 9n } },
      create: { followingId: 4n, channelOwnerId: 9n },
      update: {},
    });
  });

  it('serializes follower ids for JSON responses', async () => {
    const { service, prisma } = createService();
    const createdAt = new Date('2026-09-16T00:00:00Z');
    prisma.channelFollow.findMany.mockResolvedValue([
      { following: { id: 12n, nickname: '追蹤者', avatarUrl: null }, createdAt },
    ]);
    prisma.channelFollow.count.mockResolvedValue(1);

    await expect(service.followers(9n)).resolves.toEqual({
      items: [{ user: { id: '12', nickname: '追蹤者', avatarUrl: null }, createdAt }],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });
  });

  it('trims channel bios to the validated 100 character limit', async () => {
    const { service, prisma } = createService();
    prisma.user.update.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({ nickname: '會員', avatarUrl: null, channelBio: 'x'.repeat(100) });
    prisma.channelFollow.count.mockResolvedValue(0);

    await service.updateBio(3n, `  ${'x'.repeat(110)}  `);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 3n },
      data: { channelBio: 'x'.repeat(100) },
    });
  });
});

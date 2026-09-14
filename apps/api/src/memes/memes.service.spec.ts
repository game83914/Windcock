import { MemesService } from './memes.service';

describe('MemesService usage rewards', () => {
  function service() {
    return new MemesService({} as never, {} as never, {} as never);
  }

  it('allows every approved GIF to be used without collection', async () => {
    const tx = { meme: { findMany: jest.fn().mockResolvedValue([{ id: 3n }]) } };
    await expect(service().assertCanUse(1n, ['3'], tx as never)).resolves.toEqual([3n]);
    expect(tx.meme.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [3n] }, status: 'APPROVED' } }));
  });

  it('collects an approved GIF idempotently and increments once', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 3n }]),
      meme: { findUnique: jest.fn().mockResolvedValue({ status: 'APPROVED' }), update: jest.fn().mockResolvedValue({}) },
      memeCollection: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const instance = new MemesService(prisma as never, {} as never, {} as never);
    jest.spyOn(instance, 'detail').mockResolvedValue({ collected: true } as never);

    await expect(instance.collect(3n, 1n)).resolves.toEqual({ meme: { collected: true } });
    expect(tx.memeCollection.createMany).toHaveBeenCalledWith({ data: [{ userId: 1n, memeId: 3n }], skipDuplicates: true });
    expect(tx.meme.update).toHaveBeenCalledWith({ where: { id: 3n }, data: { collectionCount: { increment: 1 } } });

    tx.memeCollection.createMany.mockResolvedValue({ count: 0 });
    await instance.collect(3n, 1n);
    expect(tx.meme.update).toHaveBeenCalledTimes(1);
  });

  it('rewards a creator once for an eligible published use', async () => {
    const event = { id: 8n };
    const tx = {
      meme: {
        findMany: jest.fn().mockResolvedValue([{ id: 3n, title: '測試 GIF', creatorId: 2n, origin: 'USER' }]),
        update: jest.fn().mockResolvedValue({}),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      memeUsageEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(event),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ pointsBalance: 5n }),
        update: jest.fn().mockResolvedValue({}),
      },
      pointTransaction: { create: jest.fn().mockResolvedValue({ id: 9n }) },
    };

    await service().recordUsage(tx as never, 1n, 'POST', 10n, [3n]);

    expect(tx.memeUsageEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ rewardStatus: 'REWARDED', rewardPoints: 1 }) }));
    expect(tx.pointTransaction.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: 1, balanceBefore: 5n, balanceAfter: 6n, txType: 'MEME_USAGE_REWARD' }) }));
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 2n }, data: { pointsBalance: 6n } });
  });

  it('records self-use without minting points', async () => {
    const tx = {
      meme: { findMany: jest.fn().mockResolvedValue([{ id: 3n, title: '自己的 GIF', creatorId: 1n, origin: 'USER' }]), update: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([]),
      memeUsageEvent: { create: jest.fn().mockResolvedValue({ id: 8n }) },
      pointTransaction: { create: jest.fn() },
      user: { update: jest.fn() },
    };

    await service().recordUsage(tx as never, 1n, 'COMMENT', 10n, [3n]);

    expect(tx.memeUsageEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ rewardStatus: 'SELF_USE', rewardPoints: 0 }) }));
    expect(tx.pointTransaction.create).not.toHaveBeenCalled();
  });

  it('does not reward the same member and GIF twice on the same day', async () => {
    const tx = {
      meme: { findMany: jest.fn().mockResolvedValue([{ id: 3n, title: '重複 GIF', creatorId: 2n, origin: 'USER' }]), update: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([]),
      memeUsageEvent: { findFirst: jest.fn().mockResolvedValue({ id: 7n }), create: jest.fn().mockResolvedValue({ id: 8n }) },
      pointTransaction: { create: jest.fn() },
      user: { update: jest.fn() },
    };

    await service().recordUsage(tx as never, 1n, 'POST', 11n, [3n]);

    expect(tx.memeUsageEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ rewardStatus: 'DUPLICATE_DAILY_USE', rewardPoints: 0 }) }));
    expect(tx.pointTransaction.create).not.toHaveBeenCalled();
  });
});

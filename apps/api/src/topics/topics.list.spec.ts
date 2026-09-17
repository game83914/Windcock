import { TopicsService } from './topics.service';

describe('TopicsService list status filter', () => {
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

  function createTx() {
    const findMany = jest.fn().mockResolvedValue([]);
    const tx = {
      topic: {
        findMany,
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };
    return { tx, findMany };
  }

  function buildService() {
    const { tx, findMany } = createTx();
    const service = createService({ $transaction: jest.fn((callback) => callback(tx)) });
    return { service, findMany };
  }

  it('defaults to in-progress topics only', async () => {
    const { service, findMany } = buildService();

    await service.list(null, { page: 1, limit: 20 });

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'OPEN', voteEndAt: { gt: expect.any(Date) } }),
    ]));
  });

  it('includes ended topics when status is ENDED', async () => {
    const { service, findMany } = buildService();

    await service.list(null, { status: 'ENDED', page: 1, limit: 20 });

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({
        OR: [
          { status: { in: ['LOCKED', 'SETTLED'] } },
          { status: 'OPEN', voteEndAt: { lte: expect.any(Date) } },
        ],
      }),
    ]));
  });

  it('includes both in-progress and ended topics when status is ALL', async () => {
    const { service, findMany } = buildService();

    await service.list(null, { status: 'ALL', page: 1, limit: 20 });

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: { in: ['OPEN', 'LOCKED', 'SETTLED'] } }),
    ]));
  });

  it('defaults to all statuses when searching without an explicit status', async () => {
    const { service, findMany } = buildService();

    await service.list(null, { search: '能源', page: 1, limit: 20 });

    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: { in: ['OPEN', 'LOCKED', 'SETTLED'] } }),
    ]));
    expect(where.AND).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'OPEN' }),
    ]));
    expect(where.OR).toBeDefined();
  });

  it('keeps the search OR clause alongside the status filter', async () => {
    const { service, findMany } = buildService();

    await service.list(null, { status: 'ENDED', search: '能源', page: 1, limit: 20 });

    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { title: { contains: '能源', mode: 'insensitive' } },
      { description: { contains: '能源', mode: 'insensitive' } },
      { options: { some: { label: { contains: '能源', mode: 'insensitive' } } } },
    ]);
    expect(where.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({ OR: expect.any(Array) }),
    ]));
  });

  it('ignores the status filter for a creator channel', async () => {
    const { service, findMany } = buildService();

    await service.list(null, { creatorId: 8n, kind: 'ALL', status: 'ACTIVE', page: 1, limit: 20 });

    const where = findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ['OPEN', 'LOCKED', 'SETTLED'] });
    expect(where.AND).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'OPEN' }),
    ]));
  });
});

import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { FeaturedTopicsDto, MAX_FEATURED_TOPICS } from './dto/topic.dto';
import { TopicsService } from './topics.service';

describe('TopicsService featured topics', () => {
  const findMany = jest.fn();
  const updateMany = jest.fn();
  const update = jest.fn();
  const policy = { assert: jest.fn() };
  const prisma = {
    topic: { findMany },
    $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback({ topic: { updateMany, update } })),
  };
  const service = new TopicsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    policy as never,
    {} as never,
    { discoveryWhere: jest.fn().mockReturnValue({}) } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    policy.assert.mockResolvedValue(undefined);
  });

  it('limits the public featured query to eligible statuses and five records', async () => {
    findMany.mockResolvedValue([]);

    await service.featured();

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        moderationStatus: 'APPROVED',
        status: { in: ['OPEN', 'LOCKED', 'SETTLED'] },
      }),
      take: MAX_FEATURED_TOPICS,
    }));
  });

  it('rejects non-public topics', async () => {
    findMany.mockResolvedValue([{ id: BigInt(1), moderationStatus: 'APPROVED', status: 'CANCELLED', visibility: 'PUBLIC', audience: 'MEMBER_ONLY' }]);

    await expect(service.setFeatured(BigInt(1), ['1'])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows ended public topics', async () => {
    findMany
      .mockResolvedValueOnce([{ id: BigInt(1), moderationStatus: 'APPROVED', status: 'SETTLED', visibility: 'PUBLIC', audience: 'MEMBER_ONLY' }])
      .mockResolvedValueOnce([]);

    await expect(service.setFeatured(BigInt(1), ['1'])).resolves.toEqual([]);
    expect(update).toHaveBeenCalledWith({ where: { id: BigInt(1) }, data: { featuredOrder: 0 } });
  });
});

describe('FeaturedTopicsDto', () => {
  it('rejects more than five featured topics', async () => {
    const dto = Object.assign(new FeaturedTopicsDto(), {
      topicIds: Array.from({ length: MAX_FEATURED_TOPICS + 1 }, (_, index) => String(index + 1)),
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'topicIds')).toBe(true);
  });
});

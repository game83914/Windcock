import { ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { TopicAnalyticsService } from './topic-analytics.service';

const topic = {
  id: 1n,
  title: '測試議題',
  category: '公共政策',
  topicType: 'BINARY',
  status: 'OPEN',
  moderationStatus: 'APPROVED',
  totalVotes: 4n,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  voteEndAt: new Date('2026-09-08T00:00:00.000Z'),
  options: [
    { id: 10n, label: '支持', voteCount: 3n },
    { id: 11n, label: '不支持', voteCount: 1n },
  ],
};

function analyticsPolicy(allowed: boolean) {
  return {
    canViewAnalytics: jest.fn().mockResolvedValue(allowed),
    canViewTopicAnalytics: jest.fn().mockResolvedValue(allowed),
  };
}

describe('TopicAnalyticsService', () => {
  it('rejects analytics access for anonymous visitors', async () => {
    const prisma = {
      topic: { findUnique: jest.fn().mockResolvedValue(topic) },
      voteDemographicSnapshot: { count: jest.fn().mockResolvedValue(12) },
    };
    const policy = analyticsPolicy(false);
    const service = new TopicAnalyticsService(prisma as never, {} as never, policy as never, { assertCanView: jest.fn() } as never);

    await expect(service.access(1n, null)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('calculates result trends for an administrator', async () => {
    const votes = [
      { optionId: 10n, spectrumValue: null, createdAt: new Date('2026-09-01T01:00:00.000Z') },
      { optionId: 10n, spectrumValue: null, createdAt: new Date('2026-09-01T02:00:00.000Z') },
      { optionId: 10n, spectrumValue: null, createdAt: new Date('2026-09-02T01:00:00.000Z') },
      { optionId: 11n, spectrumValue: null, createdAt: new Date('2026-09-02T02:00:00.000Z') },
    ];
    const prisma = {
      topic: { findUnique: jest.fn().mockResolvedValue(topic) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'ADMIN', organizationMemberships: [] }) },
      vote: { findMany: jest.fn().mockResolvedValue(votes) },
    };
    const policy = analyticsPolicy(true);
    const service = new TopicAnalyticsService(prisma as never, {} as never, policy as never, { assertCanView: jest.fn() } as never);

    const result = await service.trends(1n, 9n);
    expect(result.options).toEqual([
      { optionId: '10', label: '支持', count: 3, percentage: 75 },
      { optionId: '11', label: '不支持', count: 1, percentage: 25 },
    ]);
    expect(result.leadMargin).toBe(50);
    expect(result.timeline).toHaveLength(2);
    expect(result.timeline[1].cumulativeVotes).toBe(4);
    expect(result.peakDay).toEqual({ date: '2026-09-01', votes: 2 });
    expect(result.optionMomentum).toHaveLength(2);
  });

  it('rejects analytics access for a general member', async () => {
    const prisma = {
      topic: { findUnique: jest.fn().mockResolvedValue(topic) },
      voteDemographicSnapshot: { count: jest.fn().mockResolvedValue(30) },
    };
    const policy = analyticsPolicy(false);
    const service = new TopicAnalyticsService(prisma as never, {} as never, policy as never, { assertCanView: jest.fn() } as never);

    await expect(service.access(1n, 2n)).rejects.toBeInstanceOf(HttpException);
  });

  it('applies complementary suppression when one demographic cohort is small', async () => {
    const snapshots = [
      ...Array.from({ length: 5 }, () => ({ ageBand: 'AGE_18_24', vote: { optionId: 10n, spectrumValue: null } })),
      ...Array.from({ length: 12 }, () => ({ ageBand: 'AGE_25_34', vote: { optionId: 10n, spectrumValue: null } })),
      ...Array.from({ length: 13 }, () => ({ ageBand: 'AGE_35_44', vote: { optionId: 11n, spectrumValue: null } })),
    ];
    const prisma = {
      topic: { findUnique: jest.fn().mockResolvedValue({ ...topic, totalVotes: 30n }) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'ADMIN', organizationMemberships: [] }) },
      voteDemographicSnapshot: { findMany: jest.fn().mockResolvedValue(snapshots) },
      demographicAnalysisAudit: { create: jest.fn().mockResolvedValue({}) },
    };
    const policy = analyticsPolicy(true);
    const service = new TopicAnalyticsService(prisma as never, {} as never, policy as never, { assertCanView: jest.fn() } as never);

    const result = await service.demographics(1n, 9n, 'AGE_BAND');
    expect(result.suppressed).toBe(true);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].key).toBe('AGE_35_44');
  });

  it('hides the only visible cohort when a small cohort could be inferred', async () => {
    const snapshots = [
      ...Array.from({ length: 5 }, () => ({ personalityType: 'INTJ', vote: { optionId: 10n, spectrumValue: null } })),
      ...Array.from({ length: 25 }, () => ({ personalityType: 'ENFP', vote: { optionId: 11n, spectrumValue: null } })),
    ];
    const prisma = {
      topic: { findUnique: jest.fn().mockResolvedValue({ ...topic, totalVotes: 30n }) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'ADMIN', organizationMemberships: [] }) },
      voteDemographicSnapshot: { findMany: jest.fn().mockResolvedValue(snapshots) },
      demographicAnalysisAudit: { create: jest.fn().mockResolvedValue({}) },
    };
    const policy = analyticsPolicy(true);
    const service = new TopicAnalyticsService(prisma as never, {} as never, policy as never, { assertCanView: jest.fn() } as never);

    const result = await service.demographics(1n, 9n, 'PERSONALITY_TYPE');
    expect(result.available).toBe(false);
    expect(result.suppressed).toBe(true);
    expect(result.groups).toHaveLength(0);
  });

  it('uses the stricter district privacy threshold', async () => {
    const snapshots = Array.from({ length: 99 }, () => ({ district: '臺北市中正區', vote: { optionId: 10n, spectrumValue: null } }));
    const prisma = {
      topic: { findUnique: jest.fn().mockResolvedValue({ ...topic, totalVotes: 99n }) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'ADMIN', organizationMemberships: [] }) },
      voteDemographicSnapshot: { findMany: jest.fn().mockResolvedValue(snapshots) },
      demographicAnalysisAudit: { create: jest.fn().mockResolvedValue({}) },
    };
    const policy = analyticsPolicy(true);
    const service = new TopicAnalyticsService(prisma as never, {} as never, policy as never, { assertCanView: jest.fn() } as never);

    const result = await service.demographics(1n, 9n, 'DISTRICT');
    expect(result.available).toBe(false);
    expect(result.thresholds).toEqual({ total: 100, cohort: 20 });
  });

  it('records demographic analytics access', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = {
      topic: { findUnique: jest.fn().mockResolvedValue({ ...topic, totalVotes: 0n }) },
      voteDemographicSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
      demographicAnalysisAudit: { create },
    };
    const policy = analyticsPolicy(true);
    const service = new TopicAnalyticsService(prisma as never, {} as never, policy as never, { assertCanView: jest.fn() } as never);

    await service.demographics(1n, 9n, 'AGE_BAND');

    expect(create).toHaveBeenCalledWith({ data: { adminId: 9n, topicId: 1n, dimension: 'AGE_BAND' } });
  });

  it('suppresses small stance samples', async () => {
    const prisma = { topic: { findUnique: jest.fn().mockResolvedValue(topic) } };
    const stances = { list: jest.fn().mockResolvedValue({
      count: 1,
      commonGroundCount: 1,
      roots: [{ id: '1', parentId: null, title: '測試立場', agreed: 2, disagreed: 1, discussionCount: 0, commonGround: true, unvotedAgree: 1, children: [], camps: [
        { optionId: '10', label: '支持', count: 2 },
        { optionId: '11', label: '不支持', count: 1 },
      ] }],
    }) };
    const policy = analyticsPolicy(true);
    const service = new TopicAnalyticsService(prisma as never, stances as never, policy as never, { assertCanView: jest.fn() } as never);

    const result = await service.stanceInsights(1n, 9n);

    expect(result.nodes[0]).toEqual(expect.objectContaining({ agreed: null, disagreed: null, camps: null, suppressed: true }));
    expect(result.commonGroundCount).toBe(0);
  });

  it('filters unpublished topics from comparisons', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { topic: { findMany } };
    const policy = analyticsPolicy(true);
    const service = new TopicAnalyticsService(prisma as never, {} as never, policy as never, { assertCanView: jest.fn() } as never);

    await expect(service.comparison(9n, [1n, 2n], 'AGE_BAND')).rejects.toBeInstanceOf(NotFoundException);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { in: ['OPEN', 'LOCKED', 'SETTLED'] } }),
    }));
  });

  it('does not expose analytics for a draft topic', async () => {
    const prisma = { topic: { findUnique: jest.fn().mockResolvedValue({ ...topic, moderationStatus: 'PENDING' }) } };
    const policy = analyticsPolicy(true);
    const service = new TopicAnalyticsService(prisma as never, {} as never, policy as never, { assertCanView: jest.fn() } as never);

    await expect(service.trends(1n, 9n)).rejects.toBeInstanceOf(NotFoundException);
  });
});

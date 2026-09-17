import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { TopicType } from '@prisma/client';
import { validate } from 'class-validator';
import { ImportTopicDto, ImportTopicStanceDto } from './dto/import-topic.dto';
import { TopicsService } from './topics.service';

describe('TopicsService importEditorial', () => {
  const findFirst = jest.fn();
  const assertActiveCategory = jest.fn();
  const create = jest.fn();
  const stanceCreate = jest.fn();
  const policy = { assert: jest.fn() };
  const prisma = {
    topic: { findFirst },
    $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback({
      topic: { create },
      topicStance: { create: stanceCreate },
    })),
  };
  const categories = { assertActiveCategory };
  const service = new TopicsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    policy as never,
    categories as never,
    {} as never,
  );

  const base = {
    title: '你支持地方政府試辦行人優先區嗎？',
    description: '試辦期間重新配置道路空間，並持續觀察事故與通行效率變化。',
    category: 'politics',
    topicType: TopicType.BINARY,
    options: ['支持', '支持但可調整'],
    voteDurationDays: 7,
    blocks: [{
      type: 'CASE' as const,
      title: '某縣市實際案例',
      content: '該縣市在特定學區周邊劃設行人優先區，並限制車流。',
      sourceLabel: '縣市政府資料',
      sourceUrl: 'https://example.gov.tw/report',
      occurredAt: '2025-01-15',
    }],
    stances: [{
      title: '支持優先區，但要求保留停車位',
      rationale: '快速通行不該以鄰里停車需求為代價。',
      children: [{
        title: '尖峰時段仍開放接送臨停',
        rationale: '學區接送是剛性需求。',
      }],
    }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    policy.assert.mockResolvedValue(undefined);
    findFirst.mockResolvedValue(null);
    assertActiveCategory.mockResolvedValue(undefined);
    create.mockResolvedValue({
      id: BigInt(10),
      title: base.title,
      description: base.description,
      category: base.category,
      topicType: base.topicType,
      status: 'OPEN',
      moderationStatus: 'APPROVED',
      voteDurationDays: 7,
      totalVotes: BigInt(0),
      voterCount: BigInt(0),
      spectrumMedian: null,
      spectrumStddev: null,
      featuredOrder: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      options: [],
      contentBlocks: [],
      creator: { nickname: '編輯', avatarUrl: null },
    });
    stanceCreate.mockResolvedValue({ id: BigInt(1) });
  });

  it('creates a topic, blocks, and a nested stance tree in order', async () => {
    await service.importEditorial(BigInt(5), { ...base, publish: true });

    expect(policy.assert).toHaveBeenCalledWith(BigInt(5), 'TOPIC_DRAFT', {});
    expect(policy.assert).toHaveBeenCalledWith(BigInt(5), 'TOPIC_PUBLISH', {});
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'OPEN',
        moderationStatus: 'APPROVED',
        contentBlocks: { create: expect.arrayContaining([expect.objectContaining({ sourceUrl: 'https://example.gov.tw/report' })]) },
      }),
      include: expect.any(Object),
    });
    expect(stanceCreate.mock.calls.map((call: Array<{ data: ImportTopicStanceDto & { depth: number; parentId: bigint | null; creatorId: bigint } }>) => call[0].data)).toEqual([
      expect.objectContaining({ depth: 0, parentId: null, creatorId: BigInt(5) }),
      expect.objectContaining({ depth: 1, parentId: BigInt(1), creatorId: BigInt(5) }),
    ]);
  });

  it('saves as draft when publish is false', async () => {
    await service.importEditorial(BigInt(5), { ...base, publish: false });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'DRAFT', voteEndAt: null }),
      include: expect.any(Object),
    });
  });

  it('rejects stance trees deeper than STANCE_MAX_DEPTH', async () => {
    process.env.STANCE_MAX_DEPTH = '4';
    const deep: ImportTopicStanceDto = {
      title: '根',
      children: [{ title: '一層', children: [{ title: '二層', children: [{ title: '三層', children: [{ title: '四層', children: [{ title: '五層' as string }] }] }] }] }],
    } as unknown as ImportTopicStanceDto;

    await expect(service.importEditorial(BigInt(5), { ...base, stances: [deep], publish: false }))
      .rejects.toBeInstanceOf(BadRequestException);
    delete process.env.STANCE_MAX_DEPTH;
  });

  it('rejects duplicate titles', async () => {
    findFirst.mockResolvedValue({ id: BigInt(1) });

    await expect(service.importEditorial(BigInt(5), { ...base, publish: false }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects inactive categories', async () => {
    assertActiveCategory.mockRejectedValue(new BadRequestException('分類不存在或未啟用'));

    await expect(service.importEditorial(BigInt(5), { ...base, publish: false }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires TOPIC_PUBLISH when publish is true', async () => {
    policy.assert.mockImplementation((_userId: bigint, capability: string) => {
      if (capability === 'TOPIC_PUBLISH') return Promise.reject(new ForbiddenException());
      return Promise.resolve(undefined);
    });

    await expect(service.importEditorial(BigInt(5), { ...base, publish: true }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates editorial option counts through CreateTopicDto rules', async () => {
    const topicErrors = await validate(Object.assign(new ImportTopicDto(), {
      title: base.title,
      description: base.description,
      category: base.category,
      topicType: 'BINARY',
      options: ['支持'],
      voteDurationDays: 7,
      publish: true,
      stances: [],
    }));

    expect(topicErrors.some((error) => error.property === 'options')).toBe(true);
  });
});

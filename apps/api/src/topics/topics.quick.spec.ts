import { BadRequestException } from '@nestjs/common';
import { TopicKind } from '@prisma/client';
import { TopicsService } from './topics.service';

describe('TopicsService createQuick option labels', () => {
  const imageUrl = (name: string) => `/api/v1/option-images/${name}`;

  function createService() {
    const create = jest.fn();
    const prisma = {
      topic: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback({ topic: { create } })),
    };
    const service = new TopicsService(
      prisma as never,
      {} as never,
      { incr: jest.fn().mockResolvedValue(1), expire: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      { assertSeniorMember: jest.fn().mockResolvedValue(undefined) } as never,
      { assertActiveCategory: jest.fn().mockResolvedValue(undefined) } as never,
      { createShareLink: jest.fn().mockResolvedValue(null) } as never,
    );
    jest.spyOn(service as never as { fanOutChannelNewTopic: () => Promise<void> }, 'fanOutChannelNewTopic').mockResolvedValue(undefined);
    return { service, create };
  }

  function createdTopic(options: Array<{ label: string; data?: Record<string, unknown> }>) {
    return {
      id: 10n,
      title: '圖片快問',
      description: null,
      category: 'quick',
      kind: TopicKind.QUICK,
      featuredOrder: null,
      topicType: 'IMAGE_MULTIPLE',
      status: 'OPEN',
      moderationStatus: 'APPROVED',
      moderationNote: null,
      creatorId: 1n,
      audienceOwnerId: 1n,
      audienceOwner: null,
      creator: { nickname: '會員', avatarUrl: null },
      visibility: 'PUBLIC',
      audience: 'MEMBER_ONLY',
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      voteEndAt: new Date(),
      voteDurationDays: null,
      voteDurationHours: 24,
      minVotes: null,
      totalVotes: 0n,
      voterCount: 0n,
      spectrumMedian: null,
      spectrumStddev: null,
      contentBlocks: [],
      options: options.map((option, index) => ({ id: BigInt(index + 1), label: option.label, voteCount: 0n, data: option.data ?? null })),
    };
  }

  function baseDto(overrides: Record<string, unknown>) {
    return { title: '圖片快問標題', topicType: 'IMAGE_MULTIPLE', voteDurationHours: 24, ...overrides };
  }

  it('allows empty and duplicate labels for image options and keeps images aligned by index', async () => {
    const { service, create } = createService();
    const options = ['', '重複', '重複'];
    const optionImages = [imageUrl('a'), imageUrl('b'), imageUrl('c')];
    create.mockResolvedValue(createdTopic(options.map((label, index) => ({ label, data: { imageUrl: optionImages[index] } }))));

    await service.createQuick(1n, baseDto({ options, optionImages }) as never);

    const createdOptions = create.mock.calls[0][0].data.options.create;
    expect(createdOptions.map((option: { label: string }) => option.label)).toEqual(['', '重複', '重複']);
    expect(createdOptions.map((option: { data?: { imageUrl?: string } }) => option.data?.imageUrl)).toEqual(optionImages);
  });

  it('allows empty labels for image rank within the 4 to 50 range', async () => {
    const { service, create } = createService();
    const options = ['', '', '', ''];
    const optionImages = options.map((_, index) => imageUrl(`rank-${index}`));
    create.mockResolvedValue(createdTopic(options.map((label, index) => ({ label, data: { imageUrl: optionImages[index] } }))));

    await expect(service.createQuick(1n, baseDto({ topicType: 'IMAGE_RANK', options, optionImages }) as never)).resolves.toBeDefined();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('still rejects empty labels for non-image option types', async () => {
    const { service, create } = createService();

    await expect(service.createQuick(1n, baseDto({ topicType: 'MULTIPLE', options: ['', '選項'] }) as never))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('still rejects duplicate labels for non-image option types', async () => {
    const { service, create } = createService();

    await expect(service.createQuick(1n, baseDto({ topicType: 'MULTIPLE', options: ['相同', '相同'] }) as never))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('generates five fixed star options without requiring scale labels', async () => {
    const { service, create } = createService();
    create.mockResolvedValue(createdTopic([]));

    await service.createQuick(1n, baseDto({ topicType: 'STAR_RATING' }) as never);

    const data = create.mock.calls[0][0].data;
    expect(data.options.create.map((option: { label: string; data: { value: number } }) => [option.label, option.data.value])).toEqual([
      ['1', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5],
    ]);
    expect(data.scaleMinLabel).toBeNull();
    expect(data.scaleMaxLabel).toBeNull();
  });

  it.each([
    ['LIKERT_5', 5],
    ['LIKERT_7', 7],
  ])('generates fixed numeric options for %s and persists scale labels', async (topicType, size) => {
    const { service, create } = createService();
    create.mockResolvedValue(createdTopic([]));

    await service.createQuick(1n, baseDto({
      topicType,
      options: ['client supplied'],
      scaleMinLabel: '非常不同意',
      scaleMaxLabel: '非常同意',
    }) as never);

    const data = create.mock.calls[0][0].data;
    expect(data.options.create.map((option: { label: string; data: { value: number } }) => [option.label, option.data.value])).toEqual(
      Array.from({ length: size }, (_, index) => [String(index + 1), index + 1]),
    );
    expect(data.scaleMinLabel).toBe('非常不同意');
    expect(data.scaleMaxLabel).toBe('非常同意');
  });

  it('rejects identical Likert endpoint labels', async () => {
    const { service } = createService();

    await expect(service.createQuick(1n, baseDto({
      topicType: 'LIKERT_5',
      scaleMinLabel: '相同',
      scaleMaxLabel: '相同',
    }) as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates and persists multi-select settings', async () => {
    const { service, create } = createService();
    create.mockResolvedValue(createdTopic([]));

    await service.createQuick(1n, baseDto({ topicType: 'MULTI_SELECT', options: ['甲', '乙', '丙'], maxSelections: 2 }) as never);

    expect(create.mock.calls[0][0].data.maxSelections).toBe(2);
    await expect(service.createQuick(1n, baseDto({ topicType: 'MULTI_SELECT', options: ['甲', '乙'], maxSelections: 3 }) as never))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});

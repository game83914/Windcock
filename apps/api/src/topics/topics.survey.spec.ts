import { ConflictException } from '@nestjs/common';
import { TopicKind, TopicType } from '@prisma/client';
import { TopicsService } from './topics.service';

describe('TopicsService createSurvey', () => {
  function createService(prismaOverrides: Record<string, unknown> = {}) {
    const create = jest.fn();
    const prisma = {
      topic: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback({ topic: { create } })),
      ...prismaOverrides,
    };
    const policy = { assertSeniorMember: jest.fn().mockResolvedValue(undefined) };
    const categories = { assertActiveCategory: jest.fn().mockResolvedValue(undefined) };
    const access = { createShareLink: jest.fn().mockResolvedValue(null) };
    const service = new TopicsService(
      prisma as never,
      {} as never,
      { incr: jest.fn().mockResolvedValue(1), expire: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      policy as never,
      categories as never,
      access as never,
    );
    jest.spyOn(service as never as { serialize: () => unknown }, 'serialize').mockReturnValue({ id: '10' });
    jest.spyOn(service as never as { fanOutChannelNewTopic: () => Promise<void> }, 'fanOutChannelNewTopic').mockResolvedValue(undefined);
    return { service, create, prisma };
  }

  function dto(overrides: Record<string, unknown> = {}) {
    return {
      title: '週末出遊偏好大調查',
      voteDurationHours: 24,
      questions: [
        { title: '你最喜歡的交通方式', topicType: TopicType.MULTIPLE, options: ['火車', '汽車'] },
        { title: '拍照留念', topicType: TopicType.IMAGE_RANK, options: ['', '', '', ''], optionImages: ['/api/v1/option-images/a', '/api/v1/option-images/b', '/api/v1/option-images/c', '/api/v1/option-images/d'] },
      ],
      ...overrides,
    };
  }

  it('creates a SURVEY parent plus one QUICK child per question with sortOrder', async () => {
    const { service, create } = createService();
    create
      .mockResolvedValueOnce({ id: 10n, title: '週末出遊偏好大調查' })
      .mockResolvedValue({ id: 11n });

    const result = await service.createSurvey(1n, dto() as never);

    expect(result).toEqual({ id: '10', questionCount: 2 });
    expect(create).toHaveBeenCalledTimes(3);

    const parentData = create.mock.calls[0][0].data;
    expect(parentData.kind).toBe(TopicKind.SURVEY);
    expect(parentData.topicType).toBe(TopicType.SURVEY);
    expect(parentData.category).toBe('quick');
    expect(parentData.moderationStatus).toBe('APPROVED');
    expect(parentData.parentTopicId).toBeUndefined();

    const firstChild = create.mock.calls[1][0].data;
    expect(firstChild.kind).toBe(TopicKind.QUICK);
    expect(firstChild.parentTopicId).toBe(10n);
    expect(firstChild.sortOrder).toBe(0);
    expect(firstChild.options.create.map((option: { label: string }) => option.label)).toEqual(['火車', '汽車']);

    const secondChild = create.mock.calls[2][0].data;
    expect(secondChild.parentTopicId).toBe(10n);
    expect(secondChild.sortOrder).toBe(1);
    expect(secondChild.topicType).toBe(TopicType.IMAGE_RANK);
    expect(secondChild.options.create).toHaveLength(4);
  });

  it('rejects a duplicate title before creating anything', async () => {
    const { service, create } = createService({ topic: { findFirst: jest.fn().mockResolvedValue({ id: 1n }) } });

    await expect(service.createSurvey(1n, dto() as never)).rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('persists rating labels and multi-select limits on child topics', async () => {
    const { service, create } = createService();
    create.mockResolvedValueOnce({ id: 10n, title: '量表與複選問卷' }).mockResolvedValue({ id: 11n });

    await service.createSurvey(1n, dto({
      title: '量表與複選問卷',
      questions: [
        { title: '服務滿意度如何', topicType: TopicType.LIKERT_5, scaleMinLabel: '不滿意', scaleMaxLabel: '滿意' },
        { title: '可接受的交通方式', topicType: TopicType.MULTI_SELECT, options: ['火車', '汽車', '單車'], maxSelections: 2 },
      ],
    }) as never);

    expect(create.mock.calls[1][0].data).toMatchObject({ scaleMinLabel: '不滿意', scaleMaxLabel: '滿意' });
    expect(create.mock.calls[1][0].data.options.create).toHaveLength(5);
    expect(create.mock.calls[2][0].data.maxSelections).toBe(2);
  });
});

describe('TopicsService isSurveyComplete', () => {
  function service() {
    return new TopicsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    ) as never as { isSurveyComplete: (tx: unknown, parentTopicId: bigint, userId: bigint) => Promise<boolean> };
  }

  function tx(questions: Array<{ id: bigint; topicType: string }>, voteCount: number, rankCount: number) {
    return {
      topic: { findMany: jest.fn().mockResolvedValue(questions) },
      vote: { count: jest.fn().mockResolvedValue(voteCount) },
      topicRankResult: { count: jest.fn().mockResolvedValue(rankCount) },
    };
  }

  it('counts regular votes and image-rank results together', async () => {
    const instance = service();
    const client = tx([{ id: 1n, topicType: 'BINARY' }, { id: 2n, topicType: 'IMAGE_RANK' }], 1, 1);

    await expect(instance.isSurveyComplete(client as never, 9n, 1n)).resolves.toBe(true);
    expect(client.vote.count).toHaveBeenCalledWith({ where: { userId: 1n, topicId: { in: [1n] } } });
    expect(client.topicRankResult.count).toHaveBeenCalledWith({ where: { userId: 1n, topicId: { in: [2n] } } });
  });

  it('is incomplete when a question is unanswered', async () => {
    const instance = service();
    const client = tx([{ id: 1n, topicType: 'BINARY' }, { id: 2n, topicType: 'IMAGE_RANK' }], 1, 0);

    await expect(instance.isSurveyComplete(client as never, 9n, 1n)).resolves.toBe(false);
  });

  it('is incomplete for a survey without questions', async () => {
    const instance = service();
    const client = tx([], 0, 0);

    await expect(instance.isSurveyComplete(client as never, 9n, 1n)).resolves.toBe(false);
    expect(client.vote.count).not.toHaveBeenCalled();
  });

  it('records survey completion as an empty parent Vote once', async () => {
    const instance = service() as unknown as {
      ensureSurveyCompletionVote: (tx: unknown, parentTopicId: bigint, userId: bigint) => Promise<void>;
    };
    const client = {
      vote: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 20n }),
      },
      topic: { update: jest.fn().mockResolvedValue(undefined) },
    };

    await instance.ensureSurveyCompletionVote(client as never, 9n, 1n);

    expect(client.vote.create).toHaveBeenCalledWith({ data: { userId: 1n, topicId: 9n } });
    expect(client.topic.update).toHaveBeenCalledWith({
      where: { id: 9n },
      data: { totalVotes: { increment: 1 }, voterCount: { increment: 1 } },
    });
  });
});

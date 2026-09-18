import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TopicType } from '@prisma/client';
import { CreateQuickTopicDto, CreateSurveyQuestionDto, ScratchRevealMode } from './topic.dto';

describe('scratch card DTOs', () => {
  it.each([CreateQuickTopicDto, CreateSurveyQuestionDto])('validates nested scratch results for %p', async (Dto) => {
    const value = plainToInstance(Dto, {
      title: '刮刮樂題目',
      topicType: TopicType.SCRATCH,
      voteDurationHours: 24,
      scratchCard: {
        revealMode: ScratchRevealMode.PER_RESULT,
        showText: false,
        results: [
          { label: '結果甲', revealImageUrl: '/api/v1/option-images/a', weight: 2 },
          { label: '結果乙' },
        ],
      },
    }, { enableImplicitConversion: true });

    await expect(validate(value as object, { whitelist: true })).resolves.toHaveLength(0);
  });

  it('rejects too few results, non-boolean showText, and non-positive weights', async () => {
    const value = plainToInstance(CreateQuickTopicDto, {
      title: '刮刮樂題目',
      topicType: TopicType.SCRATCH,
      voteDurationHours: 24,
      scratchCard: { showText: 'yes', results: [{ label: '唯一結果', weight: 0 }] },
    }, { enableImplicitConversion: true });
    const errors = await validate(value, { whitelist: true });

    expect(errors.some((error) => error.property === 'scratchCard')).toBe(true);
  });

  it('does not coerce malformed scratch primitive types', async () => {
    const value = plainToInstance(CreateQuickTopicDto, {
      title: '刮刮樂題目',
      topicType: TopicType.SCRATCH,
      voteDurationHours: 24,
      scratchCard: { showText: 'false', results: [{ label: '甲', weight: '2' }, { label: '乙' }] },
    }, { enableImplicitConversion: true });

    expect(await validate(value, { whitelist: true })).not.toHaveLength(0);
  });

  it('applies SHARED and showText defaults when omitted', () => {
    const value = plainToInstance(CreateQuickTopicDto, {
      title: '刮刮樂題目',
      topicType: TopicType.SCRATCH,
      voteDurationHours: 24,
      scratchCard: { results: [{ label: '甲' }, { label: '乙' }] },
    }, { enableImplicitConversion: true });

    expect(value.scratchCard).toMatchObject({ revealMode: ScratchRevealMode.SHARED, showText: true });
  });
});

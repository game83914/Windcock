import { BadGatewayException } from '@nestjs/common';
import { TopicType } from '@prisma/client';
import { aiDevContentJsonSchema, validateAiDevContent } from './ai-dev-content.schemas';

function quickTopic(overrides: Record<string, unknown> = {}) {
  return {
    title: '今天中午想吃什麼？',
    topicType: TopicType.MULTIPLE,
    options: ['火鍋', '燒肉', '拉麵'],
    matches: [],
    weights: [],
    prompt: '',
    scaleMinLabel: '',
    scaleMaxLabel: '',
    scalePoints: 5,
    maxSelections: 1,
    scratchCard: { revealMode: 'SHARED', showText: true, results: [] },
    ...overrides,
  };
}

describe('validateAiDevContent', () => {
  it('accepts a valid multi-kind payload', () => {
    const result = validateAiDevContent(
      {
        formal: [{ title: '市區公車班次是否應該增加？', description: '尖峰時段擁擠與班距穩定的公共討論，至少二十個字以上才符合規範。', category: 'society', options: ['應該增加', '維持現狀'], blocks: [] }],
        quick: [quickTopic()],
        surveys: [{ title: '週末出遊偏好大調查', voteDurationHours: 24, questions: [quickTopic({ title: '最喜歡的交通方式' }), quickTopic({ title: '最想去的地點' })] }],
      },
      ['society'],
      ['formal', 'quick', 'survey'],
    );

    expect(result.formal).toHaveLength(1);
    expect(result.quick).toHaveLength(1);
    expect(result.surveys[0].questions).toHaveLength(2);
  });

  it('only validates requested kinds', () => {
    const result = validateAiDevContent({ formal: [], quick: [quickTopic()], surveys: [] }, [], ['quick']);

    expect(result.quick).toHaveLength(1);
    expect(result.formal).toHaveLength(0);
  });

  it('rejects wrong top-level shape and empty kind arrays', () => {
    expect(() => validateAiDevContent({}, [], ['quick'])).toThrow(BadGatewayException);
    expect(() => validateAiDevContent({ formal: [], quick: [], surveys: [] }, [], ['quick'])).toThrow(BadGatewayException);
  });

  it('rejects bad titles, duplicates and out-of-range options', () => {
    expect(() => validateAiDevContent({ formal: [], quick: [{ ...quickTopic(), title: '短' }], surveys: [] }, [], ['quick'])).toThrow(BadGatewayException);
    expect(() => validateAiDevContent({ formal: [], quick: [{ ...quickTopic(), options: ['同', '同'] }], surveys: [] }, [], ['quick'])).toThrow(BadGatewayException);
    expect(() => validateAiDevContent({ formal: [], quick: [{ ...quickTopic(), topicType: TopicType.BINARY, options: ['只有一個'] }], surveys: [] }, [], ['quick'])).toThrow(BadGatewayException);
    expect(() => validateAiDevContent({ formal: [], quick: [{ ...quickTopic(), topicType: TopicType.IMAGE_RANK }], surveys: [] }, [], ['quick'])).toThrow(BadGatewayException);
  });

  it('rejects bad matching, weights, likert and scratch settings', () => {
    expect(() => validateAiDevContent({ formal: [], quick: [{ ...quickTopic(), topicType: TopicType.MATCHING, options: ['左一', '左二'], matches: ['右一'] }], surveys: [] }, [], ['quick'])).toThrow(BadGatewayException);
    expect(() => validateAiDevContent({ formal: [], quick: [{ ...quickTopic(), topicType: TopicType.SPIN_WHEEL, weights: [1, 0, 1] }], surveys: [] }, [], ['quick'])).toThrow(BadGatewayException);
    expect(() => validateAiDevContent({ formal: [], quick: [{ ...quickTopic(), topicType: TopicType.LIKERT, scalePoints: 11, scaleMinLabel: '低', scaleMaxLabel: '高' }], surveys: [] }, [], ['quick'])).toThrow(BadGatewayException);
    expect(() => validateAiDevContent({ formal: [], quick: [{ ...quickTopic(), topicType: TopicType.SCRATCH, scratchCard: { revealMode: 'SHARED', showText: true, results: [{ label: '唯一' }] } }], surveys: [] }, [], ['quick'])).toThrow(BadGatewayException);
  });

  it('rejects unknown categories and short survey lists', () => {
    expect(() => validateAiDevContent({ formal: [{ title: '市區公車班次是否應該增加？', description: '尖峰時段擁擠與班距穩定的公共討論，至少二十個字以上才符合規範。', category: 'nope', options: ['甲', '乙'] }], quick: [], surveys: [] }, ['society'], ['formal'])).toThrow(BadGatewayException);
    expect(() => validateAiDevContent({ formal: [], quick: [], surveys: [{ title: '只有一題的問卷調查', voteDurationHours: 24, questions: [quickTopic()] }] }, [], ['survey'])).toThrow(BadGatewayException);
  });
});

describe('aiDevContentJsonSchema', () => {
  it('exposes a strict top-level schema', () => {
    const schema = aiDevContentJsonSchema() as { required: string[]; properties: Record<string, unknown> };

    expect(schema.required).toEqual(['formal', 'quick', 'surveys']);
    expect(Object.keys(schema.properties)).toEqual(['formal', 'quick', 'surveys']);
  });
});

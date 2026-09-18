import { describe, expect, it } from 'vitest';
import {
  backendTopicType,
  BUILDER_RULES,
  builderHeading,
  builderPlaceholder,
  createScratchCardDraft,
  DEFAULT_COUNT,
  isImageBuilder,
  questionPayload,
  seedRows,
  type BuilderType,
} from './questionBuilder';

describe('BUILDER_RULES', () => {
  it('covers every builder type with sane min/max', () => {
    const types: BuilderType[] = ['OPTION', 'IMAGE_OPTION', 'IMAGE_RANK', 'SPECTRUM', 'SHORT_ANSWER', 'MATCHING', 'PUZZLE', 'SCRATCH', 'SPIN_WHEEL', 'LOTTERY', 'STAR_RATING', 'LIKERT', 'MULTI_SELECT'];
    for (const type of types) {
      expect(BUILDER_RULES[type], type).toBeDefined();
      expect(BUILDER_RULES[type].min, `${type}.min`).toBeLessThanOrEqual(BUILDER_RULES[type].max);
    }
  });

  it('marks row-less types as NONE', () => {
    expect(BUILDER_RULES.SPECTRUM.needs).toBe('NONE');
    expect(BUILDER_RULES.SHORT_ANSWER.needs).toBe('NONE');
    expect(BUILDER_RULES.STAR_RATING.needs).toBe('NONE');
    expect(BUILDER_RULES.LIKERT.needs).toBe('NONE');
    expect(BUILDER_RULES.OPTION.needs).not.toBe('NONE');
    expect(BUILDER_RULES.MULTI_SELECT.needs).not.toBe('NONE');
  });

  it('seeds the default row count per type', () => {
    expect(seedRows('OPTION')).toHaveLength(DEFAULT_COUNT.OPTION);
    expect(seedRows('SPECTRUM')).toHaveLength(0);
    expect(seedRows('MULTI_SELECT')).toHaveLength(DEFAULT_COUNT.MULTI_SELECT);
    expect(seedRows('IMAGE_RANK')).toHaveLength(8);
  });

  it('detects image builders', () => {
    expect(isImageBuilder('IMAGE_OPTION')).toBe(true);
    expect(isImageBuilder('IMAGE_RANK')).toBe(true);
    expect(isImageBuilder('OPTION')).toBe(false);
  });

  it('has headings and placeholders for every type', () => {
    const types = Object.keys(BUILDER_RULES) as BuilderType[];
    for (const type of types) {
      expect(builderHeading(type).length).toBeGreaterThan(0);
      expect(builderPlaceholder(type).length).toBeGreaterThan(0);
    }
  });
});

describe('backendTopicType', () => {
  it('maps two filled options to BINARY, more to MULTIPLE', () => {
    expect(backendTopicType('OPTION', ['a', 'b'])).toBe('BINARY');
    expect(backendTopicType('OPTION', ['a', 'b', 'c'])).toBe('MULTIPLE');
  });

  it('maps image options and passes other types through', () => {
    expect(backendTopicType('IMAGE_OPTION', [])).toBe('IMAGE_MULTIPLE');
    expect(backendTopicType('MULTI_SELECT', [])).toBe('MULTI_SELECT');
    expect(backendTopicType('STAR_RATING', [])).toBe('STAR_RATING');
    expect(backendTopicType('LIKERT', [])).toBe('LIKERT');
  });
});

describe('questionPayload', () => {
  function rows(labels: string[]) {
    return labels.map((label, index) => ({ id: `row-${index}`, label, match: '', weight: '', image: null }));
  }

  it('includes trimmed options for list types', () => {
    const payload = questionPayload({ type: 'OPTION', rows: rows([' a ', 'b']), prompt: '' });
    expect(payload.topicType).toBe('BINARY');
    expect(payload.options).toEqual(['a', 'b']);
  });

  it('includes matches for matching questions', () => {
    const payload = questionPayload({
      type: 'MATCHING',
      rows: [
        { id: 'r0', label: '左', match: '右', weight: '', image: null },
      ],
      prompt: '',
    });
    expect(payload.matches).toEqual(['右']);
  });

  it('includes integer weights only when all valid', () => {
    const payload = questionPayload({
      type: 'SPIN_WHEEL',
      rows: [
        { id: 'r0', label: 'a', match: '', weight: '2', image: null },
        { id: 'r1', label: 'b', match: '', weight: '3', image: null },
      ],
      prompt: '',
    });
    expect(payload.weights).toEqual([2, 3]);
  });

  it('omits options for row-less types but keeps scale labels, points and max selections', () => {
    const likert = questionPayload({ type: 'LIKERT', rows: [], prompt: '', points: 7, scaleMinLabel: '低', scaleMaxLabel: '高' });
    expect(likert.options).toBeUndefined();
    expect(likert.topicType).toBe('LIKERT');
    expect(likert.scalePoints).toBe(7);
    expect(likert.scaleMinLabel).toBe('低');
    expect(likert.scaleMaxLabel).toBe('高');

    const likertDefault = questionPayload({ type: 'LIKERT', rows: [], prompt: '', scaleMinLabel: '低', scaleMaxLabel: '高' });
    expect(likertDefault.scalePoints).toBe(5);

    const likertClamped = questionPayload({ type: 'LIKERT', rows: [], prompt: '', points: 99, scaleMinLabel: '低', scaleMaxLabel: '高' });
    expect(likertClamped.scalePoints).toBe(5);

    const multi = questionPayload({ type: 'MULTI_SELECT', rows: rows(['a', 'b']), prompt: '', maxSelections: 2 });
    expect(multi.maxSelections).toBe(2);
  });

  it('includes prompt only for short answers', () => {
    const short = questionPayload({ type: 'SHORT_ANSWER', rows: [], prompt: ' 提示 ' });
    expect(short.prompt).toBe('提示');
    const option = questionPayload({ type: 'OPTION', rows: rows(['a', 'b']), prompt: '提示' });
    expect(option.prompt).toBeUndefined();
  });

  it('builds a nested shared scratch card payload with equal default weights', () => {
    const payload = questionPayload({
      type: 'SCRATCH',
      rows: rows(['頭獎', '再試一次']),
      prompt: '',
      scratchCard: { ...createScratchCardDraft(), coverImageUrl: '/cover.png', sharedRevealImageUrl: '/reveal.png' },
    });
    expect(payload.options).toBeUndefined();
    expect(payload.scratchCard).toEqual({
      coverImageUrl: '/cover.png',
      revealMode: 'SHARED',
      sharedRevealImageUrl: '/reveal.png',
      showText: true,
      results: [{ label: '頭獎' }, { label: '再試一次' }],
    });
  });

  it('builds per-result scratch images and positive integer weights', () => {
    const payload = questionPayload({
      type: 'SCRATCH',
      rows: [
        { id: 'r0', label: 'A', match: '', weight: '2', image: '/a.png' },
        { id: 'r1', label: 'B', match: '', weight: '', image: null },
      ],
      prompt: '',
      scratchCard: { coverImageUrl: null, revealMode: 'PER_RESULT', sharedRevealImageUrl: '/ignored.png', showText: false },
    });
    expect(payload.scratchCard).toEqual({
      revealMode: 'PER_RESULT',
      showText: false,
      results: [
        { label: 'A', revealImageUrl: '/a.png', weight: 2 },
        { label: 'B' },
      ],
    });
  });
});

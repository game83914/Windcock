import { describe, expect, it } from 'vitest';
import type { Topic, TopicOption } from '~/types/topic';
import {
  isImageOptionType,
  isImageRankType,
  isOptionPickType,
  isRatingType,
  leadingOptions,
  multiSelectPercentage,
  optionPercentage,
  optionValue,
  ratingScaleSize,
  topicTypeLabel,
  weightedOptionAverage,
} from './topic';

function option(partial: Partial<TopicOption> & { id: string }): TopicOption {
  return { label: 'x', voteCount: '0', ...partial };
}

function topic(partial: Partial<Topic> = {}): Topic {
  return {
    id: '1',
    title: 't',
    category: 'quick',
    visibility: 'PUBLIC',
    audience: 'MEMBER_ONLY',
    topicType: 'MULTIPLE',
    status: 'OPEN',
    moderationStatus: 'APPROVED',
    creator: { id: null, nickname: 'n', type: 'MEMBER' },
    proposedBy: [],
    createdAt: '',
    voteDurationDays: 7,
    totalVotes: '0',
    voterCount: '0',
    hasVoted: false,
    blocks: [],
    options: [],
    ...partial,
  };
}

describe('optionPercentage', () => {
  it('returns 0 without votes and rounds otherwise', () => {
    expect(optionPercentage(option({ id: '1', voteCount: '0' }), topic({ totalVotes: '0' }))).toBe(0);
    expect(optionPercentage(option({ id: '1', voteCount: '1' }), topic({ totalVotes: '3' }))).toBe(33);
  });
});

describe('multiSelectPercentage', () => {
  it('divides by respondents and may exceed 100 in aggregate', () => {
    const t = topic({ voterCount: '2' });
    expect(multiSelectPercentage(option({ id: '1', voteCount: '2' }), t)).toBe(100);
    expect(multiSelectPercentage(option({ id: '1', voteCount: '1' }), t)).toBe(50);
    expect(multiSelectPercentage(option({ id: '1', voteCount: '0' }), topic({ voterCount: '0' }))).toBe(0);
  });
});

describe('type helpers', () => {
  it('labels every quick type', () => {
    for (const type of ['BINARY', 'MULTIPLE', 'STAR_RATING', 'LIKERT', 'MULTI_SELECT'] as const) {
      expect(topicTypeLabel(type)).not.toBe('選項題');
    }
    expect(topicTypeLabel('UNKNOWN')).toBe('選項題');
  });

  it('classifies pick/image/rating types', () => {
    expect(isOptionPickType('BINARY')).toBe(true);
    expect(isOptionPickType('MULTI_SELECT')).toBe(false);
    expect(isImageOptionType('IMAGE_MULTIPLE')).toBe(true);
    expect(isImageRankType('IMAGE_RANK')).toBe(true);
    expect(isRatingType('STAR_RATING')).toBe(true);
    expect(isRatingType('LIKERT')).toBe(true);
    expect(isRatingType('MULTIPLE')).toBe(false);
  });

  it('sizes rating scales from scalePoints with options.length fallback', () => {
    expect(ratingScaleSize(topic({ topicType: 'LIKERT', scalePoints: 7, options: [] }))).toBe(7);
    expect(ratingScaleSize(topic({ topicType: 'LIKERT', scalePoints: 3, options: [] }))).toBe(3);
    expect(ratingScaleSize(topic({ topicType: 'STAR_RATING', options: [] }))).toBe(5);
    expect(ratingScaleSize(topic({ topicType: 'LIKERT', options: [option({ id: '1' }), option({ id: '2' }), option({ id: '3' }), option({ id: '4' })] }))).toBe(4);
    expect(ratingScaleSize(topic({ topicType: 'LIKERT', options: [] }))).toBe(5);
  });
});

describe('optionValue and weightedOptionAverage', () => {
  it('prefers stored value, falls back to position', () => {
    expect(optionValue(option({ id: '1', data: { value: 4 } }), 0)).toBe(4);
    expect(optionValue(option({ id: '1' }), 2)).toBe(3);
  });

  it('averages by vote counts', () => {
    const t = topic({
      options: [option({ id: '1', voteCount: '1' }), option({ id: '2', voteCount: '3' })],
    });
    expect(weightedOptionAverage(t)).toBe(1.75);
    expect(weightedOptionAverage(topic())).toBe(0);
  });
});

describe('leadingOptions', () => {
  it('returns top options by vote count', () => {
    const t = topic({
      options: [option({ id: '1', voteCount: '1' }), option({ id: '2', voteCount: '5' }), option({ id: '3', voteCount: '3' })],
    });
    expect(leadingOptions(t, 2).map((o) => o.id)).toEqual(['2', '3']);
  });
});

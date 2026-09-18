import { describe, expect, it } from 'vitest';
import {
  applyQuickPayload,
  applySurveyPayload,
  serializeQuickForm,
  serializeSurveyForm,
  type QuickFormState,
} from './draftSerializer';
import { createScratchCardDraft, seedRows } from './questionBuilder';

function quickState(): QuickFormState {
  return {
    title: '午餐',
    builderType: 'OPTION',
    rows: seedRows('OPTION').map((row, index) => ({ ...row, label: `選項${index + 1}` })),
    prompt: '',
    points: 5,
    scaleMinLabel: '',
    scaleMaxLabel: '',
    maxSelections: 1,
    scratchCard: createScratchCardDraft(),
    voteDurationHours: 24,
    visibility: 'PUBLIC',
    audience: 'MEMBER_ONLY',
  };
}

describe('quick draft serializer', () => {
  it('round-trips form state and preserves image urls', () => {
    const state = { ...quickState(), builderType: 'IMAGE_OPTION' as const, rows: seedRows('IMAGE_OPTION').map((row) => ({ ...row, image: '/api/v1/option-images/a' })) };
    const restored = applyQuickPayload(JSON.parse(JSON.stringify(serializeQuickForm(state))));
    expect(restored).not.toBeNull();
    expect(restored?.rows.map((row) => row.image)).toEqual(['/api/v1/option-images/a', '/api/v1/option-images/a']);
    expect(restored?.rows.every((row) => typeof row.id === 'string')).toBe(true);
  });

  it('returns null for mismatched or broken payloads', () => {
    expect(applyQuickPayload(null)).toBeNull();
    expect(applyQuickPayload({ version: 1, form: 'survey', data: {} })).toBeNull();
    expect(applyQuickPayload({ version: 1, form: 'quick', data: { builderType: 'NOPE', rows: [] } })).toBeNull();
    expect(applyQuickPayload({ version: 1, form: 'quick', data: { builderType: 'OPTION', rows: [] } })).toBeNull();
  });
});

describe('survey draft serializer', () => {
  it('round-trips survey state', () => {
    const state = {
      title: '問卷',
      questions: [
        { questionTitle: 'Q1', type: 'OPTION' as const, rows: seedRows('OPTION').map((row) => ({ ...row, label: 'x' })), prompt: '', points: 5, scaleMinLabel: '', scaleMaxLabel: '', maxSelections: 1, scratchCard: createScratchCardDraft() },
      ],
      voteDurationHours: 12,
      visibility: 'PRIVATE_LINK' as const,
      audience: 'FOLLOWERS_ONLY' as const,
    };
    const restored = applySurveyPayload(JSON.parse(JSON.stringify(serializeSurveyForm(state))));
    expect(restored?.title).toBe('問卷');
    expect(restored?.questions).toHaveLength(1);
    expect(restored?.visibility).toBe('PRIVATE_LINK');
  });

  it('returns null for empty or oversized question lists', () => {
    expect(applySurveyPayload({ version: 1, form: 'survey', data: { questions: [] } })).toBeNull();
    expect(applySurveyPayload({ version: 1, form: 'survey', data: { questions: new Array(21).fill({ type: 'OPTION', rows: [{ label: 'x' }] }) } })).toBeNull();
  });
});

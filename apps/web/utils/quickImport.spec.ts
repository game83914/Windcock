import { describe, expect, it } from 'vitest';
import { buildQuickImportExample, parseQuickImport } from './quickImport';
import type { BuilderType } from './questionBuilder';

describe('buildQuickImportExample', () => {
  it('generates a parseable example for every builder type', () => {
    const types: BuilderType[] = ['OPTION', 'IMAGE_OPTION', 'IMAGE_RANK', 'SPECTRUM', 'SHORT_ANSWER', 'MATCHING', 'PUZZLE', 'SCRATCH', 'SPIN_WHEEL', 'STAR_RATING', 'LIKERT', 'MULTI_SELECT'];
    for (const type of types) {
      const example = buildQuickImportExample(type);
      const result = parseQuickImport(JSON.parse(JSON.stringify(example)));
      expect(result.ok, type).toBe(true);
    }
  });

  it('only includes relevant fields per type', () => {
    expect(buildQuickImportExample('SPECTRUM')).not.toHaveProperty('rows');
    expect(buildQuickImportExample('MATCHING')).toHaveProperty('rows');
    expect(buildQuickImportExample('SCRATCH')).toHaveProperty('scratchCard');
    expect(buildQuickImportExample('OPTION')).not.toHaveProperty('scratchCard');
  });
});

describe('parseQuickImport', () => {
  it('parses a valid option import', () => {
    const result = parseQuickImport({ title: '午餐吃什麼？', type: 'OPTION', rows: [{ label: '火鍋' }, { label: '燒肉' }] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.title).toBe('午餐吃什麼？');
      expect(result.draft.rows).toHaveLength(2);
    }
  });

  it('rejects non-object input and unknown types', () => {
    expect(parseQuickImport(null)).toEqual({ ok: false, error: expect.any(String) });
    expect(parseQuickImport({ type: 'UNKNOWN' }).ok).toBe(false);
    expect(parseQuickImport({}).ok).toBe(false);
  });

  it('rejects out-of-range row counts', () => {
    expect(parseQuickImport({ type: 'OPTION', rows: [{ label: '唯一' }] }).ok).toBe(false);
    expect(parseQuickImport({ type: 'SCRATCH', rows: [{ label: 'a' }] }).ok).toBe(false);
  });

  it('rejects duplicate labels and bad weights', () => {
    const dup = parseQuickImport({ type: 'OPTION', rows: [{ label: '同' }, { label: '同' }] });
    expect(dup.ok).toBe(false);
    const badWeight = parseQuickImport({ type: 'SPIN_WHEEL', rows: [{ label: 'a', weight: '2' }, { label: 'b', weight: '' }] });
    expect(badWeight.ok).toBe(false);
    const allEmpty = parseQuickImport({ type: 'SCRATCH', rows: [{ label: 'a' }, { label: 'b' }] });
    // SCRATCH allows all-empty weights (equal probability), but not mixed
    expect(allEmpty.ok).toBe(true);
    const mixed = parseQuickImport({ type: 'SCRATCH', rows: [{ label: 'a', weight: '3' }, { label: 'b' }] });
    expect(mixed.ok).toBe(false);
  });

  it('validates likert points and scale labels', () => {
    expect(parseQuickImport({ type: 'LIKERT', points: 11 }).ok).toBe(false);
    expect(parseQuickImport({ type: 'LIKERT', scaleMinLabel: '低', scaleMaxLabel: '低' }).ok).toBe(false);
    expect(parseQuickImport({ type: 'LIKERT', scaleMinLabel: '低' }).ok).toBe(false);
    const ok = parseQuickImport({ type: 'LIKERT', points: 7, scaleMinLabel: '低', scaleMaxLabel: '高' });
    expect(ok.ok).toBe(true);
  });

  it('validates multi-select limits and matching pairs', () => {
    expect(parseQuickImport({ type: 'MULTI_SELECT', rows: [{ label: 'a' }, { label: 'b' }], maxSelections: 3 }).ok).toBe(false);
    expect(parseQuickImport({ type: 'MATCHING', rows: [{ label: 'a', match: 'x' }, { label: 'b', match: 'x' }] }).ok).toBe(false);
  });

  it('ignores image fields and validates scratchCard', () => {
    const result = parseQuickImport({
      type: 'SCRATCH',
      rows: [{ label: 'a', revealImageUrl: '/img.png' }, { label: 'b' }],
      scratchCard: { revealMode: 'SHARED', showText: false, sharedRevealImageUrl: '/img.png' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.scratchCard).toMatchObject({ revealMode: 'SHARED', showText: false, sharedRevealImageUrl: null });
    }
    expect(parseQuickImport({ type: 'SCRATCH', rows: [{ label: 'a' }, { label: 'b' }], scratchCard: { revealMode: 'BAD' } }).ok).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { formatDateTime, formatTimeAgo } from './format';

describe('formatDateTime', () => {
  it('formats month/day/hour/minute', () => {
    expect(formatDateTime('2026-09-17T15:59:00+08:00')).toContain('9/17');
  });
});

describe('formatTimeAgo', () => {
  const now = new Date('2026-09-17T12:00:00+08:00').getTime();
  const iso = (ms: number) => new Date(ms).toISOString();

  it('shows 剛剛 within a minute', () => {
    expect(formatTimeAgo(iso(now - 30_000), now)).toBe('剛剛');
  });

  it('shows minutes within an hour', () => {
    expect(formatTimeAgo(iso(now - 5 * 60_000), now)).toBe('5 分鐘前');
  });

  it('shows hours within a day', () => {
    expect(formatTimeAgo(iso(now - 3 * 3_600_000), now)).toBe('3 小時前');
  });

  it('shows M/d for older dates in the same year', () => {
    expect(formatTimeAgo(iso(now - 3 * 86_400_000), now)).toBe('9/14');
  });

  it('shows Y/M/d across years', () => {
    expect(formatTimeAgo('2025-12-31T12:00:00+08:00', now)).toBe('2025/12/31');
  });
});

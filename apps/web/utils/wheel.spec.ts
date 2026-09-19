import { describe, expect, it } from 'vitest';
import { wheelSegmentRotation } from './wheel';

describe('wheelSegmentRotation', () => {
  it('returns a rotation that lands the top pointer inside the target segment', () => {
    const count = 4;
    const size = 360 / count;
    const rotation = wheelSegmentRotation(1, count, 0);
    const pointerAngle = (360 - rotation) % 360;
    expect(pointerAngle).toBeGreaterThanOrEqual(1 * size);
    expect(pointerAngle).toBeLessThan(2 * size);
  });

  it('returns 0 for the first segment without jitter', () => {
    expect(wheelSegmentRotation(0, 4, 0)).toBe(0);
  });

  it('clamps jitter to the unit interval', () => {
    expect(wheelSegmentRotation(0, 4, -1)).toBe(0);
    expect(wheelSegmentRotation(0, 4, 2)).toBe(270);
  });

  it('handles a degenerate single-segment wheel', () => {
    expect(wheelSegmentRotation(0, 1, 0)).toBe(0);
    expect(wheelSegmentRotation(0, 1, 0.5)).toBe(180);
  });

  it('is periodic so consecutive spins reach the same landed segment modulo 360', () => {
    const count = 6;
    const size = 360 / count;
    const rotation = wheelSegmentRotation(3, count, 0.25);
    const reaches = (rotation + size * 0.25) % 360;
    expect(reaches).toBeGreaterThanOrEqual(3 * size);
    expect(reaches).toBeLessThan(4 * size);
  });
});
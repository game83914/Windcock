export function wheelSegmentRotation(targetIndex: number, segmentCount: number, jitterFraction = 0.5) {
  const size = 360 / Math.max(segmentCount, 1);
  const jitter = Math.max(0, Math.min(jitterFraction, 1));
  const phi = targetIndex * size + jitter * size;
  return (360 - (phi % 360) + 360) % 360;
}
<template>
  <span v-if="pieces.length" aria-hidden="true" class="pointer-events-none absolute inset-0 z-20 overflow-hidden">
    <i v-for="(piece, index) in pieces" :key="index" class="ui-confetti-band" :style="pieceStyle(piece)" />
  </span>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ burstKey: string; count?: number }>(), { count: 14 });

const COLORS = ['#b0761f', '#c9a15e', '#3157d5', '#3f7a58', '#e0b25b', '#8f5d14'];

function seededRandom(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6d2b79f5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ConfettiPiece {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  rotate: number;
  rotateEnd: number;
  drift: number;
  delay: number;
  duration: number;
}

const pieces = computed<ConfettiPiece[]>(() => {
  const random = seededRandom(props.burstKey);
  const list: ConfettiPiece[] = [];
  for (let i = 0; i < props.count; i++) {
    list.push({
      x: 18 + random() * 64,
      y: random() * 20,
      width: 4 + random() * 4,
      height: 8 + random() * 6,
      color: COLORS[Math.floor(random() * COLORS.length)],
      rotate: random() * 360,
      rotateEnd: (random() - 0.5) * 360,
      drift: (random() - 0.5) * 40,
      delay: random() * 0.18,
      duration: 0.9 + random() * 0.6,
    });
  }
  return list;
});

function pieceStyle(piece: ConfettiPiece) {
  return {
    left: `${piece.x}%`,
    top: `${piece.y}%`,
    width: `${piece.width}px`,
    height: `${piece.height}px`,
    background: piece.color,
    transform: `rotate(${piece.rotate}deg)`,
    '--cf-drift': `${piece.drift}px`,
    '--cf-rotate-end': `${piece.rotateEnd}deg`,
    '--cf-delay': `${piece.delay}s`,
    '--cf-duration': `${piece.duration}s`,
  };
}
</script>

<style scoped>
.ui-confetti-band {
  position: absolute;
  display: block;
  border-radius: 9999px;
  opacity: 0;
  animation: ui-confetti-fall var(--cf-duration) cubic-bezier(0.25, 0.6, 0.35, 1) var(--cf-delay) forwards;
}
@keyframes ui-confetti-fall {
  0% {
    opacity: 0;
    transform: translate3d(0, 0, 0) rotate(0deg);
  }
  12% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--cf-drift), 64px, 0) rotate(var(--cf-rotate-end));
  }
}
@media (prefers-reduced-motion: reduce) {
  .ui-confetti-band {
    animation: none;
    opacity: 0;
  }
}
</style>
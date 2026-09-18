<script setup lang="ts">
/**
 * ImageOptionTile — 圖片選項投票磁磚（純展示＋事件轉發）。
 * 投票 POST/PATCH 邏輯留在調用處，本元件只 emit vote/zoom。
 */
withDefaults(defineProps<{
  src?: string;
  label: string;
  selected?: boolean;
  voting?: boolean;
  disabled?: boolean;
  progress?: number | null;
  voteActionLabel?: string;
  tileClass?: string;
  selectedClass?: string;
  unselectedClass?: string;
  badgeClass?: string;
  zoomButtonClass?: string;
  zoomIconSize?: number;
  captionClass?: string;
  spinnerClass?: string;
}>(), {
  src: '',
  selected: false,
  voting: false,
  disabled: false,
  progress: null,
  voteActionLabel: '選擇',
  tileClass: 'rounded-2xl',
  selectedClass: 'border-[#b0761f] ring-2 ring-[#b0761f]',
  unselectedClass: 'border-[#e0c9a0] hover:border-[#b0761f]',
  badgeClass: 'right-1.5 top-1.5 size-6 bg-[#b0761f] text-sm',
  zoomButtonClass: 'left-1.5 top-1.5 size-7',
  zoomIconSize: 14,
  captionClass: 'px-2 pb-2 pt-8 text-xs',
  spinnerClass: 'size-6',
});

const emit = defineEmits<{ vote: []; zoom: [] }>();
</script>

<template>
  <div
    class="focus-ring group relative aspect-square overflow-hidden border-2 bg-white transition"
    :class="[tileClass, selected ? selectedClass : unselectedClass]"
  >
    <img :src="src" :alt="label" class="absolute inset-0 h-full w-full object-cover" />
    <span class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent font-black text-white" :class="captionClass">{{ label }}</span>
    <span v-if="voting" class="pointer-events-none absolute inset-0 grid place-items-center bg-black/30"><span class="animate-spin rounded-full border-2 border-white border-t-transparent" :class="spinnerClass" aria-hidden="true" /></span>
    <span v-else-if="selected" class="pointer-events-none absolute grid place-items-center rounded-full text-white" :class="badgeClass" aria-hidden="true">✓</span>
    <span v-if="progress !== null && progress !== undefined" class="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/20"><span class="block h-full bg-[#b0761f]" :style="{ width: `${progress}%` }" /></span>
    <button type="button" class="focus-ring absolute inset-0" :disabled="disabled" :aria-label="`${voteActionLabel} ${label}`" @click.stop="emit('vote')" />
    <button type="button" class="focus-ring absolute z-10 grid place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/70" :class="zoomButtonClass" :disabled="disabled" aria-label="放大檢視圖片" @click.stop="emit('zoom')">
      <svg :width="zoomIconSize" :height="zoomIconSize" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
    </button>
  </div>
</template>

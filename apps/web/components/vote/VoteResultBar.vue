<script setup lang="ts">
/**
 * VoteResultBar — 單列投票結果展示（名稱＋百分比·票數＋進度條）。
 * 純展示元件：樣式預設沿用 QuickVotePanel 關閉態通用結果列，
 * 各調用處透過 class 相關 props 覆寫以保留原外觀（含深色版）。
 * 根節點使用 span.block，方便放進 button（如可改票的結果列）或 div。
 */
const props = withDefaults(defineProps<{
  label: string;
  percentage: number;
  count?: number | string | null;
  highlighted?: boolean;
  countSuffix?: string;
  checkSuffix?: string;
  imageSrc?: string | null;
  imageAlt?: string;
  rowClass?: string;
  labelClass?: string;
  valueClass?: string;
  highlightClass?: string;
  trackClass?: string;
  barClass?: string;
  barStyle?: string | Record<string, string>;
}>(), {
  count: null,
  highlighted: false,
  countSuffix: ' 票',
  checkSuffix: ' ',
  imageSrc: null,
  imageAlt: '',
  rowClass: 'mb-2 flex items-center justify-between gap-4 text-sm',
  labelClass: 'font-bold',
  valueClass: 'shrink-0 font-black tabular-nums',
  highlightClass: 'text-[#8f5d14]',
  trackClass: 'h-2 rounded-full bg-[#dfdad0]',
  barClass: 'h-full rounded-full bg-[#3157d5] transition-[width] duration-500',
  barStyle: undefined,
});

const hasCount = computed(() => props.count !== null && props.count !== undefined && props.count !== '');

const emit = defineEmits<{ imageZoom: [] }>();
</script>

<template>
  <span class="block w-full">
    <span :class="rowClass">
      <span :class="[labelClass, highlighted ? highlightClass : '']"><img v-if="imageSrc" :src="imageSrc" :alt="imageAlt || `放大 ${label}`" class="h-6 w-6 shrink-0 cursor-zoom-in rounded-lg border border-[#ded7cb] object-cover transition hover:opacity-80" @click.stop="emit('imageZoom')" /><span v-if="highlighted && !imageSrc" aria-hidden="true">✓{{ checkSuffix }}</span><span v-if="imageSrc" class="truncate">{{ label }}</span><template v-else>{{ label }}</template></span>
      <span :class="valueClass">{{ percentage }}%<template v-if="hasCount"> · {{ count }}{{ countSuffix }}</template></span>
    </span>
    <span :class="trackClass"><span :class="barClass" :style="[{ width: `${percentage}%` }, barStyle]" /></span>
  </span>
</template>

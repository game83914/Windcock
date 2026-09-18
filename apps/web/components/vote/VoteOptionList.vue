<script setup lang="ts">
import type { TopicOption } from '~/types/topic';

/**
 * VoteOptionList — 單選投票按鈕列（含 ○/✓ 標記）。
 * 純展示＋事件轉發，投票 POST/PATCH 邏輯留在調用處。
 */
defineProps<{
  options: TopicOption[];
  selectedId: string | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{ select: [optionId: string] }>();
</script>

<template>
  <div class="space-y-2.5">
    <button
      v-for="o in options"
      :key="o.id"
      type="button"
      class="focus-ring flex min-h-12 w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left font-bold transition"
      :class="[selectedId === o.id ? 'border-[#b0761f] bg-[#fff8ec] text-[#8f5d14]' : 'border-[#ded7cb] bg-white hover:border-[#171717]']"
      :disabled="disabled"
      @click="emit('select', o.id)"
    >
      <span class="flex items-center gap-3">
        <span>{{ o.label }}</span>
      </span>
      <span aria-hidden="true">{{ selectedId === o.id ? '✓' : '○' }}</span>
    </button>
  </div>
</template>

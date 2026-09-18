<script setup lang="ts">
import type { Topic } from '~/types/topic';
import { optionPercentage } from '~/utils/topic';

const props = withDefaults(defineProps<{ topic: Topic; changeable?: boolean }>(), { changeable: true });
const votedOptionId = computed(() => props.topic.myVote?.optionId ?? null);
</script>

<template>
  <div class="rounded-xl border border-[#e6cf9e] bg-[#fff8ec] p-4">
    <div class="space-y-2.5">
      <div v-for="o in topic.options" :key="o.id" class="block overflow-hidden rounded-lg border-2 text-left transition" :class="votedOptionId === o.id ? 'border-[#b0761f] bg-white' : 'border-transparent bg-white/70'">
        <span class="flex items-center justify-between px-3 py-2 text-sm font-bold">
          <span class="flex items-center gap-2"><span v-if="votedOptionId === o.id" class="text-[#b0761f]" aria-hidden="true">✓</span>{{ o.label }}</span>
          <span class="tabular-nums">{{ optionPercentage(o, topic) }}% · {{ o.voteCount }} 票</span>
        </span>
        <span class="block h-1 bg-[#f0e6d2]"><span class="block h-full bg-[#b0761f] transition-[width] duration-500" :style="{ width: `${optionPercentage(o, topic)}%` }" /></span>
      </div>
    </div>
  </div>
</template>
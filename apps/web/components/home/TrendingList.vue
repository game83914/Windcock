<template>
  <aside class="flex h-full flex-col border border-[#d7d1c6] bg-[#faf8f3] p-6 lg:p-7">
    <div class="mb-5 flex items-end justify-between border-b-2 border-[#171717] pb-3">
      <div>
        <h2 class="mt-1 text-xl font-black">熱門議題排行</h2>
      </div>
    </div>

    <ol class="divide-y divide-[#ded8cd]">
      <li v-for="(topic, index) in topics" :key="topic.id">
        <NuxtLink :to="`/topic/${topic.id}`" class="focus-ring group grid grid-cols-[2.4rem_1fr] gap-3 py-4">
          <span class="font-mono text-2xl font-black text-[#c5beb2] transition group-hover:text-[#d84a36]">{{ String(index + 1).padStart(2, '0') }}</span>
          <span>
            <span class="mb-1 block text-[11px] font-bold tracking-wider" :style="{ color: getCategoryMeta(topic.category).color }">{{ getCategoryMeta(topic.category).label }}</span>
            <span class="block font-bold leading-snug transition group-hover:text-[#d84a36]">{{ topic.title }}</span>
            <span class="mt-1 block text-xs text-[#77716a]">{{ formatCompactNumber(topic.totalVotes) }} 人參與</span>
          </span>
        </NuxtLink>
      </li>
    </ol>

    <p v-if="topics.length === 0" class="my-auto py-10 text-center text-sm text-[#77716a]">目前尚無熱門議題</p>
  </aside>
</template>

<script setup lang="ts">
import type { Topic } from '~/types/topic';
import { formatCompactNumber, getCategoryMeta } from '~/utils/topic';

defineProps<{ topics: Topic[] }>();
</script>

<template>
  <div>
    <div class="mb-8 flex flex-col gap-4 border-b-2 border-[#171717] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="mt-2 text-3xl font-black tracking-[-0.04em]">我的議題</h1>
      </div>
      <NuxtLink to="/topics/create" class="focus-ring bg-[#d84a36] px-5 py-3 text-center text-sm font-bold text-white">＋ 發起新議題</NuxtLink>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="item in 3" :key="item" class="h-36 animate-pulse bg-[#e5e0d6]" />
    </div>
    <p v-else-if="loadError" class="border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm">{{ loadError }}</p>
    <div v-else-if="topics.length" class="space-y-4">
      <article v-for="topic in topics" :key="topic.id" class="border border-[#d7d1c6] bg-[#faf8f3] p-5 sm:p-6">
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span class="font-bold" :style="{ color: getCategoryMeta(topic.category).color }">{{ getCategoryMeta(topic.category).label }}</span>
          <span class="px-2 py-1 font-bold" :class="moderationClass(topic.moderationStatus)">{{ moderationLabel(topic.moderationStatus) }}</span>
          <span class="text-[#8b857d]">{{ statusLabel(topic) }}</span>
        </div>
        <div class="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-xl font-black leading-snug">{{ topic.title }}</h2>
            <p class="mt-2 text-xs text-[#77716a]">{{ formatCompactNumber(topic.totalVotes) }} 人參與 · {{ topic.voteEndAt ? deadlineLabel(topic.voteEndAt) : `核准後開放 ${topic.voteDurationDays} 天` }}</p>
          </div>
          <div class="flex shrink-0 gap-4 text-sm font-bold">
            <NuxtLink v-if="topic.status === 'DRAFT' && topic.moderationStatus === 'PENDING_REVIEW'" :to="`/topics/create?edit=${topic.id}`" class="focus-ring text-[#3157d5]">編輯內容</NuxtLink>
            <NuxtLink v-if="topic.status === 'OPEN'" :to="`/topic/${topic.id}`" class="focus-ring">查看議題 &rarr;</NuxtLink>
          </div>
        </div>
        <p v-if="topic.moderationNote" class="mt-4 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-3 text-sm text-[#8f3022]">下架原因：{{ topic.moderationNote }}</p>
      </article>
    </div>
    <div v-else class="border border-[#d7d1c6] bg-[#faf8f3] px-6 py-16 text-center">
      <h2 class="text-xl font-black">你還沒有發起議題</h2>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Topic, TopicListResponse } from '~/types/topic';
import { deadlineLabel, formatCompactNumber, getCategoryMeta } from '~/utils/topic';

definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: '我的議題｜輿論測風向' });

const api = useApi();
const topics = ref<Topic[]>([]);
const loading = ref(true);
const loadError = ref('');

function moderationLabel(status: Topic['moderationStatus']) {
  return { PENDING_REVIEW: '待複核', APPROVED: '已複核', REJECTED: '已下架' }[status];
}

function moderationClass(status: Topic['moderationStatus']) {
  return {
    PENDING_REVIEW: 'bg-[#fff0d7] text-[#9a5b12]',
    APPROVED: 'bg-[#e5f1e9] text-[#3f7a58]',
    REJECTED: 'bg-[#fbe9e5] text-[#a63222]',
  }[status];
}

function statusLabel(topic: Topic) {
  if (topic.status === 'DRAFT') return '尚未開票';
  if (topic.status === 'OPEN') return '投票進行中';
  return '已停止投票';
}

onMounted(async () => {
  try {
    topics.value = (await api.get<TopicListResponse>('/me/topics', { limit: 50 })).items;
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
});
</script>

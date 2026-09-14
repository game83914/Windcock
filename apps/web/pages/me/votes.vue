<template>
  <div>
    <header class="border-b-2 border-[#171717] pb-5">
      <h2 class="mt-2 text-3xl font-black tracking-[-0.04em]">投票紀錄</h2>
    </header>

    <div class="mt-5 flex gap-2 overflow-x-auto">
      <button v-for="item in filters" :key="item.value" class="focus-ring shrink-0 border px-4 py-2 text-sm font-bold" :class="filter === item.value ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#cfc8bc] bg-[#faf8f3]'" @click="filter = item.value; page = 1; load()">{{ item.label }}</button>
    </div>

    <div v-if="loading" class="mt-5 space-y-3"><div v-for="item in 4" :key="item" class="h-28 animate-pulse bg-[#e5e0d6]" /></div>
    <p v-else-if="pageError" class="mt-5 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm">{{ pageError }}</p>
    <div v-else-if="votes.length" class="mt-5 divide-y divide-[#d7d1c6] border-y-2 border-[#171717]">
      <article v-for="vote in votes" :key="vote.id" class="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <div class="flex flex-wrap gap-2 text-[10px] font-bold"><span class="text-[#3157d5]">{{ getCategoryMeta(vote.category).label }}</span><span class="text-[#77716a]">{{ statusLabel(vote.topicStatus) }}</span></div>
          <NuxtLink :to="`/topic/${vote.topicId}`" class="focus-ring mt-2 block text-lg font-black leading-snug hover:text-[#3157d5]">{{ vote.topicTitle }}</NuxtLink>
          <p class="mt-2 text-sm text-[#6d6861]">我的選擇：<strong class="text-[#171717]">{{ vote.selection || vote.spectrumValue }}</strong><span v-if="Number(vote.rewardPoints)" class="ml-3 text-[#3f7a58]">+{{ vote.rewardPoints }} 點</span></p>
        </div>
        <div class="text-left sm:text-right"><time class="block text-xs text-[#77716a]">{{ formatTime(vote.votedAt) }}</time></div>
      </article>
    </div>
    <p v-else class="mt-5 border border-[#d7d1c6] bg-[#faf8f3] px-6 py-16 text-center text-sm text-[#77716a]">此分類目前沒有投票紀錄。</p>

    <div v-if="pages > 1" class="mt-6 flex items-center justify-center gap-4 text-sm font-bold"><button class="focus-ring disabled:opacity-30" :disabled="page <= 1" @click="page--; load()">&larr; 上一頁</button><span>{{ page }} / {{ pages }}</span><button class="focus-ring disabled:opacity-30" :disabled="page >= pages" @click="page++; load()">下一頁 &rarr;</button></div>
  </div>
</template>

<script setup lang="ts">
import type { MemberVote, MemberVotesResponse } from '~/types/member';
import { getCategoryMeta } from '~/utils/topic';

definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: '投票紀錄｜會員中心' });

const api = useApi();
const filter = ref<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
const page = ref(1);
const pages = ref(1);
const votes = ref<MemberVote[]>([]);
const loading = ref(true);
const pageError = ref('');
const filters = [{ label: '全部', value: 'ALL' as const }, { label: '投票中', value: 'OPEN' as const }, { label: '已結束', value: 'CLOSED' as const }];

async function load() {
  loading.value = true;
  pageError.value = '';
  try {
    const response = await api.get<MemberVotesResponse>('/me/votes', { status: filter.value, page: page.value, limit: 20 });
    votes.value = response.items;
    pages.value = response.pagination.pages || 1;
  } catch (error) {
    pageError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

function statusLabel(status: string) {
  return status === 'OPEN' ? '投票進行中' : status === 'LOCKED' ? '歷史版本' : '已結束';
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

onMounted(load);
</script>

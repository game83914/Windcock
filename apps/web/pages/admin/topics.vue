<template>
  <div class="mx-auto max-w-5xl pb-12">
    <AdminNav />
    <div class="mb-8 border-b-2 border-[#171717] pb-6">
      <h1 class="mt-2 text-3xl font-black tracking-[-0.04em]">議題複核台</h1>
      <p class="mt-2 text-sm text-[#6d6861]">會員議題在核准前不會公開或開放投票。請檢查題目、選項及所有補充模組。</p>
    </div>

    <div class="mb-6 flex gap-2 overflow-x-auto">
      <button v-for="filter in filters" :key="filter.value" class="focus-ring shrink-0 border px-4 py-2 text-sm font-bold" :class="activeFilter === filter.value ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#cfc8bc] bg-[#faf8f3]'" @click="activeFilter = filter.value; load()">{{ filter.label }}</button>
    </div>

    <p v-if="pageError" class="mb-5 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm">{{ pageError }}</p>
    <div v-if="loading" class="space-y-4">
      <div v-for="item in 3" :key="item" class="h-56 animate-pulse bg-[#e5e0d6]" />
    </div>
    <div v-else-if="topics.length" class="space-y-5">
      <article v-for="topic in topics" :key="topic.id" class="border border-[#d7d1c6] bg-[#faf8f3] p-5 sm:p-7">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2 text-xs">
            <span v-if="topic.kind === 'QUICK'" class="bg-[#b0761f] px-2 py-1 font-bold text-white">快問</span><span v-else class="font-bold" :style="{ color: getCategoryMeta(topic.category).color }">{{ getCategoryMeta(topic.category).label }}</span>
            <span class="bg-[#fff0d7] px-2 py-1 font-bold text-[#9a5b12]">{{ moderationLabel(topic.moderationStatus) }}</span>
          </div>
          <span class="text-xs text-[#77716a]">發起者：{{ topic.creator.nickname }}</span>
        </div>
        <h2 class="mt-4 text-xl font-black leading-snug">{{ topic.title }}</h2>
        <p class="mt-2 text-sm leading-6 text-[#6d6861]">{{ topic.description }}</p>
        <div v-if="topic.blocks.length" class="mt-4 border-l-4 border-[#3157d5] bg-[#f1f4ff] p-4">
          <p class="text-[10px] font-black uppercase tracking-[0.16em] text-[#3157d5]">補充內容 · {{ topic.blocks.length }} 個模組</p>
          <div v-for="(item, index) in topic.blocks" :key="item.id" class="mt-3 text-sm">
            <strong>{{ index + 1 }}. [{{ blockLabel(item.type) }}] {{ item.title }}</strong>
            <p v-if="item.content" class="mt-1 leading-5 text-[#6d6861]">{{ item.content }}</p>
            <a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener noreferrer" class="mt-1 inline-block text-xs font-bold text-[#3157d5]">{{ item.sourceLabel || '查看來源' }} &nearr;</a>
            <p v-else-if="item.sourceLabel" class="mt-1 text-xs text-[#77716a]">來源：{{ item.sourceLabel }}</p>
          </div>
        </div>
        <div v-if="topic.options.length" class="mt-4 flex flex-wrap gap-2">
          <span v-for="option in topic.options" :key="option.id" class="border border-[#d7d1c6] bg-white px-3 py-2 text-xs">{{ option.label }}</span>
        </div>
        <div class="mt-5 flex flex-wrap items-center gap-4 border-t border-[#ded8cd] pt-4 text-xs text-[#77716a]">
          <span>{{ formatCompactNumber(topic.totalVotes) }} 人已投票</span>
          <span>{{ topic.topicType }}</span>
          <NuxtLink v-if="topic.status === 'OPEN'" :to="`/topic/${topic.id}`" target="_blank" class="font-bold text-[#171717]">公開頁面 &nearr;</NuxtLink>
        </div>

        <div v-if="topic.moderationStatus === 'PENDING_REVIEW'" class="mt-5 grid gap-3 sm:grid-cols-[auto_1fr_auto]">
          <button class="focus-ring bg-[#3f7a58] px-5 py-3 text-sm font-bold text-white disabled:opacity-50" :disabled="workingId === topic.id" @click="approve(topic.id)">核准內容</button>
          <input v-model="rejectionNotes[topic.id]" placeholder="下架理由（至少 5 字）" class="focus-ring border border-[#bfb8ad] bg-white px-4 py-3 text-sm" />
          <button class="focus-ring border border-[#d84a36] px-5 py-3 text-sm font-bold text-[#a63222] disabled:opacity-50" :disabled="workingId === topic.id" @click="reject(topic.id)">下架議題</button>
        </div>
        <p v-else-if="topic.moderationNote" class="mt-4 bg-[#fbe9e5] p-3 text-sm text-[#8f3022]">{{ topic.moderationNote }}</p>
      </article>
    </div>
    <p v-else class="border border-[#d7d1c6] bg-[#faf8f3] px-6 py-16 text-center text-sm text-[#77716a]">此狀態目前沒有議題。</p>
  </div>
</template>

<script setup lang="ts">
import type { Topic, TopicListResponse } from '~/types/topic';
import { formatCompactNumber, getCategoryMeta } from '~/utils/topic';

definePageMeta({ middleware: ['auth', 'admin'] });
useSeoMeta({ title: '議題複核台｜輿論測風向' });

const api = useApi();
const topics = ref<Topic[]>([]);
const loading = ref(true);
const pageError = ref('');
const activeFilter = ref('PENDING_REVIEW');
const workingId = ref<string | null>(null);
const rejectionNotes = reactive<Record<string, string>>({});
const filters = [
  { label: '待複核', value: 'PENDING_REVIEW' },
  { label: '已核准', value: 'APPROVED' },
  { label: '已下架', value: 'REJECTED' },
];

function moderationLabel(status: Topic['moderationStatus']) {
  return { PENDING_REVIEW: '待複核', APPROVED: '已核准', REJECTED: '已下架' }[status];
}

function blockLabel(type: Topic['blocks'][number]['type']) {
  return { BACKGROUND: '背景', CASE: '案例', DATA: '數據', SOURCE: '來源', PERSPECTIVES: '多方觀點' }[type];
}

async function load() {
  loading.value = true;
  pageError.value = '';
  try {
    topics.value = (await api.get<TopicListResponse>('/admin/topics', {
      moderationStatus: activeFilter.value,
      limit: 50,
    })).items;
  } catch (error) {
    pageError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

async function approve(id: string) {
  workingId.value = id;
  pageError.value = '';
  try {
    await api.post(`/admin/topics/${id}/approve`);
    await load();
  } catch (error) {
    pageError.value = errorMessage(error);
  } finally {
    workingId.value = null;
  }
}

async function reject(id: string) {
  const note = rejectionNotes[id]?.trim();
  if (!note || note.length < 5) {
    pageError.value = '請填寫至少 5 個字的下架理由';
    return;
  }
  workingId.value = id;
  pageError.value = '';
  try {
    await api.post(`/admin/topics/${id}/reject`, { note });
    await load();
  } catch (error) {
    pageError.value = errorMessage(error);
  } finally {
    workingId.value = null;
  }
}

onMounted(load);
</script>

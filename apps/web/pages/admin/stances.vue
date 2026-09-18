<template>
  <div class="mx-auto max-w-4xl pb-12">
    <AdminNav />
    <header class="border-b-2 border-[#171717] pb-6"><h1 class="text-3xl font-black tracking-[-0.04em]">立場檢舉管理台</h1></header>

    <p v-if="notice" class="mt-5 border-l-4 border-[#3f7a58] bg-[#e5f1e9] p-4 text-sm font-bold text-[#2f6547]">
      {{ notice }}
      <button v-if="lastTakedownId" type="button" class="focus-ring ml-3 underline" :disabled="working" @click="restore(lastTakedownId)">復原此立場</button>
    </p>
    <p v-if="pageError" class="mt-5 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm font-bold text-[#a63222]">{{ pageError }}</p>

    <div v-if="loading" class="mt-6 h-40 animate-pulse bg-[#e5e0d6]" />
    <div v-else-if="items.length" class="mt-6 space-y-4">
      <article v-for="item in items" :key="item.id" class="border-2 border-[#171717] bg-[#faf8f3] p-5">
        <div class="flex flex-wrap items-center gap-2">
          <NuxtLink :to="`/topic/${item.topicId}`" class="focus-ring font-black underline-offset-2 hover:underline">{{ item.stanceTitle }}</NuxtLink>
          <span class="text-xs text-[#77716a]">議題 #{{ item.topicId }}</span>
          <span class="bg-[#fbe9e5] px-2 py-0.5 text-[11px] font-black text-[#a63222]">{{ reasonLabel(item.reason) }}</span>
        </div>
        <p class="mt-2 text-sm text-[#5f5a53]">{{ item.reporter }} 檢舉 · {{ formatDateTime(item.createdAt) }}<span v-if="item.detail">：{{ item.detail }}</span></p>
        <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input v-model.trim="reason" class="focus-ring min-w-0 flex-1 border border-[#bfb8ad] bg-white px-4 py-2 text-sm" placeholder="下架原因（5 字以上）" />
          <button class="focus-ring shrink-0 bg-[#d84a36] px-5 py-2 text-sm font-black text-white disabled:opacity-50" :disabled="working || reason.length < 5 || item.stanceId === lastTakedownId" @click="takedown(item.stanceId)">下架此立場</button>
        </div>
      </article>
    </div>
    <p v-else class="mt-6 border border-[#d7d1c6] bg-[#faf8f3] py-16 text-center text-sm text-[#77716a]">目前沒有待處理的立場檢舉。</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'] });
useSeoMeta({ title: '立場檢舉管理｜輿論測風向' });
import { formatDateTime } from '~/utils/format';

interface StanceReport {
  id: string;
  stanceId: string;
  stanceTitle: string;
  topicId: string;
  reporter: string;
  reason: string;
  detail?: string | null;
  createdAt: string;
}

const api = useApi();
const items = ref<StanceReport[]>([]);
const loading = ref(true);
const working = ref(false);
const pageError = ref('');
const notice = ref('');
const reason = ref('');
const lastTakedownId = ref<string | null>(null);

function reasonLabel(reason: string) {
  return {
    HARASSMENT: '騷擾或不當言論',
    INAPPROPRIATE: '內容不適當',
    FALSE_INFO: '不實資訊',
    OTHER: '其他',
  }[reason] ?? reason;
}

async function load() {
  loading.value = true;
  pageError.value = '';
  try {
    items.value = (await api.get<{ items: StanceReport[] }>('/admin/stances/reports', { limit: 50 })).items;
  } catch (cause) {
    pageError.value = errorMessage(cause);
  } finally {
    loading.value = false;
  }
}

async function takedown(stanceId: string) {
  working.value = true;
  pageError.value = '';
  notice.value = '';
  try {
    await api.post<{ takenDown: boolean }>(`/admin/stances/${stanceId}/takedown`, { reason: reason.value });
    reason.value = '';
    lastTakedownId.value = stanceId;
    notice.value = '立場已下架，檢舉已結案。';
    await load();
  } catch (cause) {
    pageError.value = errorMessage(cause);
  } finally {
    working.value = false;
  }
}

async function restore(stanceId: string) {
  working.value = true;
  pageError.value = '';
  try {
    await api.post<{ restored: boolean }>(`/admin/stances/${stanceId}/restore`, {});
    lastTakedownId.value = null;
    notice.value = '立場已復原。';
    await load();
  } catch (cause) {
    pageError.value = errorMessage(cause);
  } finally {
    working.value = false;
  }
}

onMounted(load);
</script>
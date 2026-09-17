<template>
  <div>
    <div class="mb-8 border-b-2 border-[#171717] pb-6">
      <h1 class="mt-2 text-3xl font-black tracking-[-0.04em]">我的快問</h1>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="item in 3" :key="item" class="h-36 animate-pulse bg-[#e5e0d6]" />
    </div>
    <p v-else-if="loadError" class="border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm">{{ loadError }}</p>
    <div v-else-if="topics.length" class="space-y-4">
      <article v-for="topic in topics" :key="topic.id" class="border border-[#d7d1c6] bg-[#faf8f3] p-5 sm:p-6">
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span class="bg-[#b0761f] px-2 py-1 font-bold text-white">快問</span>
          <span
            class="px-2 py-1 font-bold"
            :class="isActive(topic) ? 'bg-[#e5f1e9] text-[#3f7a58]' : 'bg-[#ebe6dc] text-[#6d6861]'"
          >{{ isActive(topic) ? '進行中' : '已結束' }}</span>
          <span class="bg-[#eef1fb] px-2 py-1 font-bold text-[#3157d5]">{{ topic.audience === 'FOLLOWERS_ONLY' ? '追蹤者限定' : '會員參與' }}</span>
          <span v-if="topic.visibility === 'PRIVATE_LINK'" class="bg-[#fbe9e5] px-2 py-1 font-bold text-[#a63222]">私密連結</span>
        </div>
        <div class="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-xl font-black leading-snug">{{ topic.title }}</h2>
            <p class="mt-2 text-xs text-[#77716a]">{{ formatCompactNumber(topic.totalVotes) }} 票 · {{ topic.voteEndAt ? deadlineLabel(topic.voteEndAt) : '尚未開票' }}</p>
            <ul v-if="topic.options.length" class="mt-2 flex flex-wrap gap-3 text-xs text-[#8b857d]">
              <li v-for="opt in leadingOptions(topic, 2)" :key="opt.id"><span class="font-medium">{{ opt.label }}</span> {{ opt.voteCount }} 票</li>
            </ul>
          </div>
          <div class="flex shrink-0 flex-wrap gap-3 text-sm font-bold">
            <button v-if="topic.visibility === 'PRIVATE_LINK'" type="button" class="focus-ring text-[#3157d5]" :disabled="busyId === topic.id" @click="rotateAndCopy(topic)">產生新連結</button>
            <button v-if="topic.visibility === 'PRIVATE_LINK'" type="button" class="focus-ring text-[#a63222]" :disabled="busyId === topic.id" @click="disableLink(topic)">停用連結</button>
            <NuxtLink :to="`/topic/${topic.id}`" class="focus-ring text-[#b0761f]">查看詳情 &rarr;</NuxtLink>
          </div>
        </div>
        <p v-if="topic.moderationNote" class="mt-4 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-3 text-sm text-[#8f3022]">下架原因：{{ topic.moderationNote }}</p>
      </article>
    </div>
    <div v-else class="border border-[#d7d1c6] bg-[#faf8f3] px-6 py-16 text-center">
      <h2 class="text-xl font-black">你還沒有發起快問</h2>
    </div>
    <p v-if="actionMessage" class="mt-4 border-l-4 border-[#3157d5] bg-[#eef1fb] p-3 text-sm text-[#233f9e]">{{ actionMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import type { Topic } from '~/types/topic';
import { deadlineLabel, formatCompactNumber, leadingOptions } from '~/utils/topic';

definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: '我的快問｜輿論測風向' });

const api = useApi();
const topics = ref<Topic[]>([]);
const loading = ref(true);
const loadError = ref('');
const busyId = ref('');
const actionMessage = ref('');

function isActive(topic: Topic) {
  return topic.status === 'OPEN' && topic.voteEndAt && new Date(topic.voteEndAt).getTime() > Date.now();
}

async function rotateAndCopy(topic: Topic) {
  busyId.value = topic.id;
  actionMessage.value = '';
  try {
    const result = await api.post<{ sharePath: string }>(`/topics/${topic.id}/share-link`);
    await navigator.clipboard.writeText(new URL(result.sharePath, window.location.origin).toString());
    actionMessage.value = '新的私密連結已複製，舊連結已失效。';
  } catch (error) {
    actionMessage.value = errorMessage(error);
  } finally {
    busyId.value = '';
  }
}

async function disableLink(topic: Topic) {
  busyId.value = topic.id;
  actionMessage.value = '';
  try {
    await api.delete(`/topics/${topic.id}/share-link`);
    actionMessage.value = '私密連結已停用。';
  } catch (error) {
    actionMessage.value = errorMessage(error);
  } finally {
    busyId.value = '';
  }
}

onMounted(async () => {
  try {
    const res = await api.get<{ items: Topic[] }>('/topics/me/quick', { limit: 50 });
    topics.value = res.items ?? [];
  } catch (error) {
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
});
</script>

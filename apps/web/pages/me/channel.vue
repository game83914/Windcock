<template>
  <div>
    <header class="flex flex-col gap-4 border-b-2 border-[#171717] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div><p class="eyebrow-modern text-[#d84a36]">My Channel</p><h2 class="mt-1 text-3xl font-black tracking-[-0.04em]">我的追蹤</h2></div>
      <NuxtLink v-if="channel" :to="`/members/${channel.id}`" class="focus-ring text-sm font-black text-[#3157d5] hover:underline">查看公開頁面 →</NuxtLink>
    </header>

    <div v-if="loading" class="mt-6 h-72 animate-pulse bg-[#e5e0d6]" />
    <p v-else-if="pageError" class="mt-6 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-5 text-sm text-[#8f3022]">{{ pageError }}</p>
    <template v-else-if="channel">
      <section class="mt-6 border border-[#d7d1c6] bg-[#faf8f3] p-5 sm:p-7">
        <div class="flex items-center gap-4"><UserAvatar :nickname="channel.nickname" :avatar-url="channel.avatarUrl" size="lg" /><div><h3 class="text-xl font-black">{{ channel.nickname }}</h3><p class="mt-1 text-xs text-[#77716a]">所有會員都有自己的公開頻道。</p></div></div>
        <label class="mt-6 block"><span class="mb-2 flex justify-between text-sm font-bold"><span>簡介</span><span class="text-xs text-[#77716a]">{{ bio.length }} / 100</span></span><textarea v-model="bio" maxlength="100" rows="4" class="focus-ring w-full resize-y border border-[#bfb8ad] bg-white px-4 py-3 text-sm leading-6" placeholder="簡短介紹你關注的議題與觀點。" /></label>
        <div class="mt-4 flex justify-end"><button type="button" class="focus-ring bg-[#171717] px-5 py-3 text-sm font-black text-white disabled:opacity-50" :disabled="saving" @click="saveBio">{{ saving ? '儲存中…' : '儲存簡介' }}</button></div>
      </section>

      <section class="mt-6 grid gap-4 sm:grid-cols-2">
        <button type="button" class="focus-ring border-l-4 p-5 text-left" :class="activeList === 'followers' ? 'border-[#d84a36] bg-[#fbe9e5]' : 'border-[#d7d1c6] bg-[#faf8f3]'" @click="activeList = 'followers'"><strong class="block text-3xl font-black tabular-nums">{{ channel.followerCount }}</strong><span class="text-sm text-[#6d6861]">追蹤者</span></button>
        <button type="button" class="focus-ring border-l-4 p-5 text-left" :class="activeList === 'following' ? 'border-[#3157d5] bg-[#eef1fb]' : 'border-[#d7d1c6] bg-[#faf8f3]'" @click="activeList = 'following'"><strong class="block text-3xl font-black tabular-nums">{{ channel.followingCount }}</strong><span class="text-sm text-[#6d6861]">追蹤中</span></button>
      </section>

      <section class="mt-6">
        <h3 class="text-xl font-black">{{ activeList === 'followers' ? '追蹤者' : '追蹤中的頻道' }}</h3>
        <div v-if="listLoading" class="mt-4 space-y-3"><div v-for="item in 3" :key="item" class="h-16 animate-pulse rounded-xl bg-[#e5e0d6]" /></div>
        <div v-else-if="connections.length" class="mt-4 grid gap-3 sm:grid-cols-2">
          <NuxtLink v-for="item in connections" :key="item.user.id" :to="`/members/${item.user.id}`" class="focus-ring flex items-center gap-3 rounded-2xl border border-[#d7d1c6] bg-[#faf8f3] p-4 hover:border-[#171717]"><UserAvatar :nickname="item.user.nickname" :avatar-url="item.user.avatarUrl" /><strong class="min-w-0 truncate">{{ item.user.nickname }}</strong></NuxtLink>
        </div>
        <p v-else class="mt-4 border border-[#d7d1c6] bg-[#faf8f3] py-12 text-center text-sm text-[#77716a]">目前沒有{{ activeList === 'followers' ? '追蹤者' : '追蹤中的頻道' }}。</p>
        <div v-if="listPages > 1" class="mt-6 flex items-center justify-center gap-4 text-sm font-bold"><button type="button" class="focus-ring disabled:opacity-30" :disabled="listPage <= 1" @click="changeListPage(-1)">&larr; 上一頁</button><span>{{ listPage }} / {{ listPages }}</span><button type="button" class="focus-ring disabled:opacity-30" :disabled="listPage >= listPages" @click="changeListPage(1)">下一頁 &rarr;</button></div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ChannelConnection, ChannelConnectionsResponse, ChannelProfile } from '~/types/member';

definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: '我的追蹤｜會員中心' });

const api = useApi();
const channel = ref<ChannelProfile | null>(null);
const bio = ref('');
const connections = ref<ChannelConnection[]>([]);
const activeList = ref<'followers' | 'following'>('followers');
const loading = ref(true);
const listLoading = ref(false);
const saving = ref(false);
const pageError = ref('');
const listPage = ref(1);
const listPages = ref(1);
let listRequestId = 0;

async function loadChannel() {
  loading.value = true;
  pageError.value = '';
  try {
    channel.value = await api.get<ChannelProfile>('/me/channel');
    bio.value = channel.value.channelBio || '';
  } catch (error) {
    pageError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

async function loadConnections() {
  if (!channel.value) return;
  const requestId = ++listRequestId;
  const requestedList = activeList.value;
  listLoading.value = true;
  try {
    const response = await api.get<ChannelConnectionsResponse>(`/users/${channel.value.id}/${requestedList}`, { page: listPage.value, limit: 20 });
    if (requestId !== listRequestId) return;
    connections.value = response.items;
    listPages.value = response.pagination.pages || 1;
  } catch (error) {
    if (requestId === listRequestId) pageError.value = errorMessage(error);
  } finally {
    if (requestId === listRequestId) listLoading.value = false;
  }
}

async function saveBio() {
  if (saving.value) return;
  saving.value = true;
  try {
    channel.value = await api.patch<ChannelProfile>('/me/channel/bio', { bio: bio.value });
    bio.value = channel.value.channelBio || '';
  } catch (error) {
    pageError.value = errorMessage(error);
  } finally {
    saving.value = false;
  }
}

function changeListPage(delta: number) {
  listPage.value += delta;
  loadConnections();
}

watch(activeList, () => { listPage.value = 1; listPages.value = 1; loadConnections(); });
onMounted(async () => { await loadChannel(); await loadConnections(); });
</script>

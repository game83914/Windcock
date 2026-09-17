<template>
  <div class="pb-12">
    <div v-if="loadingProfile" class="h-64 animate-pulse rounded-3xl bg-[#e5e0d6]" />
    <div v-else-if="pageError" class="border-l-4 border-[#d84a36] bg-[#fbe9e5] p-5 text-sm text-[#8f3022]">
      <p class="font-black">無法載入這個頻道</p>
      <p class="mt-2">{{ pageError }}</p>
    </div>
    <template v-else-if="channel">
      <header class="relative overflow-hidden rounded-3xl border border-[#d7d1c6] bg-[#faf8f3] p-6 sm:p-9">
        <div class="absolute inset-x-0 top-0 h-2 bg-[#d84a36]" />
        <div class="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 items-center gap-5">
            <UserAvatar :nickname="channel.nickname" :avatar-url="channel.avatarUrl" size="lg" />
            <div class="min-w-0">
              <p class="eyebrow-modern text-[#d84a36]">Member Channel</p>
              <h1 class="mt-1 truncate text-3xl font-black tracking-[-0.04em] sm:text-4xl">{{ channel.nickname }}</h1>
              <p class="mt-2 max-w-2xl whitespace-pre-line text-sm leading-6 text-[#6d6861]">{{ channel.channelBio || '這位會員還沒有填寫簡介。' }}</p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-3">
            <NuxtLink v-if="channel.isSelf" to="/me/channel" class="focus-ring border border-[#171717] px-5 py-3 text-sm font-black hover:bg-[#171717] hover:text-white">管理我的追蹤</NuxtLink>
            <button v-else type="button" class="focus-ring min-w-28 px-5 py-3 text-sm font-black text-white disabled:opacity-50" :class="channel.isFollowing ? 'bg-[#6d6861]' : 'bg-[#d84a36]'" :disabled="following" @click="toggleFollow">
              {{ following ? '處理中…' : channel.isFollowing ? '取消追蹤' : '追蹤頻道' }}
            </button>
          </div>
        </div>
        <div class="mt-7 flex gap-8 border-t border-[#ded7cb] pt-5 text-sm">
          <button type="button" class="focus-ring text-left" @click="activeTab = 'followers'"><strong class="block text-2xl font-black tabular-nums">{{ channel.followerCount }}</strong><span class="text-[#6d6861]">追蹤者</span></button>
          <button type="button" class="focus-ring text-left" @click="activeTab = 'following'"><strong class="block text-2xl font-black tabular-nums">{{ channel.followingCount }}</strong><span class="text-[#6d6861]">追蹤中</span></button>
        </div>
      </header>

      <nav class="mt-8 flex gap-2 overflow-x-auto border-b border-[#d7d1c6] pb-3" aria-label="頻道內容">
        <button v-for="tab in tabs" :key="tab.value" type="button" class="focus-ring shrink-0 px-4 py-2 text-sm font-black" :class="activeTab === tab.value ? 'bg-[#171717] text-white' : 'bg-[#ebe6dc] text-[#5f5a53] hover:bg-[#d7d1c6]'" @click="activeTab = tab.value">{{ tab.label }}</button>
      </nav>

      <section class="mt-6">
        <div v-if="loadingContent" class="grid gap-5 md:grid-cols-2 lg:grid-cols-3"><div v-for="item in 3" :key="item" class="h-72 animate-pulse bg-[#e5e0d6]" /></div>
        <p v-else-if="contentError" class="border border-[#d84a36] bg-[#fbe9e5] p-5 text-sm text-[#8f3022]">{{ contentError }}</p>
        <div v-else-if="activeTab === 'formal' || activeTab === 'quick'">
          <div v-if="topics.length" class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <component :is="topic.kind === 'QUICK' ? QuickPollCard : HomeTopicCard" v-for="topic in topics" :key="topic.id" :topic="topic" />
          </div>
          <p v-else class="border border-[#d7d1c6] bg-[#faf8f3] py-16 text-center text-sm text-[#77716a]">這個頻道目前沒有{{ activeTab === 'quick' ? '快問' : '公開議題' }}。</p>
        </div>
        <div v-else-if="connections.length" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NuxtLink v-for="item in connections" :key="item.user.id" :to="`/members/${item.user.id}`" class="focus-ring flex items-center gap-3 rounded-2xl border border-[#d7d1c6] bg-[#faf8f3] p-4 transition hover:border-[#171717]">
            <UserAvatar :nickname="item.user.nickname" :avatar-url="item.user.avatarUrl" />
            <div class="min-w-0"><strong class="block truncate">{{ item.user.nickname }}</strong><span class="text-xs text-[#77716a]">{{ activeTab === 'followers' ? '追蹤此頻道' : '前往頻道' }}</span></div>
          </NuxtLink>
        </div>
        <p v-else class="border border-[#d7d1c6] bg-[#faf8f3] py-16 text-center text-sm text-[#77716a]">目前沒有{{ activeTab === 'followers' ? '追蹤者' : '追蹤中的頻道' }}。</p>
        <div v-if="contentPages > 1" class="mt-6 flex items-center justify-center gap-4 text-sm font-bold"><button type="button" class="focus-ring disabled:opacity-30" :disabled="contentPage <= 1" @click="changeContentPage(-1)">&larr; 上一頁</button><span>{{ contentPage }} / {{ contentPages }}</span><button type="button" class="focus-ring disabled:opacity-30" :disabled="contentPage >= contentPages" @click="changeContentPage(1)">下一頁 &rarr;</button></div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import HomeTopicCard from '~/components/home/TopicCard.vue';
import QuickPollCard from '~/components/home/QuickPollCard.vue';
import type { ChannelConnection, ChannelConnectionsResponse, ChannelProfile } from '~/types/member';
import type { Topic, TopicListResponse } from '~/types/topic';

type ChannelTab = 'formal' | 'quick' | 'followers' | 'following';

const route = useRoute();
const api = useApi();
const auth = useAuthStore();
const channelId = computed(() => String(route.params.id));
const channel = ref<ChannelProfile | null>(null);
const topics = ref<Topic[]>([]);
const connections = ref<ChannelConnection[]>([]);
const activeTab = ref<ChannelTab>('formal');
const loadingProfile = ref(true);
const loadingContent = ref(false);
const following = ref(false);
const pageError = ref('');
const contentError = ref('');
const contentPage = ref(1);
const contentPages = ref(1);
let contentRequestId = 0;
let profileRequestId = 0;
const tabs = [
  { label: '正式議題', value: 'formal' as const },
  { label: '快問', value: 'quick' as const },
  { label: '追蹤者', value: 'followers' as const },
  { label: '追蹤中', value: 'following' as const },
];

useSeoMeta({ title: computed(() => channel.value ? `${channel.value.nickname}的頻道｜輿論測風向` : '會員頻道｜輿論測風向') });

async function loadProfile() {
  const requestId = ++profileRequestId;
  const requestedChannelId = channelId.value;
  loadingProfile.value = true;
  pageError.value = '';
  try {
    const response = await api.get<ChannelProfile>(`/users/${requestedChannelId}/channel`);
    if (requestId !== profileRequestId) return;
    channel.value = response;
  } catch (error) {
    if (requestId === profileRequestId) pageError.value = errorMessage(error);
  } finally {
    if (requestId === profileRequestId) loadingProfile.value = false;
  }
}

async function loadContent() {
  const requestId = ++contentRequestId;
  const requestedTab = activeTab.value;
  const requestedChannelId = channelId.value;
  loadingContent.value = true;
  contentError.value = '';
  topics.value = [];
  connections.value = [];
  try {
    if (requestedTab === 'formal' || requestedTab === 'quick') {
      const response = await api.get<TopicListResponse>('/topics', { creatorId: requestedChannelId, kind: requestedTab === 'quick' ? 'QUICK' : 'FORMAL', sort: 'NEWEST', page: contentPage.value, limit: 20 });
      if (requestId !== contentRequestId) return;
      topics.value = response.items;
      contentPages.value = response.pagination.pages || 1;
    } else {
      const response = await api.get<ChannelConnectionsResponse>(`/users/${requestedChannelId}/${requestedTab}`, { page: contentPage.value, limit: 20 });
      if (requestId !== contentRequestId) return;
      connections.value = response.items;
      contentPages.value = response.pagination.pages || 1;
    }
  } catch (error) {
    if (requestId === contentRequestId) contentError.value = errorMessage(error);
  } finally {
    if (requestId === contentRequestId) loadingContent.value = false;
  }
}

async function toggleFollow() {
  if (!auth.isAuthed) {
    await navigateTo(`/login?redirect=${encodeURIComponent(route.fullPath)}`);
    return;
  }
  if (!channel.value || following.value) return;
  following.value = true;
  try {
    channel.value = channel.value.isFollowing
      ? await api.delete<ChannelProfile>(`/users/${channelId.value}/follow`)
      : await api.post<ChannelProfile>(`/users/${channelId.value}/follow`);
  } catch (error) {
    contentError.value = errorMessage(error);
  } finally {
    following.value = false;
  }
}

function changeContentPage(delta: number) {
  contentPage.value += delta;
  loadContent();
}

watch(activeTab, () => { contentPage.value = 1; contentPages.value = 1; loadContent(); });
watch(channelId, async () => { activeTab.value = 'formal'; contentPage.value = 1; await loadProfile(); await loadContent(); });
onMounted(async () => { await loadProfile(); await loadContent(); });
</script>

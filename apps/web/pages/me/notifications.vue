<template>
  <div>
    <header class="flex flex-col gap-4 border-b border-[#ded7cb] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div><p class="eyebrow-modern text-[#d84a36]">Notifications</p><h2 class="mt-1 text-3xl font-black tracking-[-0.04em]">通知中心</h2></div>
      <UiButton v-if="unreadCount" variant="outline" size="sm" @click="readAll">全部標為已讀</UiButton>
    </header>

    <div class="mt-5 flex gap-2">
      <button v-for="item in filters" :key="item.value" type="button" class="focus-ring rounded-full border px-4 py-2 text-sm font-bold transition" :class="filter === item.value ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#cfc8bc] bg-[#faf8f3] hover:border-[#171717]'" @click="filter = item.value; page = 1; load()">{{ item.label }}</button>
    </div>

    <div v-if="loading" class="mt-5 space-y-3"><div v-for="item in 3" :key="item" class="h-28 animate-pulse rounded-2xl bg-[#e5e0d6]" /></div>
    <p v-else-if="pageError" class="rounded-2xl border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm">{{ pageError }}</p>
    <div v-else-if="notifications.length" class="mt-5 space-y-3">
      <NuxtLink v-for="item in notifications" :key="item.id" :to="item.topicId ? `/topic/${item.topicId}` : '/me'" class="focus-ring block rounded-2xl border px-5 py-4 transition" :class="item.readAt ? 'border-[#ded7cb] bg-[#faf8f3]' : 'border-[#b7c6ee] bg-[#eef1fb]'" @click="markRead(item)">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><span v-if="!item.readAt" class="size-2 shrink-0 rounded-full bg-[#d84a36]" /><span v-if="item.type === 'CHANNEL_NEW_TOPIC'" class="rounded-full bg-[#fff0d7] px-2 py-0.5 text-[10px] font-black text-[#8f5d14]">頻道更新</span><h3 class="font-black">{{ item.title }}</h3></div><p class="mt-2 text-sm leading-6 text-[#6d6861]">{{ item.message }}</p></div>
          <time class="shrink-0 text-xs text-[#8b857d]">{{ formatTime(item.createdAt) }}</time>
        </div>
      </NuxtLink>
    </div>
    <p v-else class="surface-card mt-5 px-6 py-16 text-center text-sm text-[#77716a]">{{ filter === 'true' ? '目前沒有未讀通知。' : '目前沒有通知。' }}</p>

    <div v-if="pages > 1" class="mt-6 flex items-center justify-center gap-4 text-sm font-bold"><button type="button" class="focus-ring rounded-full disabled:opacity-30" :disabled="page <= 1" @click="page--; load()">&larr; 上一頁</button><span>{{ page }} / {{ pages }}</span><button type="button" class="focus-ring rounded-full disabled:opacity-30" :disabled="page >= pages" @click="page++; load()">下一頁 &rarr;</button></div>
  </div>
</template>

<script setup lang="ts">
import type { UserNotification } from '~/types/topic';
import type { MemberDashboard } from '~/types/member';

definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: '通知中心｜會員中心' });

const api = useApi();
const dashboard = useState<MemberDashboard | null>('member-dashboard', () => null);
const notifications = ref<UserNotification[]>([]);
const unreadCount = ref(0);
const filter = ref<'all' | 'true'>('all');
const page = ref(1);
const pages = ref(1);
const loading = ref(true);
const pageError = ref('');
const filters = [{ label: '全部', value: 'all' as const }, { label: '未讀', value: 'true' as const }];

async function load() {
  loading.value = true;
  pageError.value = '';
  try {
    const response = await api.get<{ items: UserNotification[]; unreadCount: number; pagination: { pages: number } }>('/notifications', { page: page.value, limit: 20, unread: filter.value === 'true' ? 'true' : undefined });
    notifications.value = response.items;
    unreadCount.value = response.unreadCount;
    pages.value = response.pagination.pages || 1;
  } catch (error) {
    pageError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

async function markRead(item: UserNotification) {
  if (item.readAt) return;
  item.readAt = new Date().toISOString();
  unreadCount.value = Math.max(0, unreadCount.value - 1);
  syncUnread();
  await api.post(`/notifications/${item.id}/read`);
}

async function readAll() {
  await api.post('/notifications/read-all');
  notifications.value.forEach((item) => { item.readAt ||= new Date().toISOString(); });
  unreadCount.value = 0;
  syncUnread();
  if (filter.value === 'true') await load();
}

function syncUnread() {
  if (dashboard.value) dashboard.value.counts.unreadNotifications = unreadCount.value;
  window.dispatchEvent(new CustomEvent('notifications-read', { detail: unreadCount.value }));
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

onMounted(load);
</script>

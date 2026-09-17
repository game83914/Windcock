<template>
  <div>
    <div class="flex flex-col gap-4 border-b border-[#ded7cb] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="eyebrow-modern text-[#d84a36]">Member Center</p>
        <h2 class="mt-1 text-3xl font-black tracking-[-0.04em]">{{ dashboard ? `${dashboard.member.nickname}，你好` : '會員總覽' }}</h2>
      </div>
    </div>

    <div v-if="!dashboard" class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div v-for="item in 5" :key="item" class="h-24 animate-pulse rounded-2xl bg-[#e5e0d6]" />
    </div>
    <template v-else>
      <section class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <NuxtLink v-for="stat in stats" :key="stat.label" :to="stat.to" class="surface-card focus-ring p-4 sm:p-5">
          <strong class="block text-2xl font-black tabular-nums sm:text-3xl" :class="{ 'text-[#3f7a58]': stat.label === '可用點數', 'text-[#d84a36]': stat.label === '未讀通知' }">{{ stat.value }}</strong>
          <span class="mt-1 block text-xs text-[#6d6861]">{{ stat.label }}</span>
        </NuxtLink>
      </section>

      <section v-if="attentionItems.length" class="surface-quick mt-6 p-5">
        <p class="eyebrow-modern text-[#9a5b12]">需要處理</p>
        <NuxtLink v-for="item in attentionItems" :key="item.label" :to="item.to" class="focus-ring mt-2 flex items-center justify-between rounded-xl border border-[#f0e6d2] bg-white/70 px-4 py-3 text-sm font-bold transition hover:border-[#b0761f]"><span>{{ item.label }}</span><span aria-hidden="true">→</span></NuxtLink>
      </section>

      <div class="mt-8 grid gap-5 xl:grid-cols-2">
        <section class="surface-card p-5 sm:p-6">
          <div class="flex items-end justify-between border-b border-[#f0e6d2] pb-3"><h3 class="text-xl font-black">最近參與</h3><NuxtLink to="/me/votes" class="focus-ring text-xs font-bold text-[#3157d5] hover:underline">全部紀錄 →</NuxtLink></div>
          <div v-if="dashboard.recentVotes.length" class="divide-y divide-[#f0e6d2]">
            <article v-for="vote in dashboard.recentVotes" :key="vote.id" class="py-4">
              <div class="flex items-start justify-between gap-4"><NuxtLink :to="`/topic/${vote.topicId}`" class="focus-ring rounded-lg font-black leading-snug hover:text-[#3157d5]">{{ vote.topicTitle }}</NuxtLink><time class="shrink-0 text-[10px] text-[#8b857d]">{{ formatDate(vote.votedAt) }}</time></div>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#6d6861]"><span class="rounded-full bg-[#e7eff6] px-2 py-1 font-bold text-[#37639c]">我的選擇：{{ vote.selection }}</span></div>
            </article>
          </div>
          <p v-else class="py-10 text-center text-sm text-[#77716a]">還沒有投票紀錄。</p>
        </section>

        <section class="surface-card p-5 sm:p-6">
          <div class="border-b border-[#f0e6d2] pb-3"><h3 class="text-xl font-black">議題動態</h3></div>
          <div v-if="dashboard.recentTopics.length" class="divide-y divide-[#f0e6d2]">
            <NuxtLink v-for="topic in dashboard.recentTopics" :key="topic.id" to="/me/topics" class="focus-ring block rounded-lg py-4"><strong class="block text-sm leading-snug">{{ topic.title }}</strong><span v-if="topic.moderationStatus === 'PENDING_REVIEW'" class="mt-1 inline-block rounded-full bg-[#fff0d7] px-2 py-0.5 text-xs font-bold text-[#9a5b12]">{{ topicStatus(topic) }}</span><span v-else class="mt-1 block text-xs text-[#77716a]">{{ topicStatus(topic) }}</span></NuxtLink>
          </div>
          <p v-else class="py-10 text-center text-sm text-[#77716a]">還沒有發起議題。</p>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { MemberDashboard } from '~/types/member';
import type { ChannelProfile } from '~/types/member';

definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: '會員中心｜輿論測風向' });

const dashboard = useState<MemberDashboard | null>('member-dashboard', () => null);
const api = useApi();
const channel = ref<ChannelProfile | null>(null);
const stats = computed(() => dashboard.value ? [
  { label: '可用點數', value: dashboard.value.member.points, to: '/me/points' },
  { label: '追蹤者', value: channel.value?.followerCount ?? '—', to: '/me/channel' },
  { label: '累積投票', value: dashboard.value.counts.votes, to: '/me/votes' },
  { label: '我的議題', value: dashboard.value.counts.topics, to: '/me/topics' },
  { label: '未讀通知', value: dashboard.value.counts.unreadNotifications, to: '/me/notifications' },
] : []);
const attentionItems = computed(() => {
  if (!dashboard.value) return [];
  const items: Array<{ label: string; to: string }> = [];
  if (dashboard.value.counts.pendingTopics) items.push({ label: `${dashboard.value.counts.pendingTopics} 個議題等待複核`, to: '/me/topics' });
  if (dashboard.value.counts.unreadNotifications) items.push({ label: `${dashboard.value.counts.unreadNotifications} 則未讀通知`, to: '/me/notifications' });
  if (dashboard.value.profile.status === 'NOT_STARTED') items.push({ label: '選填分析資料尚未設定', to: '/me/profile' });
  if (dashboard.value.profile.status === 'PENDING_GUARDIAN') items.push({ label: '等待完成監護人驗證', to: '/me/profile' });
  return items;
});

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
}

function topicStatus(topic: MemberDashboard['recentTopics'][number]) {
  if (topic.moderationStatus === 'PENDING_REVIEW') return '待平台複核';
  if (topic.moderationStatus === 'REJECTED') return '未通過複核';
  return topic.status === 'OPEN' ? '投票進行中' : '已停止投票';
}

onMounted(async () => {
  try {
    channel.value = await api.get<ChannelProfile>('/me/channel');
  } catch {
    channel.value = null;
  }
});
</script>

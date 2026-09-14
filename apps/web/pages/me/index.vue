<template>
  <div>
    <div class="flex flex-col gap-4 border-b border-[#171717] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 class="text-3xl font-black tracking-[-0.04em]">{{ dashboard ? `${dashboard.member.nickname}，你好` : '會員總覽' }}</h2>
      </div>
      <NuxtLink to="/topics/create" class="focus-ring bg-[#d84a36] px-5 py-3 text-center text-sm font-black text-white">＋ 發起新議題</NuxtLink>
    </div>

    <div v-if="!dashboard" class="mt-6 grid grid-cols-2 gap-3">
      <div v-for="item in 4" :key="item" class="h-24 animate-pulse bg-[#e5e0d6]" />
    </div>
    <template v-else>
      <section class="mt-6 grid grid-cols-2 gap-px border border-[#171717] bg-[#171717] sm:grid-cols-4">
        <div v-for="stat in stats" :key="stat.label" class="bg-[#faf8f3] p-4 sm:p-5">
          <strong class="block text-2xl font-black sm:text-3xl">{{ stat.value }}</strong>
          <span class="mt-1 block text-xs text-[#6d6861]">{{ stat.label }}</span>
        </div>
      </section>

      <section v-if="attentionItems.length" class="mt-6 border-l-4 border-[#b86b12] bg-[#fff0d7] p-5">
        <p class="eyebrow text-[#9a5b12]">需要處理</p>
        <NuxtLink v-for="item in attentionItems" :key="item.label" :to="item.to" class="focus-ring mt-3 flex items-center justify-between border-t border-[#e5c99c] pt-3 text-sm font-bold"><span>{{ item.label }}</span><span>&rarr;</span></NuxtLink>
      </section>

      <div class="mt-8 grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
        <section>
          <div class="flex items-end justify-between border-b-2 border-[#171717] pb-3"><h3 class="text-xl font-black">最近參與</h3><NuxtLink to="/me/votes" class="focus-ring text-xs font-bold">全部紀錄 &rarr;</NuxtLink></div>
          <div v-if="dashboard.recentVotes.length" class="divide-y divide-[#d7d1c6]">
            <article v-for="vote in dashboard.recentVotes" :key="vote.id" class="py-4">
              <div class="flex items-start justify-between gap-4"><NuxtLink :to="`/topic/${vote.topicId}`" class="focus-ring font-black leading-snug hover:text-[#3157d5]">{{ vote.topicTitle }}</NuxtLink><time class="shrink-0 text-[10px] text-[#8b857d]">{{ formatDate(vote.votedAt) }}</time></div>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#6d6861]"><span>我的選擇：<strong class="text-[#171717]">{{ vote.selection }}</strong></span></div>
            </article>
          </div>
          <p v-else class="py-10 text-center text-sm text-[#77716a]">還沒有投票紀錄。</p>
        </section>

        <section>
          <div class="border-b-2 border-[#171717] pb-3"><h3 class="text-xl font-black">議題動態</h3></div>
          <div v-if="dashboard.recentTopics.length" class="divide-y divide-[#d7d1c6]">
            <NuxtLink v-for="topic in dashboard.recentTopics" :key="topic.id" to="/me/topics" class="focus-ring block py-4"><strong class="block text-sm leading-snug">{{ topic.title }}</strong><span class="mt-1 block text-xs text-[#77716a]">{{ topicStatus(topic) }}</span></NuxtLink>
          </div>
          <p v-else class="py-10 text-center text-sm text-[#77716a]">還沒有發起議題。</p>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { MemberDashboard } from '~/types/member';

definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: '會員中心｜輿論測風向' });

const dashboard = useState<MemberDashboard | null>('member-dashboard', () => null);
const stats = computed(() => dashboard.value ? [
  { label: '可用點數', value: dashboard.value.member.points },
  { label: '累積投票', value: dashboard.value.counts.votes },
  { label: '我的議題', value: dashboard.value.counts.topics },
  { label: '未讀通知', value: dashboard.value.counts.unreadNotifications },
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
</script>

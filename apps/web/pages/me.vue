<template>
  <div class="pb-12">
    <header class="mb-6 border-b-2 border-[#171717] pb-5">
      <h1 class="text-3xl font-black tracking-[-0.04em]">會員中心</h1>
    </header>

    <div class="grid gap-7 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside class="hidden self-start border-t-4 border-[#171717] bg-[#ebe6dc] lg:sticky lg:top-28 lg:block">
        <div class="border-b border-[#cfc8bc] p-5">
          <UserAvatar :nickname="dashboard?.member.nickname || auth.nickname" :avatar-url="dashboard?.member.avatarUrl || auth.avatarUrl" size="lg" />
          <strong class="mt-4 block text-lg">{{ dashboard?.member.nickname || auth.nickname }}</strong>
          <span class="mt-1 block text-xs text-[#6d6861]">{{ dashboard?.member.maskedPhone || '已驗證會員' }}</span>
          <div class="mt-4 flex items-end justify-between border-t border-[#cfc8bc] pt-3">
            <span class="text-xs text-[#6d6861]">可用點數</span>
            <strong class="text-xl">{{ dashboard?.member.points || auth.points || '0' }}</strong>
          </div>
          <div class="mt-4">
            <div class="flex justify-between text-[10px] font-bold text-[#6d6861]"><span>{{ profileLabel }}</span><span>{{ dashboard?.profile.completionPercent || 0 }}%</span></div>
            <div class="mt-2 h-1.5 bg-[#d0c9bd]"><div class="h-full bg-[#3157d5]" :style="{ width: `${dashboard?.profile.completionPercent || 0}%` }" /></div>
          </div>
        </div>
        <nav class="py-2" aria-label="會員中心">
          <NuxtLink v-for="(item, index) in navigation" :key="item.to" :to="item.to" class="focus-ring flex items-center justify-between border-l-4 px-4 py-3 text-sm font-bold" :class="isActive(item.to) ? 'border-[#d84a36] bg-[#faf8f3]' : 'border-transparent text-[#5f5a53] hover:bg-white/50'">
            <span><small class="mr-2 text-[10px] text-[#9a948a]">0{{ index + 1 }}</small>{{ item.label }}</span>
            <span v-if="item.to === '/me/notifications' && unreadCount" class="bg-[#d84a36] px-1.5 py-0.5 text-[10px] text-white">{{ unreadCount }}</span>
          </NuxtLink>
        </nav>
        <div class="border-t border-[#cfc8bc] p-4 text-sm font-bold">
          <NuxtLink v-if="auth.canModerate" to="/admin/topics" class="focus-ring block py-2 text-[#3f7a58]">進入管理後台 &rarr;</NuxtLink>
          <NuxtLink v-if="auth.canReadEditorialApplications" to="/editorial/stance-applications" class="focus-ring block py-2 text-[#3157d5]">進入議題小組工作台 &rarr;</NuxtLink>
          <button class="focus-ring mt-1 py-2 text-[#8f3022]" @click="logout">登出</button>
        </div>
      </aside>

      <div>
        <label class="mb-5 block lg:hidden">
          <span class="mb-2 block text-xs font-bold text-[#6d6861]">會員中心選單</span>
          <select :value="mobilePath" class="focus-ring w-full border-2 border-[#171717] bg-[#faf8f3] px-4 py-3 text-sm font-bold" @change="changeSection">
            <option v-for="item in navigation" :key="item.to" :value="item.to">{{ item.label }}{{ item.to === '/me/notifications' && unreadCount ? `（${unreadCount}）` : '' }}</option>
          </select>
        </label>
        <NuxtPage />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MemberDashboard } from '~/types/member';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const api = useApi();
const auth = useAuthStore();
const dashboard = useState<MemberDashboard | null>('member-dashboard', () => null);
const navigation = [
  { label: '會員總覽', to: '/me' },
  { label: '投票紀錄', to: '/me/votes' },
  { label: '我的議題', to: '/me/topics' },
  { label: '我的快問', to: '/me/quick' },
  { label: '我的提案', to: '/me/applications' },
  { label: '我的 GIF', to: '/me/gifs' },
  { label: '點數帳本', to: '/me/points' },
  { label: '通知中心', to: '/me/notifications' },
  { label: '資料與隱私', to: '/me/profile' },
];
const unreadCount = computed(() => dashboard.value?.counts.unreadNotifications || 0);
const profileLabel = computed(() => ({
  NOT_STARTED: '選填分析資料未設定',
  PENDING_GUARDIAN: '等待監護驗證',
  ACTIVE: '人口分析已啟用',
  INACTIVE: '人口分析未啟用',
}[dashboard.value?.profile.status || 'NOT_STARTED']));
const mobilePath = computed(() => navigation.find((item) => isActive(item.to))?.to || '/me');

function isActive(path: string) {
  return path === '/me' ? route.path === '/me' : route.path.startsWith(path);
}

function changeSection(event: Event) {
  navigateTo((event.target as HTMLSelectElement).value);
}

async function loadDashboard() {
  try {
    dashboard.value = await api.get<MemberDashboard>('/me/dashboard');
  } catch {
    dashboard.value = null;
  }
}

async function logout() {
  dashboard.value = null;
  auth.clear();
  await navigateTo('/');
}

onMounted(loadDashboard);
</script>

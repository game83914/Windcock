<template>
  <div class="min-h-screen bg-[#f4f1ea] text-[#171717]">
    <header class="sticky top-0 z-40 border-b border-[#171717] bg-[#f4f1ea]/95 backdrop-blur">
      <nav class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-6 sm:px-6" aria-label="主要導覽">
        <NuxtLink to="/" class="focus-ring flex shrink-0 items-center gap-3">
          <span class="grid h-9 w-9 place-items-center rounded-xl bg-[#171717] text-sm font-black text-white">風</span>
          <span class="hidden sm:block">
            <strong class="block text-lg font-black leading-none tracking-[-0.04em]">輿論測風向</strong>
          </span>
        </NuxtLink>

        <div class="hidden flex-1 items-center justify-center gap-6 lg:flex">
          <NuxtLink v-if="authed && (auth.canAuthorTopics || auth.canSubmitTopicApplication)" to="/topics/create" class="focus-ring border-l border-[#cfc8bc] pl-6 text-sm font-black text-[#d84a36] hover:text-[#171717]">{{ auth.canAuthorTopics ? '建立議題' : '提出議題' }}</NuxtLink>
          <NuxtLink v-if="canCreateQuick" to="/topics/quick" class="focus-ring border-l border-[#cfc8bc] pl-6 text-sm font-black text-[#b0761f] hover:text-[#171717]">發起快問</NuxtLink>
        </div>

        <div class="flex shrink-0 items-center gap-2 text-sm sm:gap-3">
          <template v-if="authed">
            <NuxtLink v-if="canCreateQuick" to="/topics/quick" class="focus-ring rounded-lg bg-[#b0761f] px-3 py-2 text-xs font-bold text-white lg:hidden">快問</NuxtLink>
            <NuxtLink v-if="auth.canAuthorTopics || auth.canSubmitTopicApplication" to="/topics/create" class="focus-ring rounded-lg bg-[#d84a36] px-3 py-2 text-xs font-bold text-white lg:hidden">{{ auth.canAuthorTopics ? '建立' : '提案' }}</NuxtLink>
            <details class="group relative">
              <summary class="focus-ring flex cursor-pointer list-none items-center gap-2 rounded-xl border border-[#ded7cb] bg-white px-2 py-1.5 hover:border-[#b9b0a3] [&::-webkit-details-marker]:hidden">
                <UserAvatar :nickname="auth.nickname" :avatar-url="auth.avatarUrl" size="sm" />
                <span class="hidden text-left sm:block"><strong class="block text-xs leading-none">{{ auth.nickname }}</strong><small class="mt-1 block text-[10px] text-[#77716a]">{{ auth.points }} 點</small></span>
                <span class="text-[10px] text-[#77716a]">▼</span>
              </summary>
              <div class="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-[#ded7cb] bg-[#faf8f3] p-1.5 shadow-[0_12px_36px_rgba(23,23,23,0.16)]">
                <NuxtLink to="/me" class="focus-ring block px-3 py-2 text-sm font-black hover:bg-[#ebe6dc]">會員中心</NuxtLink>
                <NuxtLink to="/me/notifications" class="focus-ring flex items-center justify-between px-3 py-2 text-xs font-bold hover:bg-[#ebe6dc]">通知<span v-if="unreadCount" class="inline-grid min-w-4 place-items-center rounded-full bg-[#d84a36] px-1 text-[9px] text-white">{{ unreadCount > 9 ? '9+' : unreadCount }}</span></NuxtLink>
                <NuxtLink to="/me/votes" class="focus-ring block px-3 py-2 text-xs font-bold hover:bg-[#ebe6dc]">投票紀錄</NuxtLink>
                <NuxtLink to="/me/topics" class="focus-ring block px-3 py-2 text-xs font-bold hover:bg-[#ebe6dc]">我的議題</NuxtLink>
                <NuxtLink to="/me/applications" class="focus-ring block px-3 py-2 text-xs font-bold hover:bg-[#ebe6dc]">我的提案</NuxtLink>
                <NuxtLink to="/me/gifs" class="focus-ring block px-3 py-2 text-xs font-bold hover:bg-[#ebe6dc]">我的 GIF</NuxtLink>
                <NuxtLink to="/me/profile" class="focus-ring block px-3 py-2 text-xs font-bold hover:bg-[#ebe6dc]">資料與隱私</NuxtLink>
                <NuxtLink v-if="auth.canModerate" to="/admin/topics" class="focus-ring block border-t border-[#d7d1c6] px-3 py-2 text-xs font-bold text-[#3f7a58] hover:bg-[#ebe6dc]">最高管理</NuxtLink>
                <NuxtLink v-if="auth.canReadEditorialApplications" to="/editorial/stance-applications" class="focus-ring block border-t border-[#d7d1c6] px-3 py-2 text-xs font-bold text-[#3157d5] hover:bg-[#ebe6dc]">議題小組工作台</NuxtLink>
                <NuxtLink v-if="auth.canManageCategories || auth.canFeatureTopics" to="/editorial/content-settings" class="focus-ring block border-t border-[#d7d1c6] px-3 py-2 text-xs font-bold text-[#3f7a58] hover:bg-[#ebe6dc]">內容設定</NuxtLink>
                <button class="focus-ring block w-full border-t border-[#d7d1c6] px-3 py-2 text-left text-xs font-bold text-[#8f3022] hover:bg-[#fbe9e5]" @click="logout">登出</button>
              </div>
            </details>
          </template>
          <template v-else>
            <NuxtLink to="/login" class="focus-ring rounded-xl bg-[#d84a36] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#171717]">註冊/登入</NuxtLink>
          </template>
        </div>
      </nav>
    </header>
    <DevIdentitySwitcher v-if="authed" />

    <main class="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7 sm:pb-16">
      <NuxtPage />
    </main>

    <UiToastHost />
  </div>
</template>

<script setup lang="ts">
const auth = useAuthStore();
const authed = computed(() => auth.isAuthed);
const canCreateQuick = computed(() => authed.value && (auth.canAuthorTopics || auth.capabilitySummary?.membershipTier === 'SENIOR'));
const api = useApi();
const unreadCount = ref(0);

async function loadUnreadCount() {
  if (!authed.value) {
    unreadCount.value = 0;
    return;
  }
  try {
    unreadCount.value = (await api.get<{ unreadCount: number }>('/notifications/unread-count')).unreadCount;
  } catch {
    unreadCount.value = 0;
  }
}

async function loadCapabilities() {
  if (!authed.value) return;
  try {
    auth.setCapabilities(await api.get('/me/capabilities'));
  } catch {
    // The API remains authoritative; unavailable capabilities hide privileged actions.
  }
}

function updateUnreadCount(event: Event) {
  unreadCount.value = (event as CustomEvent<number>).detail ?? 0;
}

function refreshIdentityData() {
  loadUnreadCount();
  loadCapabilities();
}

onMounted(() => {
  loadUnreadCount();
  loadCapabilities();
  window.addEventListener('notifications-read', updateUnreadCount);
  window.addEventListener('identity-changed', refreshIdentityData);
});
onUnmounted(() => {
  window.removeEventListener('notifications-read', updateUnreadCount);
  window.removeEventListener('identity-changed', refreshIdentityData);
});
watch(authed, () => { loadUnreadCount(); loadCapabilities(); });

async function logout() {
  auth.clear();
  await navigateTo('/');
}
</script>

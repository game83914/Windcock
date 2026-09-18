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

        <div v-if="showCreateButton" ref="createAreaEl" class="relative shrink-0">
          <button
            type="button"
            class="focus-ring grid size-9 place-items-center rounded-xl bg-[#d84a36] text-white transition hover:bg-[#171717]"
            aria-haspopup="menu"
            :aria-expanded="createMenuOpen"
            @click="createMenuOpen = !createMenuOpen"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <Transition name="create-drop">
            <div v-if="createMenuOpen" role="menu" aria-label="選擇要建立的內容類型" class="absolute left-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-[#ded7cb] bg-[#faf8f3] p-1.5 shadow-[0_12px_36px_rgba(23,23,23,0.16)]">
              <NuxtLink
                v-if="canCreateTopic"
                role="menuitem"
                to="/topics/create"
                class="focus-ring block px-3 py-2.5 text-sm font-black text-[#d84a36] hover:bg-[#fbe9e5]"
                @click="createMenuOpen = false"
              >建立議題</NuxtLink>
              <NuxtLink
                v-if="canCreateQuick"
                role="menuitem"
                to="/topics/quick"
                class="focus-ring block px-3 py-2.5 text-sm font-black text-[#b0761f] hover:bg-[#fff0d7]"
                @click="createMenuOpen = false"
              >發起快問</NuxtLink>
              <NuxtLink
                v-if="canCreateQuick"
                role="menuitem"
                to="/topics/survey"
                class="focus-ring block px-3 py-2.5 text-sm font-black text-[#b0761f] hover:bg-[#fff0d7]"
                @click="createMenuOpen = false"
              >發起問卷</NuxtLink>
              <NuxtLink
                v-if="canCreateQuick"
                role="menuitem"
                to="/topics/staged"
                class="focus-ring block px-3 py-2.5 text-sm font-black text-[#b0761f] hover:bg-[#fff0d7]"
                @click="createMenuOpen = false"
              >發起回合制</NuxtLink>
            </div>
          </Transition>
        </div>

        <NuxtLink to="/search" class="focus-ring grid size-9 shrink-0 place-items-center rounded-xl border border-[#ded7cb] bg-white text-[#171717] transition hover:border-[#b0761f] hover:text-[#b0761f]" aria-label="搜尋議題" title="搜尋議題">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        </NuxtLink>

        <div class="flex flex-1 items-center justify-center gap-6 lg:flex"></div>

        <div class="flex shrink-0 items-center gap-2 text-sm sm:gap-3">
          <template v-if="authed">
            <details ref="memberMenuEl" class="group relative">
              <summary class="focus-ring grid size-9 cursor-pointer list-none place-items-center rounded-xl border border-[#ded7cb] bg-white text-[#171717] transition hover:border-[#b0761f] hover:text-[#b0761f] [&::-webkit-details-marker]:hidden" aria-label="會員功能表" title="會員中心">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </summary>
              <div class="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-[#ded7cb] bg-[#faf8f3] p-1.5 shadow-[0_12px_36px_rgba(23,23,23,0.16)]" @click="closeMemberMenu">
                <NuxtLink to="/me" class="focus-ring block px-3 py-2 text-sm font-black hover:bg-[#ebe6dc]">會員中心</NuxtLink>
                <NuxtLink to="/me/notifications" class="focus-ring flex items-center justify-between px-3 py-2 text-xs font-bold hover:bg-[#ebe6dc]">通知<span v-if="unreadCount" class="inline-grid min-w-4 place-items-center rounded-full bg-[#d84a36] px-1 text-[9px] text-white">{{ unreadCount > 9 ? '9+' : unreadCount }}</span></NuxtLink>
                <NuxtLink to="/me/votes" class="focus-ring block px-3 py-2 text-xs font-bold hover:bg-[#ebe6dc]">投票紀錄</NuxtLink>
                <NuxtLink to="/me/topics" class="focus-ring block px-3 py-2 text-xs font-bold hover:bg-[#ebe6dc]">我的議題</NuxtLink>
                <NuxtLink to="/me/surveys" class="focus-ring block px-3 py-2 text-xs font-bold hover:bg-[#ebe6dc]">我的問卷</NuxtLink>
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
const api = useApi();
const unreadCount = ref(0);

const createAreaEl = ref<HTMLElement | null>(null);
const createMenuOpen = ref(false);
const memberMenuEl = ref<HTMLDetailsElement | null>(null);
const canCreateTopic = computed(() => authed.value && (auth.canAuthorTopics || auth.canSubmitTopicApplication));
const canCreateQuick = computed(() => authed.value && (auth.canAuthorTopics || auth.capabilitySummary?.membershipTier === 'SENIOR'));
const showCreateButton = computed(() => canCreateTopic.value || canCreateQuick.value);

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
  window.addEventListener('pointerdown', onOutsidePointerDown);
  window.addEventListener('keydown', onEscape, true);
});
onUnmounted(() => {
  window.removeEventListener('notifications-read', updateUnreadCount);
  window.removeEventListener('identity-changed', refreshIdentityData);
  window.removeEventListener('pointerdown', onOutsidePointerDown);
  window.removeEventListener('keydown', onEscape, true);
});
watch(authed, () => { loadUnreadCount(); loadCapabilities(); });

async function logout() {
  auth.clear();
  await navigateTo('/');
}

function closeMemberMenu() {
  if (memberMenuEl.value) memberMenuEl.value.open = false;
}

function onOutsidePointerDown(event: PointerEvent) {
  const target = event.target as Node;
  const createArea = createAreaEl.value;
  if (createMenuOpen.value && createArea && !createArea.contains(target)) createMenuOpen.value = false;
  const memberMenu = memberMenuEl.value;
  if (memberMenu?.open && !memberMenu.contains(target)) memberMenu.open = false;
}

function onEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (createMenuOpen.value) createMenuOpen.value = false;
    const memberMenu = memberMenuEl.value;
    if (memberMenu?.open) memberMenu.open = false;
  }
}
</script>

<style scoped>
.create-drop-enter-active,
.create-drop-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.create-drop-enter-from,
.create-drop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .create-drop-enter-active,
  .create-drop-leave-active {
    transition: none;
  }
}
</style>

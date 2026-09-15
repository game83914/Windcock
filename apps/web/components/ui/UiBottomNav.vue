<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-[60] border-t border-[#ded7cb] bg-[#faf8f3]/95 backdrop-blur lg:hidden"
    aria-label="主要導覽"
  >
    <div class="mx-auto grid max-w-lg grid-cols-4">
      <template v-for="item in items" :key="item.to">
        <NuxtLink
          v-if="!item.requiresAuth || authed"
          :to="item.to"
          class="focus-ring flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-bold transition"
          :class="isActive(item.to) ? 'text-[#d84a36]' : 'text-[#8b857d] hover:text-[#171717]'"
        >
          <span class="relative grid h-6 w-6 place-items-center">
            <span v-html="item.icon" />
            <span
              v-if="item.to === '/me/notifications' && unreadCount"
              class="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-[#d84a36] px-1 text-[9px] text-white"
            >{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
          </span>
          {{ item.label }}
        </NuxtLink>
      </template>
    </div>
  </nav>
</template>

<script setup lang="ts">
interface NavItem {
  to: string;
  label: string;
  icon: string;
  requiresAuth?: boolean;
  match?: string[];
}

const props = defineProps<{ authed?: boolean; unreadCount?: number }>();

const route = useRoute();

const items: NavItem[] = [
  {
    to: '/',
    label: '首頁',
    match: ['/'],
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>',
  },
  {
    to: '/topics/quick',
    label: '快問',
    match: ['/topics/quick'],
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/></svg>',
  },
  {
    to: '/topics/create',
    label: '發起',
    requiresAuth: true,
    match: ['/topics/create', '/topics/quick'],
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  },
  {
    to: '/me',
    label: '會員',
    requiresAuth: true,
    match: ['/me'],
    icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  },
];

function isActive(to: string) {
  const item = items.find((entry) => entry.to === to);
  const targets = item?.match ?? [to];
  if (to === '/') return route.path === '/';
  return targets.some((target) => route.path.startsWith(target));
}
</script>
<template>
  <nav class="mb-7 flex gap-2 border-b border-[#d7d1c6] pb-4" aria-label="內容管理">
    <NuxtLink v-if="auth.capabilitySummary?.capabilities.includes('ADMIN')" to="/admin/topics" class="focus-ring border px-4 py-2 text-sm font-black" :class="route.path === '/admin/topics' ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#cfc8bc] bg-[#faf8f3]'">議題複核</NuxtLink>
    <NuxtLink to="/admin/gifs" class="focus-ring border px-4 py-2 text-sm font-black" :class="route.path === '/admin/gifs' ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#cfc8bc] bg-[#faf8f3]'">GIF 管理</NuxtLink>
    <NuxtLink to="/admin/stances" class="focus-ring border px-4 py-2 text-sm font-black" :class="route.path === '/admin/stances' ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#cfc8bc] bg-[#faf8f3]'">立場檢舉</NuxtLink>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute();
const auth = useAuthStore();
</script>

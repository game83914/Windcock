<template>
  <div class="mx-auto max-w-xl py-20 text-center">
    <div v-if="loading" class="h-48 animate-pulse rounded-2xl bg-[#e5e0d6]" />
    <div v-else class="surface-card p-8 sm:p-12">
      <p class="eyebrow-modern text-[#d84a36]">Private Link</p>
      <h1 class="mt-3 text-2xl font-black">無法開啟這則快問</h1>
      <p class="mt-3 text-sm leading-6 text-[#6d6861]">{{ pageError }}</p>
      <NuxtLink to="/" class="focus-ring mt-6 inline-block bg-[#171717] px-5 py-3 text-sm font-black text-white">返回首頁</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const route = useRoute();
const api = useApi();
const loading = ref(true);
const pageError = ref('');

useSeoMeta({ title: '開啟私密快問｜輿論測風向', robots: 'noindex, nofollow', referrer: 'no-referrer' });

onMounted(async () => {
  try {
    const token = Array.isArray(route.params.token) ? route.params.token[0] : route.params.token;
    const result = await api.post<{ topicId: string }>('/topics/share-links/redeem', { token });
    await navigateTo(`/topic/${result.topicId}`, { replace: true });
  } catch (error) {
    pageError.value = errorMessage(error);
    loading.value = false;
  }
});
</script>

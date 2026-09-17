<template>
  <div class="pb-12">
    <header class="grid gap-6 border-b border-[#ded7cb] pb-7 md:grid-cols-[1fr_auto] md:items-end">
      <div>
        <p class="eyebrow-modern text-[#7a5cbf]">Meme Bazaar</p>
        <h1 class="mt-1 text-4xl font-black tracking-[-0.05em] sm:text-5xl">GIF 梗圖市集</h1>
        <p class="mt-3 max-w-xl text-sm leading-6 text-[#6d6861]">所有已核准 GIF 都能在議題與討論中免費直接使用；每次合格使用都會替創作者帶來 1 點回饋。</p>
      </div>
      <UiButton :to="auth.isAuthed ? '/me/gifs?tab=upload' : '/login?redirect=%2Fme%2Fgifs%3Ftab%3Dupload'">投稿你的 GIF</UiButton>
    </header>

    <form class="surface-card my-6 grid gap-3 p-4 sm:grid-cols-[1fr_auto]" @submit.prevent="applyFilters">
      <input v-model.trim="draftSearch" type="search" placeholder="搜尋 GIF 標題" class="field-input" />
      <select v-model="sort" class="field-input !py-2.5 font-bold" @change="applyFilters">
        <option value="NEWEST">最新上架</option>
        <option value="POPULAR">最多使用</option>
      </select>
    </form>

    <p v-if="pageError" class="rounded-2xl border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm text-[#8f3022]">{{ pageError }}</p>
    <div v-if="loading" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"><div v-for="n in 8" :key="n" class="h-72 animate-pulse rounded-2xl bg-[#e5e0d6]" /></div>
    <div v-else-if="items.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <GifCard v-for="asset in items" :key="asset.id" :asset="asset" />
    </div>
    <p v-else class="surface-card py-20 text-center text-sm text-[#77716a]">找不到符合條件的 GIF。</p>

    <nav v-if="pagination.total > pagination.limit" class="mt-8 flex items-center justify-center gap-4 text-sm font-bold" aria-label="GIF 市集分頁">
      <UiButton variant="outline" size="sm" :disabled="page <= 1" @click="goPage(page - 1)">← 上一頁</UiButton>
      <span class="tabular-nums">{{ page }} / {{ pageCount }}</span>
      <UiButton variant="outline" size="sm" :disabled="page >= pageCount" @click="goPage(page + 1)">下一頁 →</UiButton>
    </nav>
  </div>
</template>

<script setup lang="ts">
import type { GifAsset, GifListResponse } from '~/types/gif';

useSeoMeta({ title: 'GIF 梗圖市集｜輿論測風向' });
const api = useApi();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const items = ref<GifAsset[]>([]);
const loading = ref(true);
const pageError = ref('');
const draftSearch = ref(typeof route.query.search === 'string' ? route.query.search : '');
const search = ref(draftSearch.value);
const sort = ref(['NEWEST', 'POPULAR'].includes(String(route.query.sort)) ? String(route.query.sort) : 'NEWEST');
const page = ref(Math.max(1, Number(route.query.page) || 1));
const pagination = ref<GifListResponse['pagination']>({ page: 1, limit: 24, total: 0 });
const pageCount = computed(() => Math.max(1, pagination.value.totalPages || Math.ceil(pagination.value.total / pagination.value.limit)));

async function load() {
  loading.value = true;
  pageError.value = '';
  try {
    const result = await api.get<GifListResponse>('/memes', { search: search.value || undefined, sort: sort.value, page: page.value, limit: 24 });
    items.value = result.items;
    pagination.value = result.pagination;
  } catch (error) {
    pageError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

function syncUrl() {
  router.replace({ query: { search: search.value || undefined, sort: sort.value === 'NEWEST' ? undefined : sort.value, page: page.value > 1 ? String(page.value) : undefined } });
}
function applyFilters() { search.value = draftSearch.value; page.value = 1; syncUrl(); load(); }
function goPage(value: number) { page.value = value; syncUrl(); load(); if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' }); }

onMounted(load);
</script>

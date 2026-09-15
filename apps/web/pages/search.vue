<template>
  <div class="pb-10">
    <h1 class="sr-only">搜尋議題</h1>

    <section class="sticky top-16 z-30 -mx-4 mb-6 border-b border-[#d7d1c6] bg-[#f4f1ea]/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
      <label class="flex items-center gap-2.5 rounded-2xl border-2 border-[#b0761f] bg-white py-3 pl-4 pr-3">
        <svg class="shrink-0 text-[#b0761f]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input
          ref="searchInputEl"
          v-model="searchInput"
          type="search"
          maxlength="100"
          placeholder="搜尋議題標題或描述"
          aria-label="搜尋議題"
          class="min-w-0 flex-1 bg-transparent text-base font-bold outline-none"
        />
        <button
          v-if="searchInput"
          type="button"
          class="focus-ring grid size-7 shrink-0 place-items-center rounded-full text-[#77716a] hover:bg-[#ebe6dc] hover:text-[#171717]"
          aria-label="清除搜尋"
          @click="clearSearch"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </label>
      <p class="sr-only" aria-live="polite">{{ resultsAnnouncement }}</p>
    </section>

    <div v-if="!searchTerm" class="border border-[#d7d1c6] bg-[#faf8f3] px-6 py-20 text-center">
      <svg class="mx-auto text-[#b9b0a3]" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
      <h2 class="mt-4 text-lg font-black">輸入關鍵字開始搜尋議題</h2>
      <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-[#77716a]">可搜尋議題標題或描述，例如「能源」、「教育」、「居住正義」。</p>
    </div>

    <template v-else>
      <div v-if="isInitialLoading" class="space-y-8" aria-live="polite">
        <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <div v-for="item in 3" :key="item" class="h-72 animate-pulse rounded-2xl bg-[#e5e0d6] motion-reduce:animate-none" />
        </div>
        <p class="sr-only">搜尋結果載入中</p>
      </div>

      <section v-else-if="error" class="border border-[#9c3b3b] bg-[#f6e7e7] px-5 py-12 text-center text-sm text-[#7c2f2f]">
        <p>無法取得搜尋結果。</p>
        <button type="button" class="focus-ring mt-3 border border-[#7c2f2f] px-4 py-2 font-bold" @click="refresh()">重新搜尋</button>
      </section>

      <section v-else-if="topics.length" :aria-busy="status === 'pending'">
        <div class="mb-5 flex items-baseline gap-3">
          <h2 class="text-xl font-black tracking-[-0.035em]">搜尋「{{ searchTerm }}」</h2>
        </div>
        <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <component
            :is="topic.kind === 'QUICK' ? QuickPollCard : TopicCard"
            v-for="topic in topics"
            :key="topic.id"
            :topic="topic"
          />
        </div>
      </section>

      <section v-else class="border border-[#d7d1c6] bg-[#faf8f3] px-6 py-16 text-center">
        <h2 class="text-lg font-black">找不到符合「{{ searchTerm }}」的議題</h2>
        <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-[#77716a]">請嘗試換一個關鍵字，或縮短搜尋範圍。</p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Topic, TopicListResponse } from '~/types/topic';
import TopicCard from '~/components/home/TopicCard.vue';
import QuickPollCard from '~/components/home/QuickPollCard.vue';

useSeoMeta({
  title: '搜尋議題｜輿論測風向',
  description: '搜尋台灣公共議題的即時民調。',
});

const api = useApi();
const route = useRoute();
const router = useRouter();
const initialSearch = queryText(route.query.q);
const searchInput = ref(initialSearch);
const searchTerm = ref(initialSearch);

const searchInputEl = ref<HTMLInputElement | null>(null);

const [{ data, status, error, refresh }] = await Promise.all([
  useAsyncData(
    'search-topics',
    () => searchTerm.value
      ? api.get<TopicListResponse>('/topics', {
          page: 1,
          limit: 9,
          search: searchTerm.value,
          sort: 'ACTIVITY',
          kind: 'ALL',
        })
      : Promise.resolve(emptyTopicList(9)),
    { default: () => emptyTopicList(9), watch: [searchTerm] },
  ),
]);

const topics = computed<Topic[]>(() => data.value.items);
const hasLoaded = ref(status.value === 'success');
const isInitialLoading = computed(() => status.value === 'pending' && !hasLoaded.value);
const resultsAnnouncement = computed(() => {
  if (!searchTerm.value) return '請輸入關鍵字';
  if (status.value === 'pending') return '搜尋中';
  if (error.value) return '搜尋失敗';
  return `共 ${data.value.pagination.total} 筆搜尋結果`;
});

let searchTimer: ReturnType<typeof setTimeout> | null = null;

watch(searchInput, (value) => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTimer = null;
    const next = value.trim();
    searchTerm.value = next;
    if (import.meta.client) void router.replace({ query: next ? { q: next } : {} });
  }, 300);
});
watch(status, (nextStatus) => {
  if (nextStatus === 'success') hasLoaded.value = true;
});

onMounted(() => {
  nextTick(() => searchInputEl.value?.focus());
});
onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer);
});

function clearSearch() {
  searchInput.value = '';
  searchTerm.value = '';
  hasLoaded.value = false;
}

function emptyTopicList(limit: number): TopicListResponse {
  return { items: [], categoryCounts: {}, pagination: { page: 1, limit, total: 0, pages: 0 } };
}

function queryText(value: unknown) {
  return typeof value === 'string' ? value : '';
}
</script>
<template>
  <div class="pb-10">
    <h1 class="sr-only">輿論測風向</h1>
    <section class="mb-7 grid grid-cols-[auto_minmax(0,1fr)] items-center border-y border-[#cfc8bc] py-3 text-xs font-semibold text-[#5f5a54]">
      <span class="eyebrow relative z-10 bg-[#d84a36] px-2.5 py-1.5 text-white">今日風向</span>
      <div class="ticker ml-3 overflow-hidden" aria-label="最新留言動態">
        <div v-if="commentActivities.length" class="ticker-track flex w-max">
          <div v-for="copy in 2" :key="copy" class="ticker-copy flex shrink-0 items-center gap-10 pr-10" :aria-hidden="copy === 2">
            <NuxtLink
              v-for="activity in commentActivities"
              :key="`${copy}-${activity.id}`"
              :to="`/topic/${activity.topicId}`"
              class="ticker-item focus-ring whitespace-nowrap hover:text-[#d84a36]"
              :tabindex="copy === 2 ? -1 : undefined"
            >
              <strong class="text-[#171717]">{{ activity.author }}</strong>
              在「{{ activity.topicTitle }}」留言：{{ commentSnippet(activity.content) }}
            </NuxtLink>
          </div>
        </div>
        <p v-else class="text-[#77716a]">等待最新討論</p>
      </div>
    </section>

    <div v-if="isInitialLoading" class="space-y-8" aria-live="polite">
      <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="item in 3" :key="item" class="h-72 animate-pulse rounded-2xl bg-[#e5e0d6] motion-reduce:animate-none" />
      </div>
      <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="item in 6" :key="item" class="h-72 animate-pulse rounded-2xl bg-[#e5e0d6] motion-reduce:animate-none" />
      </div>
      <p class="sr-only">議題載入中</p>
    </div>

    <section v-else-if="fatalError" class="border-2 border-[#171717] bg-[#faf8f3] px-6 py-16 text-center">
      <h2 class="mt-3 text-2xl font-black">暫時無法取得議題</h2>
      <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-[#77716a]">請確認 API 服務已啟動，或稍後重新整理。本頁不會持續停留在載入狀態。</p>
      <button class="focus-ring mt-6 bg-[#171717] px-6 py-3 text-sm font-bold text-white hover:bg-[#d84a36]" @click="refreshHomepage">
        重新載入
      </button>
    </section>

<template v-else-if="featuredTopics.length || topics.length || hasActiveFilters">
    <section v-if="featuredTopics.length">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-black text-[#d84a36] sm:text-2xl">焦點議題</h2>
        </div>
      </div>
      <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <HomeTopicCard v-for="topic in featuredTopics.slice(0, 3)" :key="topic.id" :topic="topic" />
      </div>
    </section>

    <section
        :id="activeCategory === 'all' ? 'hot-topics' : `category-${activeCategory}`"
        class="scroll-mt-28 py-12 sm:py-16"
        :aria-busy="status === 'pending'"
      >
        <div class="mb-6 grid gap-3 border-b border-[#171717] pb-4 sm:flex sm:items-end sm:justify-between">
          <div class="flex flex-wrap items-baseline gap-3">
            <h2 class="text-xl font-black tracking-[-0.035em] sm:text-2xl">{{ sectionHeading }}</h2>
          </div>
          <div class="min-w-0">
          <div class="flex items-center gap-2.5 sm:gap-3">
            <label class="flex min-w-0 flex-1 items-center gap-1.5 rounded-2xl border border-[#d3cbc0] bg-white py-2 pl-2.5 pr-1 sm:max-w-44">
              <svg class="shrink-0 text-[#77716a]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" /></svg>
              <select v-model="activeCategory" class="min-w-0 flex-1 bg-transparent py-0.5 text-sm font-bold outline-none" aria-label="議題分類" @change="selectCategory(activeCategory)">
                <option value="all">全部</option>
                <option
                  v-for="category in filterChips"
                  :key="category.key"
                  :value="category.key"
                >{{ category.key === 'quick' ? '快問' : category.label }}</option>
              </select>
            </label>
            <label class="flex min-w-0 flex-1 items-center gap-1.5 rounded-2xl border border-[#d3cbc0] bg-white py-2 pl-2.5 pr-1 sm:max-w-44">
              <svg class="shrink-0 text-[#77716a]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" /></svg>
              <select v-model="sort" class="min-w-0 flex-1 bg-transparent py-0.5 text-sm font-bold outline-none" @change="selectSort">
                <option value="ACTIVITY">更新時間</option>
                <option value="POPULAR">熱門</option>
                <option value="NEWEST">建立時間</option>
              </select>
            </label>
            <button
              type="button"
              class="focus-ring grid size-9 shrink-0 place-items-center rounded-2xl border transition"
              :class="showSearch || searchActive ? 'border-[#d84a36] bg-[#fbe9e5] text-[#d84a36]' : 'border-[#d3cbc0] bg-white text-[#5f5a53] hover:border-[#b9b0a3]'"
              :aria-expanded="showSearch"
              :aria-label="showSearch ? '收起搜尋' : '展開搜尋'"
              @click="toggleSearch"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            </button>
          </div>
          <Transition name="search-drop">
            <div v-if="showSearch" class="mt-2.5">
              <label class="flex items-center gap-2 rounded-2xl border border-[#d3cbc0] bg-white py-2 pl-3 pr-2">
                <svg class="shrink-0 text-[#77716a]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                <input ref="searchInputEl" v-model="searchInput" type="search" maxlength="100" placeholder="搜尋議題標題或描述" aria-label="搜尋議題" class="min-w-0 flex-1 bg-transparent py-0.5 text-sm font-bold outline-none" />
                <button v-if="searchInput" type="button" class="focus-ring grid size-6 shrink-0 place-items-center rounded-full text-[#77716a] hover:bg-[#ebe6dc] hover:text-[#171717]" aria-label="清除搜尋" @click="clearSearch">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </label>
            </div>
          </Transition>
        </div>
        </div>
        <p class="sr-only" aria-live="polite">{{ resultsAnnouncement }}</p>
        <div v-if="error" role="alert" class="border border-[#9c3b3b] bg-[#f6e7e7] px-5 py-8 text-center text-sm text-[#7c2f2f]">
          <p>無法取得符合目前條件的議題。</p>
          <button type="button" class="focus-ring mt-3 border border-[#7c2f2f] px-4 py-2 font-bold" @click="refresh()">重新載入議題</button>
        </div>
        <div v-else-if="status === 'pending'" class="grid gap-5 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          <div v-for="item in 3" :key="item" class="h-72 animate-pulse bg-[#e5e0d6] motion-reduce:animate-none" />
        </div>
        <div v-else-if="topics.length" class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <component
            :is="topic.kind === 'QUICK' ? QuickPollCard : HomeTopicCard"
            v-for="topic in topics"
            :key="topic.id"
            :topic="topic"
          />
        </div>
        <p v-else class="border border-[#d7d1c6] bg-[#faf8f3] py-16 text-center text-sm text-[#77716a]">{{ emptyMessage }}</p>
        <div v-if="status === 'success'" class="mt-8 flex flex-col items-center gap-3">
          <div v-if="topicPage < totalPages" ref="loadMoreSentinel" class="flex min-h-14 w-full flex-col items-center justify-center gap-2 text-xs text-[#77716a]" aria-live="polite">
            <span v-if="loadingMore" class="inline-block size-4 animate-spin rounded-full border-2 border-[#d3cbc0] border-t-[#d84a36]" />
            <span>{{ loadingMore ? '載入中…' : '繼續下滑，自動載入更多' }}</span>
          </div>
          <p class="text-xs text-[#77716a]">
            <template v-if="topicPage < totalPages">已顯示 {{ topics.length }} / {{ data.pagination.total }} 筆</template>
            <span v-else>已顯示全部 {{ topics.length }} 筆・已到底部</span>
          </p>
        </div>
      </section>
    </template>

    <section v-else class="border-2 border-[#171717] bg-[#faf8f3] px-6 py-20 text-center">
      <h2 class="mt-3 text-2xl font-black">目前沒有進行中的議題</h2>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Topic, TopicListResponse } from '~/types/topic';
import type { CommentActivity } from '~/composables/useRealtime';
import { useCategories } from '~/composables/useCategories';
import HomeTopicCard from '~/components/home/TopicCard.vue';
import QuickPollCard from '~/components/home/QuickPollCard.vue';

useSeoMeta({
  title: '輿論測風向｜看見真實民意',
  description: '瀏覽台灣公共議題的即時民調，透過手機門號驗證確保一人一票。',
});

const api = useApi();
const route = useRoute();
const router = useRouter();
const initialCategory = queryText(route.query.category) || 'all';
const initialSearch = queryText(route.query.search);
const initialPage = 1;
const initialSort = (['POPULAR', 'NEWEST', 'ACTIVITY'] as const).includes(queryText(route.query.sort) as 'POPULAR' | 'NEWEST' | 'ACTIVITY')
  ? (queryText(route.query.sort) as 'POPULAR' | 'NEWEST' | 'ACTIVITY')
  : 'ACTIVITY';
const activeCategory = ref(initialCategory);
const searchInput = ref(initialSearch);
const searchTerm = ref(initialSearch);
const topicPage = ref(initialPage);
const sort = ref<'POPULAR' | 'NEWEST' | 'ACTIVITY'>(initialSort);
const showSearch = ref(Boolean(initialSearch));
const searchInputEl = ref<HTMLInputElement | null>(null);
const searchActive = computed(() => Boolean(searchTerm.value));

const { active: activeCategories, refresh: refreshCategories } = useCategories();
const kindForFetch = computed<'FORMAL' | 'QUICK' | 'ALL'>(() => activeCategory.value === 'all' ? 'ALL' : activeCategory.value === 'quick' ? 'QUICK' : 'FORMAL');
const [topicState, featuredState, commentState] = await Promise.all([
  useAsyncData(
    'homepage-topics',
    () => api.get<TopicListResponse>('/topics', {
      page: topicPage.value,
      limit: 9,
      category: kindForFetch.value === 'FORMAL' ? activeCategory.value : undefined,
      search: searchTerm.value || undefined,
      sort: sort.value,
      kind: kindForFetch.value,
    }),
    { default: () => emptyTopicList(9), watch: [activeCategory, searchTerm, sort] },
  ),
  useAsyncData(
    'homepage-featured',
    () => api.get<Topic[]>('/topics/featured'),
    { default: () => [] },
  ),
  useAsyncData(
    'recent-comment-activity',
    () => api.get<CommentActivity[]>('/posts/activity/recent-comments'),
    { default: () => [] },
  ),
]);

const { data, status, error, refresh } = topicState;
const { data: featuredData, refresh: refreshFeatured } = featuredState;
const { data: initialCommentActivities, refresh: refreshComments } = commentState;
const commentActivities = ref<CommentActivity[]>(initialCommentActivities.value);
const { onCommentActivity, cleanup: cleanupRealtime } = useRealtime();

const loadingMore = ref(false);
const visibleTopics = ref<Topic[]>([]);
watch(() => data.value, (list) => {
  if (list) visibleTopics.value = [...list.items];
}, { immediate: true });
const topics = computed(() => visibleTopics.value);
const featuredTopics = computed<Topic[]>(() => featuredData.value ?? []);
const totalPages = computed(() => Math.max(1, data.value.pagination.pages));
const quickCategoryChip = { key: 'quick', label: '快問', eyebrow: 'UGC 微投票', color: '#b0761f', soft: '#fff0d7' };
const filterChips = computed(() => [quickCategoryChip, ...activeCategories.value]);
const selectedCategory = computed(() => activeCategories.value.find((category) => category.key === activeCategory.value));
const sectionHeading = computed(() => activeCategory.value === 'all' ? '全部議題' : activeCategory.value === 'quick' ? '快問' : (selectedCategory.value?.label ?? '議題'));
const hasActiveFilters = computed(() => activeCategory.value !== 'all' || Boolean(searchTerm.value));
const emptyMessage = computed(() => {
  if (searchTerm.value) return `找不到符合「${searchTerm.value}」的議題`;
  if (activeCategory.value === 'quick') return '目前沒有進行中的快問投票';
  return `${sectionHeading.value}目前沒有進行中的議題`;
});
const resultsAnnouncement = computed(() => {
  if (status.value === 'pending') return '議題載入中';
  if (error.value) return '議題載入失敗';
  return `第 ${topicPage.value} 頁，共 ${totalPages.value} 頁，${data.value.pagination.total} 筆議題`;
});
const hasLoaded = ref(status.value === 'success');
const isInitialLoading = computed(() => status.value === 'pending' && !hasLoaded.value);
const fatalError = computed(() => Boolean(error.value) && !hasLoaded.value);
const deadlineNow = useState<number>('topic-deadline-now', () => Date.now());

let searchTimer: ReturnType<typeof setTimeout> | null = null;
let deadlineTimer: ReturnType<typeof setInterval> | null = null;
let syncingFromRoute = false;
let intersectionObserver: IntersectionObserver | null = null;
let observedSentinel: Element | null = null;
const loadMoreSentinel = ref<HTMLElement | null>(null);

watch(searchInput, (value) => {
  if (syncingFromRoute) return;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTimer = null;
    searchTerm.value = value.trim();
    topicPage.value = 1;
  }, 300);
});
watch(status, (nextStatus) => {
  if (nextStatus === 'success') hasLoaded.value = true;
});
watch(searchTerm, (value) => {
  if (value) showSearch.value = true;
});
watch(showSearch, (open) => {
  if (open) nextTick(() => searchInputEl.value?.focus());
});
watch(() => data.value.pagination.pages, (pages) => {
  if (pages === 0 && topicPage.value !== 1) topicPage.value = 1;
  else if (pages > 0 && topicPage.value > pages) topicPage.value = pages;
}, { immediate: true });
watch(activeCategories, (categories) => {
  if (categories.length && activeCategory.value !== 'all' && !categories.some((category) => category.key === activeCategory.value)) {
    activeCategory.value = 'all';
    topicPage.value = 1;
  }
});
watch([activeCategory, searchTerm, topicPage], syncRouteQuery);
watch(() => route.query, (query) => {
  syncingFromRoute = true;
  const category = queryText(query.category) || 'all';
  const search = queryText(query.search);
  const nextSort = ['POPULAR', 'NEWEST', 'ACTIVITY'].includes(queryText(query.sort)) ? queryText(query.sort) : 'ACTIVITY';
  if (activeCategory.value !== category) activeCategory.value = category;
  if (searchTerm.value !== search) searchTerm.value = search;
  if (searchInput.value !== search) searchInput.value = search;
  if (sort.value !== nextSort) sort.value = nextSort as 'POPULAR' | 'NEWEST' | 'ACTIVITY';
  nextTick(() => { syncingFromRoute = false; });
});

onMounted(() => {
  if (route.query.page) {
    const query = { ...route.query };
    delete query.page;
    void router.replace({ query });
  }
  onCommentActivity((activity) => {
    commentActivities.value = [activity, ...commentActivities.value.filter((item) => item.id !== activity.id)].slice(0, 20);
  });
  deadlineTimer = setInterval(() => { deadlineNow.value = Date.now(); }, 60_000);
  intersectionObserver = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (entry?.isIntersecting) loadMore();
  }, { rootMargin: '500px 0px' });
  if (loadMoreSentinel.value) {
    observedSentinel = loadMoreSentinel.value;
    intersectionObserver.observe(observedSentinel);
  }
});
watch(loadMoreSentinel, (el) => {
  if (!import.meta.client || !intersectionObserver) return;
  if (observedSentinel) intersectionObserver.unobserve(observedSentinel);
  observedSentinel = el;
  if (el) intersectionObserver.observe(el);
});
onUnmounted(() => {
  cleanupRealtime();
  intersectionObserver?.disconnect();
  intersectionObserver = null;
  observedSentinel = null;
  if (searchTimer) clearTimeout(searchTimer);
  if (deadlineTimer) clearInterval(deadlineTimer);
});

function emptyTopicList(limit: number): TopicListResponse {
  return { items: [], categoryCounts: {}, pagination: { page: 1, limit, total: 0, pages: 0 } };
}

function queryText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function selectCategory(category: string) {
  if (searchTimer) clearTimeout(searchTimer);
  searchTerm.value = searchInput.value.trim();
  activeCategory.value = category;
  topicPage.value = 1;
}

function selectSort() {
  topicPage.value = 1;
}

function toggleSearch() {
  showSearch.value = !showSearch.value;
}

function clearSearch() {
  searchInput.value = '';
  searchTerm.value = '';
  topicPage.value = 1;
  showSearch.value = false;
}

async function loadMore() {
  if (loadingMore.value) return;
  const pages = data.value.pagination.pages;
  if (topicPage.value >= pages) return;
  loadingMore.value = true;
  try {
    const res = await api.get<TopicListResponse>('/topics', {
      page: topicPage.value + 1,
      limit: 9,
      category: kindForFetch.value === 'FORMAL' ? activeCategory.value : undefined,
      search: searchTerm.value || undefined,
      sort: sort.value,
      kind: kindForFetch.value,
    });
    visibleTopics.value.push(...res.items);
    topicPage.value += 1;
  } catch {
    // 載入失敗時保留現有列表，讓使用者可按鈕重試。
  } finally {
    loadingMore.value = false;
  }
}

function syncRouteQuery() {
  if (!import.meta.client) return;
  const currentCategory = queryText(route.query.category) || 'all';
  const currentSearch = queryText(route.query.search);
  const currentSort = ['POPULAR', 'NEWEST', 'ACTIVITY'].includes(queryText(route.query.sort)) ? queryText(route.query.sort) : 'ACTIVITY';
  if (currentCategory === activeCategory.value && currentSearch === searchTerm.value && currentSort === sort.value) return;
  const query = { ...route.query };
  if (activeCategory.value === 'all') delete query.category;
  else query.category = activeCategory.value;
  if (searchTerm.value) query.search = searchTerm.value;
  else delete query.search;
  delete query.page;
  if (sort.value === 'ACTIVITY') delete query.sort;
  else query.sort = sort.value;
  void router.replace({ query });
}

async function refreshHomepage() {
  await Promise.all([refresh(), refreshFeatured(), refreshComments(), refreshCategories()]);
}

function commentSnippet(content: string) {
  return content.length > 30 ? `${content.slice(0, 30)}…` : content;
}
</script>

<style scoped>
.ticker-track {
  animation: ticker-scroll 96s linear infinite;
}

.ticker:hover .ticker-track,
.ticker:focus-within .ticker-track {
  animation-play-state: paused;
}

@keyframes ticker-scroll {
  to { transform: translateX(-50%); }
}

.search-drop-enter-active,
.search-drop-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.search-drop-enter-from,
.search-drop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .ticker-track { animation: none; }
  .ticker-copy:nth-child(2),
  .ticker-item:not(:first-child) { display: none; }
}
</style>

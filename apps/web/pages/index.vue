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
      <div class="grid min-h-[500px] animate-pulse gap-px bg-[#d7d1c6] motion-reduce:animate-none lg:grid-cols-[minmax(0,1.75fr)_minmax(280px,0.75fr)]">
        <div class="bg-[#252525]" />
        <div class="bg-[#e9e5dc]" />
      </div>
      <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <div v-for="item in 3" :key="item" class="h-72 animate-pulse bg-[#e5e0d6] motion-reduce:animate-none" />
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

<template v-else-if="featured || topics.length || hasActiveFilters">
    <section v-if="featured" class="grid gap-px bg-[#171717] lg:grid-cols-[minmax(0,1.75fr)_minmax(290px,0.75fr)]">
      <HomeFeaturedCarousel :topics="featuredTopics" />
      <div v-if="trending.length" class="hidden lg:block">
        <HomeTrendingList :topics="trending" />
      </div>
    </section>

    <section v-if="quickTopics.length" class="-mx-4 border-y border-[#e0c9a0] bg-[#fff8ec] px-4 py-6 sm:mx-0 sm:px-6" aria-label="今天快問">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="eyebrow text-[#b0761f]">UGC 微投票 · 會員即時發起</p>
          <h2 class="mt-1 text-xl font-black sm:text-2xl">今天快問</h2>
        </div>
        <NuxtLink
          v-if="canCreateQuick"
          to="/topics/quick"
          class="focus-ring border border-[#b0761f] bg-white px-4 py-2.5 text-sm font-black text-[#8f5d14] transition hover:bg-[#b0761f] hover:text-white"
        >＋ 發起快問</NuxtLink>
      </div>
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <NuxtLink
          v-for="t in quickTopics"
          :key="t.id"
          :to="`/topic/${t.id}`"
          class="focus-ring group flex h-full flex-col border border-[#e0c9a0] bg-white p-4 transition hover:-translate-y-1 hover:border-[#b0761f] hover:shadow-[5px_5px_0_#e8d9b8]"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] font-black tracking-[0.12em] text-[#b0761f]">快問</span>
            <span class="text-xs font-bold text-[#77716a]">{{ deadlineLabel(t.voteEndAt, deadlineNow) }}</span>
          </div>
          <h3 class="mt-2 flex-1 text-base font-black leading-snug transition group-hover:text-[#b0761f]">{{ t.title }}</h3>
          <div class="mt-4 space-y-2 border-t border-[#f0e6d2] pt-3">
            <div v-for="o in leadingOptions(t, 2)" :key="o.id" class="flex items-center justify-between gap-2 text-xs">
              <span class="truncate font-medium">{{ o.label }}</span>
              <strong class="shrink-0 tabular-nums text-[#8f5d14]">{{ formatCompactNumber(t.totalVotes) }} 票</strong>
            </div>
          </div>
        </NuxtLink>
      </div>
    </section>

    <section
        ref="resultsSection"
        :id="activeCategory === 'all' ? 'hot-topics' : `category-${activeCategory}`"
        class="scroll-mt-28 py-12 sm:py-16"
        :aria-busy="status === 'pending'"
      >
        <div class="mb-6 flex flex-col gap-4 border-b-2 border-[#171717] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="flex items-baseline gap-3">
            <h2 class="text-2xl font-black tracking-[-0.035em] sm:text-3xl">{{ sectionHeading }}</h2>
            <span class="text-xs font-bold tabular-nums text-[#77716a]">{{ status === 'pending' ? '載入中' : `${data.pagination.total} 筆` }}</span>
          </div>
          <label class="block sm:w-72">
            <span class="sr-only">搜尋議題</span>
            <input
              v-model="searchInput"
              type="search"
              maxlength="100"
              placeholder="搜尋議題標題或描述"
              aria-label="搜尋議題"
              class="focus-ring w-full min-w-0 border border-[#bfb8ad] bg-white px-3.5 py-2 text-sm"
            />
          </label>
        </div>
        <div class="-mx-4 mb-7 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="議題分類">
          <button
            type="button"
            class="focus-ring shrink-0 border px-4 py-2.5 text-sm font-bold transition"
            :class="activeCategory === 'all' ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#cfc8bc] bg-[#faf8f3] hover:border-[#171717]'"
            :aria-pressed="activeCategory === 'all'"
            @click="selectCategory('all')"
          >
            全部 <span class="ml-1 opacity-60">{{ allTopicCount }}</span>
          </button>
          <button
            v-for="category in activeCategories"
            :key="category.key"
            type="button"
            class="focus-ring shrink-0 border px-4 py-2.5 text-sm font-bold transition"
            :style="activeCategory === category.key
              ? { borderColor: category.color, backgroundColor: category.color, color: contrastTextColor(category.color) }
              : { borderColor: '#cfc8bc', backgroundColor: '#faf8f3' }"
            :aria-pressed="activeCategory === category.key"
            @click="selectCategory(category.key)"
          >
            <span v-if="activeCategory !== category.key" class="mr-2 inline-block h-2 w-2 rounded-full" :style="{ backgroundColor: category.color }" />
            {{ category.label }} <span class="ml-1 opacity-60">{{ categoryCounts[category.key] ?? 0 }}</span>
          </button>
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
          <HomeTopicCard v-for="topic in topics" :key="topic.id" :topic="topic" />
        </div>
        <p v-else class="border border-[#d7d1c6] bg-[#faf8f3] py-16 text-center text-sm text-[#77716a]">{{ emptyMessage }}</p>
        <nav v-if="status === 'success' && totalPages > 1" class="mt-10 flex items-center justify-center gap-2" aria-label="議題分頁">
          <button
            type="button"
            class="focus-ring border border-[#171717] px-3.5 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-30"
            :disabled="topicPage <= 1"
            aria-label="上一頁"
            @click="changePage(topicPage - 1)"
          >&larr; 上一頁</button>
          <template v-for="item in paginationItems" :key="item">
            <span v-if="typeof item !== 'number'" class="grid min-w-6 place-items-center text-[#77716a]" aria-hidden="true">&hellip;</span>
            <button
              v-else
              type="button"
              class="focus-ring min-w-10 border px-3 py-2 text-sm font-bold"
              :class="item === topicPage ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#cfc8bc] bg-white hover:bg-[#ebe6dc]'"
              :aria-label="`第 ${item} 頁`"
              :aria-current="item === topicPage ? 'page' : undefined"
              @click="changePage(item)"
            >{{ item }}</button>
          </template>
          <button
            type="button"
            class="focus-ring border border-[#171717] px-3.5 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-30"
            :disabled="topicPage >= totalPages"
            aria-label="下一頁"
            @click="changePage(topicPage + 1)"
          >下一頁 &rarr;</button>
        </nav>
      </section>

      <section v-if="trending.length" class="lg:hidden" aria-label="熱門議題排行">
        <HomeTrendingList :topics="trending.slice(0, 3)" />
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
import { contrastTextColor, deadlineLabel, formatCompactNumber, leadingOptions } from '~/utils/topic';

useSeoMeta({
  title: '輿論測風向｜看見真實民意',
  description: '瀏覽台灣公共議題的即時民調，透過手機門號驗證確保一人一票。',
});

const api = useApi();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const initialCategory = queryText(route.query.category) || 'all';
const initialSearch = queryText(route.query.search);
const initialPage = queryPage(route.query.page);
const activeCategory = ref(initialCategory);
const searchInput = ref(initialSearch);
const searchTerm = ref(initialSearch);
const topicPage = ref(initialPage);
const resultsSection = ref<HTMLElement | null>(null);

const { active: activeCategories, refresh: refreshCategories } = useCategories();
const [topicState, featuredState, trendingState, commentState, quickState] = await Promise.all([
  useAsyncData(
    'homepage-topics',
    () => api.get<TopicListResponse>('/topics', {
      page: topicPage.value,
      limit: 9,
      category: activeCategory.value === 'all' ? undefined : activeCategory.value,
      search: searchTerm.value || undefined,
      sort: 'POPULAR',
    }),
    { default: () => emptyTopicList(9), watch: [topicPage, activeCategory, searchTerm] },
  ),
  useAsyncData(
    'homepage-featured',
    () => api.get<Topic[]>('/topics/featured'),
    { default: () => [] },
  ),
  useAsyncData(
    'homepage-trending',
    () => api.get<TopicListResponse>('/topics', { limit: 8, sort: 'POPULAR' }),
    { default: () => emptyTopicList(8) },
  ),
  useAsyncData(
    'recent-comment-activity',
    () => api.get<CommentActivity[]>('/posts/activity/recent-comments'),
    { default: () => [] },
  ),
  useAsyncData(
    'homepage-quick',
    () => api.get<Topic[]>('/topics/quick'),
    { default: () => [] },
  ),
]);

const { data, status, error, refresh } = topicState;
const { data: featuredData, refresh: refreshFeatured } = featuredState;
const { data: trendingData, refresh: refreshTrending } = trendingState;
const { data: quickTopics, refresh: refreshQuick } = quickState;
const { data: initialCommentActivities, refresh: refreshComments } = commentState;
const commentActivities = ref<CommentActivity[]>(initialCommentActivities.value);
const { onCommentActivity, cleanup: cleanupRealtime } = useRealtime();

const topics = computed(() => data.value.items);
const featuredTopics = computed<Topic[]>(() => {
  const list = featuredData.value ?? [];
  if (list.length) return list;
  return trendingData.value.items[0] ? [trendingData.value.items[0]] : [];
});
const featuredIds = computed(() => new Set(featuredTopics.value.map((topic) => topic.id)));
const featured = computed<Topic | null>(() => featuredTopics.value[0] ?? null);
const trending = computed(() => trendingData.value.items.filter((topic) => !featuredIds.value.has(topic.id)).slice(0, 4));
const categoryCounts = computed(() => data.value.categoryCounts ?? {});
const allTopicCount = computed(() => Object.values(categoryCounts.value).reduce((sum, count) => sum + count, 0));
const canCreateQuick = computed(() => auth.isAuthed && (auth.canAuthorTopics || auth.capabilitySummary?.membershipTier === 'SENIOR'));
const totalPages = computed(() => Math.max(1, data.value.pagination.pages));
const paginationItems = computed<Array<number | string>>(() => {
  if (totalPages.value <= 7) return Array.from({ length: totalPages.value }, (_, index) => index + 1);
  const pages = [...new Set([1, totalPages.value, topicPage.value - 1, topicPage.value, topicPage.value + 1])]
    .filter((page) => page >= 1 && page <= totalPages.value)
    .sort((a, b) => a - b);
  const items: Array<number | string> = [];
  for (const page of pages) {
    const previous = items.at(-1);
    if (typeof previous === 'number' && page - previous > 1) items.push(`gap-${previous}`);
    items.push(page);
  }
  return items;
});
const selectedCategory = computed(() => activeCategories.value.find((category) => category.key === activeCategory.value));
const sectionHeading = computed(() => activeCategory.value === 'all' ? '全部議題' : (selectedCategory.value?.label ?? '議題'));
const hasActiveFilters = computed(() => activeCategory.value !== 'all' || Boolean(searchTerm.value));
const emptyMessage = computed(() => searchTerm.value
  ? `找不到符合「${searchTerm.value}」的議題`
  : `${sectionHeading.value}目前沒有進行中的議題`);
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
  const page = queryPage(query.page);
  if (activeCategory.value !== category) activeCategory.value = category;
  if (searchTerm.value !== search) searchTerm.value = search;
  if (searchInput.value !== search) searchInput.value = search;
  if (topicPage.value !== page) topicPage.value = page;
  nextTick(() => { syncingFromRoute = false; });
});

onMounted(() => {
  onCommentActivity((activity) => {
    commentActivities.value = [activity, ...commentActivities.value.filter((item) => item.id !== activity.id)].slice(0, 20);
  });
  deadlineTimer = setInterval(() => { deadlineNow.value = Date.now(); }, 60_000);
});
onUnmounted(() => {
  cleanupRealtime();
  if (searchTimer) clearTimeout(searchTimer);
  if (deadlineTimer) clearInterval(deadlineTimer);
});

function emptyTopicList(limit: number): TopicListResponse {
  return { items: [], categoryCounts: {}, pagination: { page: 1, limit, total: 0, pages: 0 } };
}

function queryText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function queryPage(value: unknown) {
  const page = Number(queryText(value));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function selectCategory(category: string) {
  if (searchTimer) clearTimeout(searchTimer);
  searchTerm.value = searchInput.value.trim();
  activeCategory.value = category;
  topicPage.value = 1;
}

function changePage(page: number) {
  if (page < 1 || page > totalPages.value || page === topicPage.value) return;
  topicPage.value = page;
  nextTick(() => resultsSection.value?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  }));
}

function syncRouteQuery() {
  if (!import.meta.client) return;
  const currentCategory = queryText(route.query.category) || 'all';
  const currentSearch = queryText(route.query.search);
  const currentPage = queryPage(route.query.page);
  if (currentCategory === activeCategory.value && currentSearch === searchTerm.value && currentPage === topicPage.value) return;
  const query = { ...route.query };
  if (activeCategory.value === 'all') delete query.category;
  else query.category = activeCategory.value;
  if (searchTerm.value) query.search = searchTerm.value;
  else delete query.search;
  if (topicPage.value === 1) delete query.page;
  else query.page = String(topicPage.value);
  void router.replace({ query });
}

async function refreshHomepage() {
  await Promise.all([refresh(), refreshFeatured(), refreshTrending(), refreshComments(), refreshCategories(), refreshQuick()]);
}

function commentSnippet(content: string) {
  return content.length > 30 ? `${content.slice(0, 30)}…` : content;
}
</script>

<style scoped>
.ticker-track {
  animation: ticker-scroll 48s linear infinite;
}

.ticker:hover .ticker-track,
.ticker:focus-within .ticker-track {
  animation-play-state: paused;
}

@keyframes ticker-scroll {
  to { transform: translateX(-50%); }
}

@media (prefers-reduced-motion: reduce) {
  .ticker-track { animation: none; }
  .ticker-copy:nth-child(2),
  .ticker-item:not(:first-child) { display: none; }
}
</style>

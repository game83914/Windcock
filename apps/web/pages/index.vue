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
        <div class="mb-6 flex items-center justify-between gap-3 border-b border-[#171717] pb-4">
          <div class="flex min-w-0 flex-wrap items-center gap-1">
            <h2 class="truncate text-xl font-black tracking-[-0.035em] sm:text-2xl">{{ sectionHeading }}</h2>
            <UiTopicFilterDropdown
              v-model:category="activeCategory"
              v-model:sort="sort"
              :categories="filterChips"
              :participation="effectiveParticipation"
              v-model:status="topicStatus"
              :is-authed="auth.isAuthed"
              @update:category="selectCategory"
              @update:sort="selectSort"
              @update:participation="onUnvotedChange"
              @update:status="selectStatus"
            />
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
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const initialCategory = queryText(route.query.category) || 'all';
const initialPage = 1;
const initialSort = (['POPULAR', 'NEWEST', 'ACTIVITY'] as const).includes(queryText(route.query.sort) as 'POPULAR' | 'NEWEST' | 'ACTIVITY')
  ? (queryText(route.query.sort) as 'POPULAR' | 'NEWEST' | 'ACTIVITY')
  : 'ACTIVITY';
const activeCategory = ref(initialCategory);
const topicPage = ref(initialPage);
const sort = ref<'POPULAR' | 'NEWEST' | 'ACTIVITY'>(initialSort);
const unvoted = ref<'ALL' | 'UNVOTED'>('ALL');
const topicStatus = ref<'ACTIVE' | 'ENDED' | 'ALL'>('ACTIVE');
const effectiveParticipation = computed<'ALL' | 'UNVOTED'>(() => auth.isAuthed ? unvoted.value : 'ALL');

const { active: activeCategories, refresh: refreshCategories } = useCategories();
const kindForFetch = computed<'FORMAL' | 'QUICK' | 'SURVEY' | 'STAGED' | 'ALL'>(() => activeCategory.value === 'all' ? 'ALL' : activeCategory.value === 'quick' ? 'QUICK' : activeCategory.value === 'survey' ? 'SURVEY' : activeCategory.value === 'staged' ? 'STAGED' : 'FORMAL');
const [topicState, featuredState, commentState] = await Promise.all([
  useAsyncData(
    'homepage-topics',
    () => api.get<TopicListResponse>('/topics', {
      page: topicPage.value,
      limit: 9,
      category: kindForFetch.value === 'FORMAL' ? activeCategory.value : undefined,
      sort: sort.value,
      kind: kindForFetch.value,
      participation: effectiveParticipation.value === 'UNVOTED' ? 'UNVOTED' : undefined,
      status: topicStatus.value,
    }),
    { default: () => emptyTopicList(9), watch: [activeCategory, sort, effectiveParticipation, topicStatus] },
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

const nuxtApp = useNuxtApp();
if (import.meta.client && auth.isAuthed && nuxtApp.isHydrating) {
  nuxtApp.hooks.hookOnce('app:suspense:resolve', () => void refresh());
}

const loadingMore = ref(false);
const visibleTopics = ref<Topic[]>([]);
watch(() => data.value, (list) => {
  if (list) visibleTopics.value = [...list.items];
}, { immediate: true });
const topics = computed(() => visibleTopics.value);
const featuredTopics = computed<Topic[]>(() => featuredData.value ?? []);
const totalPages = computed(() => Math.max(1, data.value.pagination.pages));
const quickCategoryChip = { key: 'quick', label: '快問', eyebrow: 'UGC 微投票', color: '#b0761f', soft: '#fff0d7' };
const surveyCategoryChip = { key: 'survey', label: '問卷', eyebrow: '多題組合', color: '#b0761f', soft: '#fff0d7' };
const stagedCategoryChip = { key: 'staged', label: '回合', eyebrow: '回合制快問', color: '#b0761f', soft: '#fff0d7' };
const filterChips = computed(() => [stagedCategoryChip, surveyCategoryChip, quickCategoryChip, ...activeCategories.value.filter((category) => category.key !== 'quick')]);
const selectedCategory = computed(() => activeCategories.value.find((category) => category.key === activeCategory.value));
const sectionHeading = computed(() => activeCategory.value === 'all' ? '全部議題' : activeCategory.value === 'quick' ? '快問' : activeCategory.value === 'survey' ? '問卷' : activeCategory.value === 'staged' ? '回合' : (selectedCategory.value?.label ?? '議題'));
const hasActiveFilters = computed(() => activeCategory.value !== 'all' || effectiveParticipation.value === 'UNVOTED' || topicStatus.value !== 'ACTIVE');
const emptyMessage = computed(() => {
  if (topicStatus.value === 'ENDED') {
    const scope = activeCategory.value === 'all' ? '議題' : sectionHeading.value;
    return `目前沒有已截止的${scope}，試試切換狀態或稍後再來`;
  }
    if (effectiveParticipation.value === 'UNVOTED') {
    const base = activeCategory.value === 'quick' ? '目前沒有新的未投票快問' : activeCategory.value === 'survey' ? '目前沒有新的未投票問卷' : activeCategory.value === 'staged' ? '目前沒有新的未投票回合' : '目前沒有新的未投票議題';
    return `${base}，試試切換到「全部」或稍後再來`;
  }
  if (activeCategory.value === 'quick') return '目前沒有進行中的快問投票';
  if (activeCategory.value === 'survey') return '目前沒有進行中的問卷';
  if (activeCategory.value === 'staged') return '目前沒有進行中的回合制';
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
const deadlineNow = useDeadlineNow({ tick: true });

let syncingFromRoute = false;
let intersectionObserver: IntersectionObserver | null = null;
let observedSentinel: Element | null = null;
const loadMoreSentinel = ref<HTMLElement | null>(null);

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
watch([activeCategory, topicPage, unvoted, topicStatus], syncRouteQuery);
watch(() => route.query, (query) => {
  syncingFromRoute = true;
  const category = queryText(query.category) || 'all';
  const nextSort = ['POPULAR', 'NEWEST', 'ACTIVITY'].includes(queryText(query.sort)) ? queryText(query.sort) : 'ACTIVITY';
  const nextUnvoted = queryText(query.participation) === 'unvoted' ? 'UNVOTED' : 'ALL';
  const statusText = queryText(query.status);
  const nextStatus = statusText === 'ended' ? 'ENDED' : statusText === 'all' ? 'ALL' : 'ACTIVE';
  if (activeCategory.value !== category) activeCategory.value = category;
  if (sort.value !== nextSort) sort.value = nextSort as 'POPULAR' | 'NEWEST' | 'ACTIVITY';
  if (unvoted.value !== nextUnvoted) unvoted.value = nextUnvoted;
  if (topicStatus.value !== nextStatus) topicStatus.value = nextStatus;
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
});

function emptyTopicList(limit: number): TopicListResponse {
  return { items: [], categoryCounts: {}, pagination: { page: 1, limit, total: 0, pages: 0 } };
}

function queryText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function selectCategory(category: string) {
  activeCategory.value = category;
  topicPage.value = 1;
}

function selectSort() {
  topicPage.value = 1;
}

function onUnvotedChange(value: 'ALL' | 'UNVOTED') {
  unvoted.value = value;
  topicPage.value = 1;
}

function selectStatus(value: 'ACTIVE' | 'ENDED' | 'ALL') {
  topicStatus.value = value;
  topicPage.value = 1;
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
      sort: sort.value,
      kind: kindForFetch.value,
      participation: effectiveParticipation.value === 'UNVOTED' ? 'UNVOTED' : undefined,
      status: topicStatus.value,
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
  const currentSort = ['POPULAR', 'NEWEST', 'ACTIVITY'].includes(queryText(route.query.sort)) ? queryText(route.query.sort) : 'ACTIVITY';
  const currentUnvoted = queryText(route.query.participation) === 'unvoted' ? 'UNVOTED' : 'ALL';
  const statusText = queryText(route.query.status);
  const currentStatus = statusText === 'ended' ? 'ENDED' : statusText === 'all' ? 'ALL' : 'ACTIVE';
  if (currentCategory === activeCategory.value && currentSort === sort.value && currentUnvoted === unvoted.value && currentStatus === topicStatus.value) return;
  const query = { ...route.query };
  if (activeCategory.value === 'all') delete query.category;
  else query.category = activeCategory.value;
  delete query.page;
  if (sort.value === 'ACTIVITY') delete query.sort;
  else query.sort = sort.value;
  if (unvoted.value === 'UNVOTED') query.participation = 'unvoted';
  else delete query.participation;
  if (topicStatus.value === 'ENDED') query.status = 'ended';
  else if (topicStatus.value === 'ALL') query.status = 'all';
  else delete query.status;
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

@media (prefers-reduced-motion: reduce) {
  .ticker-track { animation: none; }
  .ticker-copy:nth-child(2),
  .ticker-item:not(:first-child) { display: none; }
}
</style>

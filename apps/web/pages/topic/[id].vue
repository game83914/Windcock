<template>
  <div v-if="loading" class="mx-auto max-w-3xl">
    <div class="h-64 animate-pulse bg-[#e5e0d6]" />
  </div>
  <div v-else-if="pageError" class="mx-auto max-w-3xl border-l-4 border-[#d84a36] bg-[#fbe9e5] p-5">
    <p class="font-black text-[#a63222]">議題載入失敗</p>
    <p class="mt-2 text-sm">{{ pageError }}</p>
    <button type="button" class="focus-ring mt-4 bg-[#171717] px-4 py-2 text-sm font-black text-white" @click="load">重新載入</button>
  </div>
  <div v-else-if="topic" class="mx-auto max-w-6xl space-y-6">
    <div class="max-w-3xl">
      <button type="button" class="focus-ring text-sm font-bold text-[#6d6861] hover:text-[#d84a36]" @click="goBack">&larr; 返回</button>
      <div class="mt-4 flex flex-wrap items-center gap-2">
        <span v-if="topic.kind !== 'QUICK'" class="border border-[#171717] px-2 py-1 text-xs font-bold">{{ getCategoryMeta(topic.category).label }}</span>
        <span v-if="topic.kind === 'QUICK'" class="bg-[#b0761f] px-2 py-1 text-xs font-black text-white">快問</span>
        <span class="bg-[#171717] px-2 py-1 text-xs font-black text-white">議題小組發布</span>
        <span v-if="topic.proposedBy?.length" class="text-xs text-[#6d6861]">提案參與者：{{ topic.proposedBy.map((person) => person.label).join('、') }}</span>
        <span v-if="topic.moderationStatus === 'PENDING_REVIEW'" class="bg-[#fff0d7] px-2 py-1 text-xs font-bold text-[#9a5b12]">待平台複核</span>
        <span v-if="topic.hasVoted" class="bg-[#e5f1e9] px-2 py-1 text-xs font-bold text-[#3f7a58]">已投票</span>
        <span v-if="topic.status === 'LOCKED'" class="bg-[#ebe6dc] px-2 py-1 text-xs font-bold text-[#6d6861]">歷史版本</span>
      </div>
      <h1 class="mt-4 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-4xl">{{ topic.title }}</h1>
      <p v-if="topic.description" class="mt-3 text-sm leading-6 text-[#5f5a53]">{{ topic.description }}</p>
      <p class="mt-3 text-sm font-bold text-[#77716a]">{{ totalVotes }} 票 · {{ topic.voteEndAt ? `截止 ${formatTime(topic.voteEndAt)}` : '尚未開放投票' }}</p>
    </div>

    <nav v-if="sections.length > 1" class="sticky top-16 z-20 -mx-4 flex gap-1 overflow-x-auto border-y border-[#171717] bg-[#f4f1ea]/95 px-4 py-2 backdrop-blur sm:mx-0" aria-label="議題內容分區">
      <button
        v-for="item in sections"
        :key="item.value"
        type="button"
        class="focus-ring min-h-11 shrink-0 px-4 text-sm font-black"
        :class="activeSection === item.value ? 'bg-[#171717] text-white' : 'bg-[#ebe6dc] text-[#5f5a53] hover:bg-[#d7d1c6]'"
        :aria-current="activeSection === item.value ? 'page' : undefined"
        @click="setSection(item.value)"
      >
        {{ item.label }}<span v-if="item.count !== null" class="ml-1 opacity-70">{{ item.count }}</span>
      </button>
    </nav>

    <section v-show="activeSection === 'vote'" class="max-w-3xl overflow-hidden rounded-2xl border border-[#ded7cb] bg-[#faf8f3] shadow-[0_8px_28px_rgba(23,23,23,0.08)]">
      <header class="border-b border-[#ded7cb] px-5 py-4 sm:px-6">
        <p class="eyebrow-modern text-[#d84a36]">{{ showResults ? '投票結果' : '你的選擇' }}</p>
        <h2 class="mt-1 text-xl font-black">{{ showResults ? '目前風向' : '請選擇你的立場' }}</h2>
      </header>

      <div class="p-5 sm:p-6">
        <QuickVotePanel v-if="isQuick" :topic="topic" @refreshed="load" />

        <template v-else>
          <div v-if="!showResults && isVotingOpen && !participationReady" class="h-24 animate-pulse rounded-xl bg-[#eee9e0]" />
          <div v-else-if="!showResults && isVotingOpen && auth.isAuthed && !auth.canVote" class="rounded-xl border border-[#e6cf9e] bg-[#fff8ec] p-4 text-sm font-bold text-[#8f5d14]">{{ VOTE_IDENTITY_NOTICE }}</div>

          <template v-else-if="!showResults && isVotingOpen && topic.topicType === 'SPECTRUM'">
            <div class="flex items-end justify-between">
              <span class="text-sm font-bold text-[#6d6861]">目前選擇</span>
              <strong class="text-4xl font-black tabular-nums text-[#3157d5]">{{ spectrumValue }}<small class="ml-1 text-sm text-[#77716a]">/ 100</small></strong>
            </div>
            <input v-model.number="spectrumValue" type="range" min="0" max="100" class="spec-range focus-ring mt-5 w-full accent-[#3157d5]" :class="{ 'cursor-not-allowed opacity-60': isInteractionLocked }" :disabled="isInteractionLocked" />
            <div class="mt-2 flex justify-between text-xs font-bold text-[#77716a]"><span>0</span><span>50</span><span>100</span></div>
            <UiButton v-if="!isInteractionLocked" variant="data" block class="mt-6" :disabled="voting || confirmingSpectrum" @click="confirmingSpectrum = true">
              確認送出 {{ spectrumValue }} 分
            </UiButton>
          </template>

          <template v-else-if="!showResults && isVotingOpen">
            <div class="space-y-2.5">
              <button
                v-for="o in visibleOptions"
                :key="o.id"
                type="button"
                class="focus-ring flex min-h-12 w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left font-bold transition"
                :class="[selectedOptionId === o.id ? 'border-[#3157d5] bg-[#e7ecff] text-[#3157d5]' : 'border-[#ded7cb] bg-white', isInteractionLocked ? 'cursor-not-allowed opacity-60 hover:border-[#ded7cb]' : 'hover:border-[#171717]']"
                :disabled="voting || isInteractionLocked"
                @click="onOptionTap(o.id)"
              >
                <span class="flex items-center gap-3">
                  <img v-if="o.data?.imageUrl" :src="o.data.imageUrl" alt="選項圖片" class="h-9 w-9 shrink-0 rounded-lg border border-[#ded7cb] object-cover" />
                  <span>{{ o.label }}</span>
                </span>
                <span class="flex items-center gap-2">
                  <span v-if="voting && votingTargetId === o.id" class="size-4 animate-spin rounded-full border-2 border-[#3157d5] border-t-transparent" aria-hidden="true" />
                  <span v-else aria-hidden="true">{{ selectedOptionId === o.id ? '✓' : '○' }}</span>
                </span>
              </button>
            </div>
            <button v-if="optionsCollapsed" type="button" class="focus-ring mt-3 w-full rounded-xl border border-[#e0c9a0] bg-[#fffaf0] px-3 py-2 text-xs font-bold text-[#8f5d14] transition hover:border-[#b0761f]" @click="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${topic.options.length}）` }}</button>

            <div v-if="confirmingOptionId" class="mt-4 flex flex-col gap-3 rounded-xl border-2 border-[#3157d5] bg-[#e7ecff] p-4 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-sm font-bold text-[#2746b4]">確定送出「{{ selectedOption?.label }}」？送出後無法修改。</p>
              <div class="flex shrink-0 gap-2">
                <UiButton variant="outline" size="sm" :disabled="voting" @click="resetVoteIntents">重選</UiButton>
                <UiButton variant="data" size="sm" :disabled="voting" @click="submitVote">{{ voting ? '送出中…' : '確定送出' }}</UiButton>
              </div>
            </div>
            <div v-if="confirmingSpectrum" class="mt-4 flex flex-col gap-3 rounded-xl border-2 border-[#3157d5] bg-[#e7ecff] p-4 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-sm font-bold text-[#2746b4]">確定送出 {{ spectrumValue }} 分？送出後無法修改。</p>
              <div class="flex shrink-0 gap-2">
                <UiButton variant="outline" size="sm" :disabled="voting" @click="confirmingSpectrum = false">重選</UiButton>
                <UiButton variant="data" size="sm" :disabled="voting" @click="submitVote">{{ voting ? '送出中…' : '確定送出' }}</UiButton>
              </div>
            </div>
          </template>

          <template v-else>
            <template v-if="topic.topicType === 'SHORT_ANSWER'">
              <p class="mb-3 text-sm font-bold text-[#6d6861]">共 {{ topic.responses?.length ?? 0 }} 則回答，以下公開顯示：</p>
              <div class="max-h-80 space-y-2.5 overflow-y-auto pr-1">
                <ul v-if="topic.responses?.length" class="space-y-2.5">
                  <li v-for="(response, index) in topic.responses" :key="index" class="rounded-xl border border-[#ded7cb] bg-white p-4">
                    <p class="whitespace-pre-wrap text-sm leading-6">{{ response.answerText }}</p>
                    <p class="mt-2 text-xs text-[#8b857d]">{{ response.nickname }} · {{ formatTime(response.createdAt) }}</p>
                  </li>
                </ul>
                <p v-else class="text-sm text-[#8b857d]">還沒有公開回答。</p>
              </div>
            </template>
            <template v-else-if="topic.topicType === 'SPECTRUM'">
              <div class="flex items-end justify-between gap-4">
                <span class="text-sm font-bold text-[#6d6861]">社群中位數</span>
                <strong class="text-4xl font-black tabular-nums text-[#3157d5]">{{ Math.round(Number(topic.spectrumMedian || 0)) }}<small class="ml-1 text-sm text-[#77716a]">/ 100</small></strong>
              </div>
              <div class="relative mt-5 h-3 rounded-full bg-[#dfdad0]"><div class="h-full rounded-full bg-[#3157d5]" :style="{ width: `${Number(topic.spectrumMedian || 0)}%` }" /></div>
              <p v-if="topic.myVote" class="mt-4 rounded-xl border-l-4 border-[#3f7a58] bg-[#e5f1e9] p-3 text-sm font-bold">你的選擇：{{ topic.myVote.choice }}</p>
            </template>
            <template v-else>
              <div class="space-y-5">
                <div v-for="o in visibleOptions" :key="o.id">
                  <div class="mb-2 flex items-center justify-between gap-4 text-sm"><span class="flex items-center gap-2 font-bold"><img v-if="o.data?.imageUrl" :src="o.data.imageUrl" alt="選項圖片" class="h-6 w-6 shrink-0 rounded-md border border-[#ded7cb] object-cover" />{{ o.label }}</span><span class="shrink-0 font-black tabular-nums">{{ optionPercentage(o, topic) }}% · {{ o.voteCount }} 票</span></div>
                  <div class="h-2 rounded-full bg-[#dfdad0]"><div class="h-full rounded-full bg-[#3157d5] transition-[width] duration-500" :style="{ width: `${optionPercentage(o, topic)}%` }" /></div>
                </div>
              </div>
              <p v-if="topic.myVote" class="mt-5 rounded-xl border-l-4 border-[#3f7a58] bg-[#e5f1e9] p-3 text-sm font-bold">你的選擇：{{ topic.myVote.choice }}</p>
              <button v-if="optionsCollapsed" type="button" class="focus-ring mt-4 w-full rounded-xl border border-[#e0c9a0] bg-[#fffaf0] px-3 py-2 text-xs font-bold text-[#8f5d14] transition hover:border-[#b0761f]" @click="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${topic.options.length}）` }}</button>
            </template>
          </template>
        </template>

        <p v-if="!isQuick && !showResults && isVotingOpen" class="mt-4 border-t border-[#ded7cb] pt-4 text-xs leading-5 text-[#77716a]">送出後無法修改。投票後可立即查看即時風向。</p>
      </div>
    </section>

    <section v-if="activeSection === 'context' && topic.blocks.length" class="max-w-3xl border-y-2 border-[#171717] bg-[#faf8f3]">
      <header class="flex flex-col gap-2 border-b border-[#d7d1c6] px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p class="eyebrow text-[#3157d5]">補充內容</p><h2 class="mt-1 text-xl font-black">了解議題脈絡</h2></div>
      </header>
      <div class="divide-y divide-[#d7d1c6]">
        <details v-for="(item, index) in topic.blocks" :key="item.id" :open="index < 2" class="group">
          <summary class="focus-ring flex cursor-pointer list-none items-start gap-4 px-5 py-4 marker:hidden">
            <span class="shrink-0 text-xl font-black text-[#c8c1b6]">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="min-w-0 flex-1"><small class="block text-[10px] font-black tracking-[0.14em] text-[#77716a]">{{ blockLabel(item.type) }}</small><strong class="mt-1 block leading-snug">{{ item.title }}</strong><small v-if="item.sourceLabel" class="mt-1 block text-[#77716a]">{{ item.sourceLabel }}</small></span>
            <span class="mt-2 text-lg font-black text-[#3157d5] group-open:rotate-45" aria-hidden="true">＋</span>
          </summary>
          <article class="px-5 pb-5 pl-[4.25rem]">
            <time v-if="item.occurredAt" class="text-xs text-[#77716a]">{{ formatCaseDate(item.occurredAt) }}</time>
            <p v-if="item.content" class="whitespace-pre-line text-sm leading-6 text-[#5f5a53]">{{ item.content }}</p>
            <a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener noreferrer" class="focus-ring mt-3 inline-block text-xs font-bold text-[#3157d5]">查看來源：{{ item.sourceLabel || '原始資料' }} &nearr;</a>
          </article>
        </details>
      </div>
    </section>

    <template v-if="activeSection === 'stances'">
    <StanceTree
      v-if="topicId"
      :topic-id="topicId"
      :topic-title="topic?.title || ''"
      :authed="auth.isAuthed"
      :open="isVotingOpen"
      :selected="selectedStance"
      :tab="selectedStanceTab"
      @select="selectStance"
      @tab="selectDetailTab"
    />
    </template>

    <StanceStatistics v-if="activeSection === 'statistics' && topicId" :topic-id="topicId" />

  </div>
</template>

<script setup lang="ts">
import type { Topic } from '~/types/topic';
import { getCategoryMeta, optionPercentage } from '~/utils/topic';
import { OPTION_COLLAPSE_LIMIT, VOTE_IDENTITY_NOTICE } from '~/utils/topic';

const route = useRoute();
const router = useRouter();
const api = useApi();
const auth = useAuthStore();
const { success: toastSuccess, error: toastError } = useToast();
const topicId = computed(() => route.params.id as string);
const loginUrl = computed(() => `/login?redirect=${encodeURIComponent(route.fullPath)}`);

const topic = ref<Topic | null>(null);
const loading = ref(true);
const pageError = ref('');
type TopicSection = 'vote' | 'context' | 'stances' | 'statistics';
const validSections: TopicSection[] = ['vote', 'context', 'stances', 'statistics'];
const initialSection = validSections.includes(route.query.section as TopicSection) ? route.query.section as TopicSection : 'vote';
const activeSection = ref<TopicSection>(initialSection);
const selectedStance = ref<string | null>(typeof route.query.stance === 'string' ? route.query.stance : null);
const selectedStanceTab = computed(() => route.query.tab === 'discussion' ? 'DISCUSSION' as const : 'DETAIL' as const);
const isVotingOpen = computed(() => topic.value?.status === 'OPEN' && !!topic.value.voteEndAt && new Date(topic.value.voteEndAt).getTime() > Date.now());
const participationReady = computed(() => !auth.isAuthed || Boolean(auth.capabilitySummary?.participation));
const showResults = computed(() => !!topic.value && (topic.value.hasVoted || !isVotingOpen.value || (auth.isAuthed && participationReady.value && !auth.canVote)));
const totalVotes = ref('0');
const voting = ref(false);
const votingTargetId = ref<string | null>(null);
const spectrumValue = ref(50);
const selectedOptionId = ref<string | null>(null);
const selectedOption = computed(() => topic.value?.options.find((option) => option.id === selectedOptionId.value) ?? null);
const confirmingOptionId = ref<string | null>(null);
const confirmingSpectrum = ref(false);
const isQuick = computed(() => topic.value?.kind === 'QUICK');
const isInteractionLocked = computed(() => !auth.isAuthed);

const showAllOptions = ref(false);
const optionsCollapsed = computed(() => !showAllOptions.value && (topic.value?.options.length ?? 0) > OPTION_COLLAPSE_LIMIT);
const visibleOptions = computed(() => (optionsCollapsed.value ? topic.value?.options.slice(0, OPTION_COLLAPSE_LIMIT) : topic.value?.options) ?? []);
function toggleOptions() {
  showAllOptions.value = !showAllOptions.value;
}

const sections = computed<Array<{ value: TopicSection; label: string; count: number | null }>>(() => {
  if (isQuick.value) return [{ value: 'vote', label: '即時結果', count: null }];
  return [
    { value: 'vote', label: showResults.value ? '投票結果' : '我的選擇', count: null },
    ...((topic.value?.blocks.length ?? 0) ? [{ value: 'context' as const, label: '議題脈絡', count: topic.value!.blocks.length }] : []),
    { value: 'stances', label: '立場探索', count: null },
    ...(auth.canViewAnalytics ? [{ value: 'statistics' as const, label: '統計數據', count: null }] : []),
  ];
});

const { joinTopic, leaveTopic, onVoteUpdate, cleanup: cleanupRealtime } = useRealtime();
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCaseDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function setSection(section: TopicSection) {
  activeSection.value = section;
  await router.replace({ query: { ...route.query, section, stance: section === 'stances' ? selectedStance.value || undefined : undefined, tab: section === 'stances' ? route.query.tab : undefined } });
}

async function selectStance(stanceId: string | null) {
  selectedStance.value = stanceId;
  await router.replace({ query: { ...route.query, section: 'stances', stance: stanceId || undefined, tab: undefined } });
}

async function selectDetailTab(tab: 'DETAIL' | 'DISCUSSION') {
  await router.replace({ query: { ...route.query, section: 'stances', stance: selectedStance.value || undefined, tab: tab === 'DISCUSSION' ? 'discussion' : undefined } });
}

function blockLabel(type: Topic['blocks'][number]['type']) {
  return {
    BACKGROUND: '背景說明',
    CASE: '具體案例',
    DATA: '數據資料',
    SOURCE: '來源連結',
    PERSPECTIVES: '多方觀點',
  }[type];
}

function goBack() {
  if (!import.meta.client || router.options.history.state?.back) {
    router.back();
    return;
  }
  void navigateTo('/');
}

function applyUpdate(data: any) {
  if (data?.topicId !== topicId.value) return;
  if (data.totalVotes) totalVotes.value = data.totalVotes;
  // Refresh authoritative counts from the server after a realtime tick.
  if (refreshTimer) clearTimeout(refreshTimer);
  const expectedId = topicId.value;
  refreshTimer = setTimeout(async () => {
    try {
      const fresh = await api.get<Topic>(`/topics/${expectedId}`);
      if (topicId.value !== expectedId) return;
      topic.value = fresh;
      totalVotes.value = fresh.totalVotes;
    } catch {
      // The next successful realtime tick or manual navigation will refresh the data.
    }
  }, 100);
}

async function load() {
  const expectedId = topicId.value;
  loading.value = true;
  pageError.value = '';
  try {
    const fresh = await api.get<Topic>(`/topics/${expectedId}`);
    if (topicId.value !== expectedId) return;
    topic.value = fresh;
    totalVotes.value = fresh.totalVotes;
    if (!auth.isAuthed && fresh.status === 'OPEN' && !!fresh.voteEndAt && new Date(fresh.voteEndAt).getTime() > Date.now() && !fresh.hasVoted) {
      await navigateTo(loginUrl.value);
      return;
    }
  } catch (cause) {
    if (topicId.value !== expectedId) return;
    topic.value = null;
    pageError.value = errorMessage(cause);
  } finally {
    if (topicId.value === expectedId) loading.value = false;
  }
}

function resetVoteIntents() {
  selectedOptionId.value = null;
  confirmingOptionId.value = null;
  confirmingSpectrum.value = false;
  votingTargetId.value = null;
}

function onOptionTap(optionId: string) {
  if (!auth.isAuthed || voting.value || !isVotingOpen.value) return;
  const option = topic.value?.options.find((item) => item.id === optionId);
  if (!option) return;
  selectedOptionId.value = optionId;
  confirmingOptionId.value = option.id;
}

async function submitVote() {
  if (voting.value) return;
  const isSpectrum = topic.value?.topicType === 'SPECTRUM';
  if (!isSpectrum && !selectedOption.value) return;
  voting.value = true;
  votingTargetId.value = selectedOption.value?.id ?? null;
  try {
    const body = isSpectrum
      ? { spectrumValue: spectrumValue.value }
      : { optionId: selectedOption.value!.id };
    const res = await api.post<{ newBalance: string; rewardPoints: number }>(`/topics/${topicId.value}/vote`, body);
    auth.updatePoints(res.newBalance);
    const choice = isSpectrum ? `${spectrumValue.value} 分` : selectedOption.value!.label;
    toastSuccess(res.rewardPoints > 0 ? `已投下「${choice}」，獲得 ${res.rewardPoints} 點` : `已投下「${choice}」`);
    resetVoteIntents();
    await load();
  } catch (e) {
    resetVoteIntents();
    toastError(errorMessage(e));
    await load();
  } finally {
    voting.value = false;
  }
}

onMounted(async () => {
  if (route.query.section && !validSections.includes(route.query.section as TopicSection)) {
    await router.replace({ query: { ...route.query, section: 'vote', stance: undefined } });
  }
  await load();
  joinTopic(topicId.value);
  onVoteUpdate(applyUpdate);
});
watch(topicId, async (nextId, previousId) => {
  leaveTopic(previousId);
  selectedStance.value = null;
  resetVoteIntents();
  activeSection.value = validSections.includes(route.query.section as TopicSection) ? route.query.section as TopicSection : 'vote';
  await load();
  joinTopic(nextId);
});
watch(() => route.query.section, async (section) => {
  if (validSections.includes(section as TopicSection) && (section !== 'statistics' || auth.canViewAnalytics)) {
    activeSection.value = section as TopicSection;
  } else {
    activeSection.value = 'vote';
    if (section) await router.replace({ query: { ...route.query, section: 'vote', stance: undefined } });
  }
});
watch(() => auth.canViewAnalytics, (allowed) => {
  if (!allowed && activeSection.value === 'statistics') setSection('vote');
});
watch(() => route.query.stance, (stance) => {
  selectedStance.value = typeof stance === 'string' ? stance : null;
});
onUnmounted(() => {
  if (refreshTimer) clearTimeout(refreshTimer);
  cleanupRealtime();
});
</script>

<style scoped>
.spec-range::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 9999px;
  background: linear-gradient(90deg, #3f7a58, #b0761f 55%, #3157d5);
}
.spec-range::-moz-range-track {
  height: 6px;
  border-radius: 9999px;
  background: linear-gradient(90deg, #3f7a58, #b0761f 55%, #3157d5);
}
.spec-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  margin-top: -7px;
  width: 20px;
  height: 20px;
  border-radius: 9999px;
  background: #ffffff;
  border: 3px solid #b0761f;
  box-shadow: 0 1px 4px rgba(23, 23, 23, 0.25);
  transition: transform 0.15s ease;
}
.spec-range::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}
</style>

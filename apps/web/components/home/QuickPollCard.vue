<template>
  <article role="link" tabindex="0" class="group flex h-full cursor-pointer flex-col rounded-2xl border border-[#e0c9a0] bg-white p-4 shadow-[0_6px_20px_rgba(23,23,23,0.06)] transition hover:-translate-y-0.5 hover:border-[#b0761f] hover:shadow-[0_12px_28px_rgba(23,23,23,0.10)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b0761f]" @click="goTopic" @keydown.enter="goTopic">
    <div class="flex items-center justify-between gap-2">
      <span class="inline-flex items-center gap-1 rounded-full bg-[#fff0d7] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-[#8f5d14]">快問</span>
      <span class="text-xs font-bold text-[#77716a]">{{ deadlineLabel(poll.voteEndAt, deadlineNow) }}</span>
    </div>

    <NuxtLink :to="`/topic/${poll.id}`" class="focus-ring mt-3 text-[15px] font-black leading-snug text-[#171717] transition hover:text-[#b0761f]" @click.stop>
      {{ poll.title }}
    </NuxtLink>

    <UiImageLightbox v-model:src="lightboxSrc" />

    <div v-if="isOptionPick && isOpen && !auth.isAuthed" class="mt-4">
      <div class="space-y-2">
        <button
          v-for="o in visibleOptions"
          :key="o.id"
          type="button"
          class="focus-ring flex w-full items-center justify-between rounded-lg border border-[#e0c9a0] bg-[#fffaf0] px-3 py-2.5 text-sm font-bold text-[#6b5323] transition hover:border-[#b0761f]"
          @click.stop="goLogin"
        >
          <span class="flex items-center gap-2">{{ o.label }}</span>
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <button v-if="optionsCollapsed" type="button" class="focus-ring mt-2 w-full rounded-lg border border-dashed border-[#e0c9a0] px-3 py-2 text-xs font-bold text-[#8f5d14] hover:border-[#b0761f]" @click.stop="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${poll.options.length}）` }}</button>
    </div>

    <div v-else-if="isOptionPick && isOpen && auth.isAuthed && !auth.canVote" class="mt-4 rounded-xl border border-[#e6cf9e] bg-[#fff8ec] px-3 py-2 text-xs font-bold text-[#8f5d14]">{{ VOTE_IDENTITY_NOTICE }}</div>

    <div v-else-if="isOptionPick && isOpen" class="mt-4 space-y-2">
      <button
        v-for="o in visibleOptions"
        :key="o.id"
        type="button"
        class="focus-ring block w-full overflow-hidden rounded-lg border text-left transition disabled:cursor-not-allowed"
        :class="myVoteOptionId === o.id ? 'border-[#b0761f] bg-[#fff8ec]' : 'border-[#e0c9a0] bg-white hover:border-[#b0761f]'"
        :disabled="voting"
        @click.stop="onTap(o)"
      >
        <span class="flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-bold" :class="myVoteOptionId === o.id ? 'text-[#8f5d14]' : 'text-[#171717]'">
          <span class="flex items-center gap-2"><span v-if="myVoteOptionId === o.id" aria-hidden="true">✓</span>{{ o.label }}</span>
          <span class="flex items-center gap-2 text-xs tabular-nums">
            <span v-if="voting && votingTargetId === o.id" class="size-3.5 animate-spin rounded-full border-2 border-[#b0761f] border-t-transparent" aria-hidden="true" />
            <template v-else>
              <span class="text-[#8f5d14]">{{ optionPercentage(o, poll) }}%</span>
              <span v-if="poll.hasVoted" class="text-[#77716a]">· {{ formatCompactNumber(o.voteCount) }} 票</span>
            </template>
          </span>
        </span>
        <span v-if="poll.hasVoted" class="block h-1 bg-[#f0e6d2]"><span class="block h-full bg-[#b0761f] transition-[width] duration-500" :style="{ width: `${optionPercentage(o, poll)}%` }" /></span>
      </button>
      <button v-if="optionsCollapsed" type="button" class="focus-ring w-full rounded-lg border border-dashed border-[#e0c9a0] px-3 py-2 text-xs font-bold text-[#8f5d14] transition hover:border-[#b0761f]" @click.stop="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${poll.options.length}）` }}</button>
    </div>

    <div v-else-if="isOptionPick" class="mt-4 space-y-2">
      <button
        v-for="o in visibleOptions"
        :key="o.id"
        type="button"
        class="focus-ring block w-full overflow-hidden rounded-lg border border-[#e0c9a0] text-left"
        :class="myVoteOptionId === o.id ? 'bg-[#fff8ec]' : 'bg-white'"
        @click.stop="goTopic"
      >
        <span class="flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-bold" :class="myVoteOptionId === o.id ? 'text-[#8f5d14]' : 'text-[#171717]'">
          <span class="flex items-center gap-2"><span v-if="myVoteOptionId === o.id" aria-hidden="true">✓</span>{{ o.label }}</span>
          <span class="shrink-0 text-xs font-black tabular-nums text-[#77716a]">{{ optionPercentage(o, poll) }}%</span>
        </span>
        <span class="block h-1 bg-[#f0e6d2]"><span class="block h-full bg-[#b0761f]" :style="{ width: `${optionPercentage(o, poll)}%` }" /></span>
      </button>
      <button v-if="optionsCollapsed" type="button" class="focus-ring w-full rounded-lg border border-dashed border-[#e0c9a0] px-3 py-2 text-xs font-bold text-[#8f5d14] transition hover:border-[#b0761f]" @click.stop="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${poll.options.length}）` }}</button>
    </div>

    <div v-else-if="isImagePick && isOpen && !auth.isAuthed" class="mt-4">
      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="o in visibleOptions"
          :key="o.id"
          class="focus-ring group relative aspect-square overflow-hidden rounded-lg border-2 border-[#e0c9a0] bg-white transition hover:border-[#b0761f]"
        >
          <img :src="o.data?.imageUrl" :alt="o.label" class="absolute inset-0 h-full w-full object-cover" />
          <span class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-5 text-[10px] font-black text-white">{{ o.label }}</span>
          <button type="button" class="focus-ring absolute inset-0" :aria-label="`投票給 ${o.label}`" @click.stop="goLogin" />
          <button type="button" class="focus-ring absolute left-1 top-1 z-10 grid size-6 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/70" aria-label="放大檢視圖片" @click.stop="openLightbox(o.data?.imageUrl ?? '')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          </button>
        </div>
      </div>
      <button v-if="optionsCollapsed" type="button" class="focus-ring mt-2 w-full rounded-lg border border-dashed border-[#e0c9a0] px-3 py-2 text-xs font-bold text-[#8f5d14] hover:border-[#b0761f]" @click.stop="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${poll.options.length}）` }}</button>
    </div>

    <div v-else-if="isImagePick && isOpen && auth.isAuthed && !auth.canVote" class="mt-4 rounded-xl border border-[#e6cf9e] bg-[#fff8ec] px-3 py-2 text-xs font-bold text-[#8f5d14]">{{ VOTE_IDENTITY_NOTICE }}</div>

    <div v-else-if="isImagePick && isOpen" class="mt-4">
      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="o in visibleOptions"
          :key="o.id"
          class="focus-ring group relative aspect-square overflow-hidden rounded-lg border-2 text-left transition disabled:cursor-not-allowed"
          :class="myVoteOptionId === o.id ? 'border-[#b0761f] ring-2 ring-[#b0761f]' : 'border-[#e0c9a0] hover:border-[#b0761f]'"
        >
          <img :src="o.data?.imageUrl" :alt="o.label" class="absolute inset-0 h-full w-full object-cover" />
          <span class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-5 text-[10px] font-black text-white">{{ o.label }}</span>
          <span v-if="voting && votingTargetId === o.id" class="pointer-events-none absolute inset-0 grid place-items-center bg-black/30"><span class="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" /></span>
          <span v-else-if="myVoteOptionId === o.id" class="pointer-events-none absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-[#b0761f] text-xs text-white" aria-hidden="true">✓</span>
          <span v-if="poll.hasVoted" class="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/20"><span class="block h-full bg-[#b0761f]" :style="{ width: `${optionPercentage(o, poll)}%` }" /></span>
          <button type="button" class="focus-ring absolute inset-0" :disabled="voting" :aria-label="`投票給 ${o.label}`" @click.stop="onTap(o)" />
          <button type="button" class="focus-ring absolute left-1 top-1 z-10 grid size-6 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/70" aria-label="放大檢視圖片" @click.stop="openLightbox(o.data?.imageUrl ?? '')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          </button>
        </div>
      </div>
      <button v-if="optionsCollapsed" type="button" class="focus-ring mt-2 w-full rounded-lg border border-dashed border-[#e0c9a0] px-3 py-2 text-xs font-bold text-[#8f5d14] hover:border-[#b0761f]" @click.stop="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${poll.options.length}）` }}</button>
    </div>

    <div v-else-if="isImagePick" class="mt-4">
      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="o in visibleOptions"
          :key="o.id"
          class="focus-ring group relative aspect-square overflow-hidden rounded-lg border border-[#e0c9a0] bg-white text-left"
          :class="myVoteOptionId === o.id ? 'ring-2 ring-[#b0761f]' : ''"
        >
          <img :src="o.data?.imageUrl" :alt="o.label" class="absolute inset-0 h-full w-full object-cover" />
          <span class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1.5 pt-5 text-[10px] font-black text-white">
            <span class="flex items-center justify-between gap-1"><span v-if="myVoteOptionId === o.id" aria-hidden="true">✓</span>{{ o.label }}<span class="shrink-0 tabular-nums">{{ optionPercentage(o, poll) }}%</span></span>
          </span>
          <span class="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/20"><span class="block h-full bg-[#b0761f]" :style="{ width: `${optionPercentage(o, poll)}%` }" /></span>
          <button type="button" class="focus-ring absolute inset-0" :aria-label="`查看 ${o.label}`" @click.stop="goTopic" />
          <button type="button" class="focus-ring absolute left-1 top-1 z-10 grid size-6 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/70" aria-label="放大檢視圖片" @click.stop="openLightbox(o.data?.imageUrl ?? '')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          </button>
        </div>
      </div>
      <button v-if="optionsCollapsed" type="button" class="focus-ring mt-2 w-full rounded-lg border border-dashed border-[#e0c9a0] px-3 py-2 text-xs font-bold text-[#8f5d14] hover:border-[#b0761f]" @click.stop="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${poll.options.length}）` }}</button>
    </div>

    <div v-else class="mt-4 rounded-xl border border-[#e0c9a0] bg-[#fffaf0] p-4" @click.stop>
      <QuickVotePanel :topic="poll" @refreshed="onRefreshed" />
    </div>

    <div class="mt-auto border-t border-[#f0e6d2] pt-3 text-xs text-[#77716a]">
      <span v-if="isRankPick">{{ formatCompactNumber(poll.voterCount) }} 人已玩</span>
      <span v-else>{{ formatCompactNumber(poll.totalVotes) }} 人已投</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Topic, TopicOption } from '~/types/topic';
import { deadlineLabel, formatCompactNumber, isImageOptionType, isImageRankType, isOptionPickType, optionPercentage } from '~/utils/topic';
import { OPTION_COLLAPSE_LIMIT, VOTE_IDENTITY_NOTICE } from '~/utils/topic';

const props = defineProps<{ topic: Topic }>();

const api = useApi();
const auth = useAuthStore();
const router = useRouter();
const { success: toastSuccess, error: toastError } = useToast();
const deadlineNow = useState<number>('topic-deadline-now', () => Date.now());

const poll = ref<Topic>(props.topic);
const voting = ref(false);
const votingTargetId = ref<string | null>(null);
const showAllOptions = ref(false);
const lightboxSrc = ref<string | null>(null);

function openLightbox(src: string) { lightboxSrc.value = src; }

const isOpen = computed(() => poll.value.status === 'OPEN' && !!poll.value.voteEndAt && new Date(poll.value.voteEndAt).getTime() > Date.now());
const isOptionPick = computed(() => isOptionPickType(poll.value.topicType) && poll.value.topicType !== 'SHORT_ANSWER');
const isImagePick = computed(() => isImageOptionType(poll.value.topicType));
const isRankPick = computed(() => isImageRankType(poll.value.topicType));
const myVoteOptionId = computed(() => poll.value.options.find((option) => option.label === poll.value.myVote?.choice)?.id ?? null);
const optionsCollapsed = computed(() => !showAllOptions.value && poll.value.options.length > OPTION_COLLAPSE_LIMIT);
const visibleOptions = computed(() => optionsCollapsed.value ? poll.value.options.slice(0, OPTION_COLLAPSE_LIMIT) : poll.value.options);

function toggleOptions() {
  showAllOptions.value = !showAllOptions.value;
}

watch(() => props.topic, (topic) => { poll.value = topic; });

function goTopic() {
  if (voting.value) return;
  router.push(`/topic/${poll.value.id}`);
}

function goLogin() {
  router.push('/login');
}

async function onTap(option: TopicOption) {
  if (voting.value || !isOpen.value || option.id === myVoteOptionId.value) return;
  if (poll.value.hasVoted) await changeVote(option);
  else await submitVote(option);
}

async function refreshPoll() {
  poll.value = await api.get<Topic>(`/topics/${poll.value.id}`);
}

async function onRefreshed() {
  await refreshPoll();
}

async function submitVote(option: TopicOption) {
  voting.value = true;
  votingTargetId.value = option.id;
  try {
    const res = await api.post<{ newBalance: string }>(`/topics/${poll.value.id}/vote`, { optionId: option.id });
    auth.updatePoints(res.newBalance);
    votingTargetId.value = null;
    toastSuccess('已投票，快問結果即時更新');
    await refreshPoll();
  } catch (e) {
    votingTargetId.value = null;
    if ((e as { data?: { statusCode?: number } })?.data?.statusCode === 409) {
      voting.value = false;
      await changeVote(option);
      return;
    }
    toastError(errorMessage(e));
  } finally {
    voting.value = false;
  }
}

async function changeVote(option: TopicOption) {
  voting.value = true;
  votingTargetId.value = option.id;
  try {
    const res = await api.patch<{ newBalance: string }>(`/topics/${poll.value.id}/vote`, { optionId: option.id });
    auth.updatePoints(res.newBalance);
    votingTargetId.value = null;
    await refreshPoll();
  } catch (e) {
    votingTargetId.value = null;
    toastError(errorMessage(e));
  } finally {
    voting.value = false;
  }
}
</script>
<template>
  <article class="group flex h-full flex-col rounded-2xl border border-[#e0c9a0] bg-white p-4 shadow-[0_6px_20px_rgba(23,23,23,0.06)]">
    <div class="flex items-center justify-between gap-2">
      <span class="flex items-center gap-1.5">
        <span class="inline-flex items-center gap-1 rounded-full bg-[#fff0d7] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-[#8f5d14]">快問</span>
        <span class="inline-flex items-center rounded-full border border-[#e0c9a0] px-2 py-0.5 text-[10px] font-bold text-[#8f5d14]">{{ topicTypeLabel(poll.topicType) }}</span>
      </span>
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
      <button v-if="optionsCollapsed" type="button" class="focus-ring mt-2 w-full rounded-lg border border-dashed border-[#e0c9a0] px-3 py-2 text-xs font-bold text-[#8f5d14] hover:border-[#b0761f]" @click.stop="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${hiddenCount}）` }}</button>
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
          <span v-if="voting && votingTargetId === o.id" class="size-3.5 animate-spin rounded-full border-2 border-[#b0761f] border-t-transparent" aria-hidden="true" />
        </span>
      </button>
      <button v-if="optionsCollapsed" type="button" class="focus-ring w-full rounded-lg border border-dashed border-[#e0c9a0] px-3 py-2 text-xs font-bold text-[#8f5d14] transition hover:border-[#b0761f]" @click.stop="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${hiddenCount}）` }}</button>
    </div>

    <div v-else-if="isOptionPick" class="mt-4 space-y-2">
      <div
        v-for="o in visibleOptions"
        :key="o.id"
        class="block w-full overflow-hidden rounded-lg border border-[#e0c9a0] text-left"
        :class="myVoteOptionId === o.id ? 'bg-[#fff8ec]' : 'bg-white'"
      >
        <span class="flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-bold" :class="myVoteOptionId === o.id ? 'text-[#8f5d14]' : 'text-[#171717]'">
          <span class="flex items-center gap-2"><span v-if="myVoteOptionId === o.id" aria-hidden="true">✓</span>{{ o.label }}</span>
        </span>
      </div>
      <button v-if="optionsCollapsed" type="button" class="focus-ring w-full rounded-lg border border-dashed border-[#e0c9a0] px-3 py-2 text-xs font-bold text-[#8f5d14] transition hover:border-[#b0761f]" @click.stop="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${hiddenCount}）` }}</button>
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
      <button v-if="optionsCollapsed" type="button" class="focus-ring mt-2 w-full rounded-lg border border-dashed border-[#e0c9a0] px-3 py-2 text-xs font-bold text-[#8f5d14] hover:border-[#b0761f]" @click.stop="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${hiddenCount}）` }}</button>
    </div>

    <div v-else-if="isImagePick && isOpen && auth.isAuthed && !auth.canVote" class="mt-4 rounded-xl border border-[#e6cf9e] bg-[#fff8ec] px-3 py-2 text-xs font-bold text-[#8f5d14]">{{ VOTE_IDENTITY_NOTICE }}</div>

    <div v-else-if="isImagePick && isOpen" class="mt-4">
      <div class="grid grid-cols-2 gap-3">
        <ImageOptionTile
          v-for="o in visibleOptions"
          :key="o.id"
          :src="o.data?.imageUrl"
          :label="o.label"
          :selected="myVoteOptionId === o.id"
          :voting="voting && votingTargetId === o.id"
          :disabled="voting"
          :progress="null"
          vote-action-label="投票給"
          tile-class="rounded-lg"
          badge-class="right-1 top-1 size-5 bg-[#b0761f] text-xs"
          zoom-button-class="left-1 top-1 size-6"
          :zoom-icon-size="12"
          caption-class="px-1.5 pb-1 pt-5 text-[10px]"
          spinner-class="size-5"
          @vote="onTap(o)"
          @zoom="openLightbox(o.data?.imageUrl ?? '')"
        />
      </div>
      <button v-if="optionsCollapsed" type="button" class="focus-ring mt-2 w-full rounded-lg border border-dashed border-[#e0c9a0] px-3 py-2 text-xs font-bold text-[#8f5d14] hover:border-[#b0761f]" @click.stop="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${hiddenCount}）` }}</button>
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
            <span class="flex items-center justify-between gap-1"><span v-if="myVoteOptionId === o.id" aria-hidden="true">✓</span>{{ o.label }}</span>
          </span>
          <button type="button" class="focus-ring absolute left-1 top-1 z-10 grid size-6 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/70" aria-label="放大檢視圖片" @click.stop="openLightbox(o.data?.imageUrl ?? '')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          </button>
        </div>
      </div>
      <button v-if="optionsCollapsed" type="button" class="focus-ring mt-2 w-full rounded-lg border border-dashed border-[#e0c9a0] px-3 py-2 text-xs font-bold text-[#8f5d14] hover:border-[#b0761f]" @click.stop="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${hiddenCount}）` }}</button>
    </div>

    <div v-else-if="isRankPick" class="mt-4">
      <div class="grid grid-cols-4 gap-2" aria-hidden="true">
        <div
          v-for="o in poll.options.slice(0, 4)"
          :key="o.id"
          class="relative aspect-square overflow-hidden rounded-lg border border-[#e0c9a0] bg-white"
        >
          <img v-if="o.data?.imageUrl" :src="o.data.imageUrl" :alt="o.label" class="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
          <span v-else class="absolute inset-0 grid place-items-center bg-[#fff8ec] px-1 text-center text-[10px] font-black text-[#8f5d14]">{{ o.label }}</span>
        </div>
      </div>
      <p class="mt-2 text-center text-xs font-bold text-[#8f5d14]">進入排名賽逐對 PK</p>
    </div>

    <div v-else class="mt-4" @click.stop>
      <QuickVotePanel :topic="poll" hide-stats @refreshed="onRefreshed" />
    </div>

    <div class="mt-auto flex items-center justify-between gap-2 border-t border-[#f0e6d2] pt-3 text-xs text-[#77716a]">
      <span class="flex min-w-0 items-center gap-1.5">
        <NuxtLink v-if="poll.creator.type === 'MEMBER' && poll.creator.id" :to="`/members/${poll.creator.id}`" class="focus-ring min-w-0 truncate font-bold hover:text-[#171717]" @click.stop @keydown.enter.stop>{{ poll.creator.nickname }}</NuxtLink>
        <span v-else class="min-w-0 truncate font-bold">{{ poll.creator.nickname }}</span>
        <span aria-hidden="true">·</span>
        <span class="shrink-0">{{ formatTimeAgo(poll.createdAt, deadlineNow) }}</span>
      </span>
      <span v-if="isRankPick" class="shrink-0">{{ formatCompactNumber(poll.voterCount) }} 人已玩</span>
      <span v-else class="shrink-0">{{ formatCompactNumber(poll.totalVotes) }} 人已投</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Topic, TopicOption } from '~/types/topic';
import { deadlineLabel, formatCompactNumber, isImageOptionType, isImageRankType, isOptionPickType, topicTypeLabel } from '~/utils/topic';
import { VOTE_IDENTITY_NOTICE } from '~/utils/topic';
// 明確 import：自動註冊名為 VoteImageOptionTile，模板短名需靠顯式引入解析
import ImageOptionTile from '../vote/ImageOptionTile.vue';

const props = defineProps<{ topic: Topic }>();

const api = useApi();
const auth = useAuthStore();
const { error: toastError } = useToast();
const deadlineNow = useDeadlineNow();

const poll = ref<Topic>(props.topic);
const voting = ref(false);
const votingTargetId = ref<string | null>(null);
const { showAllOptions, optionsCollapsed, visibleOptions, hiddenCount, toggleOptions } = useCollapsedOptions(() => poll.value.options);
const { src: lightboxSrc, open: openLightbox } = useLightbox();

const { isVotingOpen: isOpen } = useVotingGate(poll);
const panelOnlyTypes = new Set(['STAR_RATING', 'LIKERT', 'MULTI_SELECT']);
const isOptionPick = computed(() => isOptionPickType(poll.value.topicType) && !panelOnlyTypes.has(poll.value.topicType));
const isImagePick = computed(() => isImageOptionType(poll.value.topicType));
const isRankPick = computed(() => isImageRankType(poll.value.topicType));
const myVoteOptionId = computed(() => poll.value.myVote?.optionId ?? null);

watch(() => props.topic, (topic) => { poll.value = topic; });

function goLogin() {
  navigateTo('/login');
}

async function onTap(option: TopicOption) {
  if (voting.value || !isOpen.value) return;
  // 重複點擊已選選項＝重置（卡片只顯示非子題，無需子題判斷）
  if (poll.value.hasVoted && option.id === myVoteOptionId.value) {
    await withdrawPollVote();
    return;
  }
  if (poll.value.hasVoted) await changeVote(option);
  else await submitVote(option);
}

async function withdrawPollVote() {
  voting.value = true;
  try {
    const res = await api.delete<{ success: boolean; newBalance: string }>(`/topics/${poll.value.id}/vote`);
    if (res.newBalance != null) auth.updatePoints(res.newBalance);
    await refreshPoll();
  } catch (e) {
    toastError(errorMessage(e));
  } finally {
    voting.value = false;
  }
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

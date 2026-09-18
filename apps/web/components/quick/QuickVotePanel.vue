<template>
  <div>
    <UiImageLightbox v-model:src="lightboxSrc" />
    <RankImageRankVotePanel v-if="isImageRank" :topic="topic" :hide-stats="hideStats" @refreshed="emitRefreshed" />
    <div v-else-if="!showResults && isVotingOpen && !participationReady" class="h-24 animate-pulse rounded-xl bg-[#eee9e0]" />
    <div v-else-if="isVotingOpen && !topic.hasVoted && auth.isAuthed && !auth.canVote" class="rounded-xl border border-[#e6cf9e] bg-[#fff8ec] p-4 text-sm font-bold text-[#8f5d14]">{{ VOTE_IDENTITY_NOTICE }}</div>

    <VoteSpectrum v-else-if="topic.topicType === 'SPECTRUM'" :topic="topic" :hide-stats="hideStats" @refreshed="emitRefreshed" />

    <VoteShortAnswer v-else-if="topic.topicType === 'SHORT_ANSWER'" :topic="topic" :hide-stats="hideStats" @refreshed="emitRefreshed" />

    <MatchingGame v-else-if="isVotingOpen && topic.topicType === 'MATCHING'" :topic="topic" :hide-stats="hideStats" @refreshed="emitRefreshed" />

    <PuzzleGame v-else-if="isVotingOpen && topic.topicType === 'PUZZLE'" :topic="topic" :hide-stats="hideStats" @refreshed="emitRefreshed" />

    <ScratchGame v-else-if="isVotingOpen && topic.topicType === 'SCRATCH'" :topic="topic" :hide-stats="hideStats" :disabled="!auth.isAuthed || !auth.canVote" @refreshed="emitRefreshed" />

    <WheelGame v-else-if="isVotingOpen && topic.topicType === 'SPIN_WHEEL'" :topic="topic" :hide-stats="hideStats" @refreshed="emitRefreshed" />

    <LotteryGame v-else-if="isVotingOpen && topic.topicType === 'LOTTERY'" :topic="topic" :hide-stats="hideStats" @refreshed="emitRefreshed" />

    <VoteRating v-else-if="isRating" :topic="topic" :hide-stats="hideStats" @refreshed="emitRefreshed" />

    <VoteMultiSelect v-else-if="isMultiSelect" :topic="topic" :hide-stats="hideStats" @refreshed="emitRefreshed" />

    <template v-else-if="!showResults && isVotingOpen && isOptionPick">
      <VoteOptionList :options="visibleOptions" :selected-id="myVoteOptionId" :disabled="voting || isInteractionLocked" @select="onOptionVote" />
      <button v-if="optionsCollapsed" type="button" class="focus-ring mt-3 w-full rounded-xl border border-[#e0c9a0] bg-[#fffaf0] px-3 py-2 text-xs font-bold text-[#8f5d14] transition hover:border-[#b0761f]" @click="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${hiddenCount}）` }}</button>
    </template>

    <template v-else-if="!showResults && isVotingOpen && isImageOption">
      <div class="grid grid-cols-2 gap-3">
        <ImageOptionTile
          v-for="o in topic.options"
          :key="o.id"
          :src="o.data?.imageUrl"
          :label="o.label"
          :selected="myVoteOptionId === o.id"
          :voting="voting && votingTargetId === o.id"
          :disabled="voting || isInteractionLocked"
          @vote="onOptionVote(o.id)"
          @zoom="openLightbox(o.data?.imageUrl ?? '')"
        />
      </div>
    </template>

    <template v-else-if="isVotingOpen && showResults && isOptionPick">
      <div class="space-y-2.5">
        <button
          v-for="o in visibleOptions"
          :key="o.id"
          type="button"
          class="focus-ring block w-full overflow-hidden rounded-xl border-2 text-left transition"
          :class="myVoteOptionId === o.id ? 'border-[#b0761f] bg-[#fff8ec]' : 'border-[#ded7cb] bg-white hover:border-[#b0761f]'"
          :disabled="voting || isSubQuestion"
          @click="onChangeVote(o.id)"
        >
          <VoteResultBar :label="o.label" :percentage="optionPercentage(o, topic)" :count="o.voteCount" :highlighted="myVoteOptionId === o.id" check-suffix="" highlight-class="" row-class="flex items-center justify-between px-4 py-3 text-sm font-bold" label-class="flex items-center gap-2" value-class="flex items-center gap-2 tabular-nums" track-class="block h-1.5 bg-[#f0e6d2]" bar-class="block h-full bg-[#b0761f] transition-[width] duration-500" />
        </button>
      </div>
      <button v-if="optionsCollapsed" type="button" class="focus-ring mt-3 w-full rounded-xl border border-[#e0c9a0] bg-[#fffaf0] px-3 py-2 text-xs font-bold text-[#8f5d14] transition hover:border-[#b0761f]" @click="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${hiddenCount}）` }}</button>
      <UiButton v-if="topic.hasVoted && !isSubQuestion" variant="outline" block class="mt-3" :disabled="voting" @click="withdrawVote">{{ voting ? '重置中…' : '重置' }}</UiButton>
    </template>

    <template v-else-if="isVotingOpen && showResults && isImageOption">
      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="o in topic.options"
          :key="o.id"
          class="focus-ring group relative overflow-hidden rounded-2xl border-2 text-left transition"
          :class="myVoteOptionId === o.id ? 'border-[#b0761f]' : 'border-[#ded7cb] hover:border-[#b0761f]'"
        >
          <span class="relative block aspect-square">
            <img :src="o.data?.imageUrl" :alt="o.label" class="absolute inset-0 h-full w-full object-cover" />
            <span class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-8 text-xs font-black text-white">
              <span class="flex items-center justify-between gap-2">
                <span class="flex items-center gap-1"><span v-if="myVoteOptionId === o.id" aria-hidden="true">✓</span>{{ o.label }}</span>
                <span class="shrink-0 tabular-nums">{{ optionPercentage(o, topic) }}% · {{ o.voteCount }} 票</span>
              </span>
            </span>
            <span class="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-white/20"><span class="block h-full bg-[#b0761f] transition-[width] duration-500" :style="{ width: `${optionPercentage(o, topic)}%` }" /></span>
            <button type="button" class="focus-ring absolute inset-0" :disabled="voting || isSubQuestion" :aria-label="`改投 ${o.label}`" @click="onChangeVote(o.id)" />
            <button type="button" class="focus-ring absolute left-1.5 top-1.5 z-10 grid size-7 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/70" :disabled="voting" aria-label="放大檢視圖片" @click.stop="openLightbox(o.data?.imageUrl ?? '')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            </button>
          </span>
        </div>
      </div>
      <div v-if="topic.hasVoted && !isSubQuestion" class="mx-auto mt-3 max-w-xs">
        <UiButton variant="outline" block class="w-full" :disabled="voting" @click="withdrawVote">{{ voting ? '重置中…' : '重置' }}</UiButton>
      </div>
    </template>

    <template v-else-if="isImageOption">
      <div class="grid grid-cols-2 gap-3">
          <div v-for="o in topic.options" :key="o.id" class="relative overflow-hidden rounded-2xl border border-[#ded7cb]">
            <span class="relative block aspect-square">
              <img :src="o.data?.imageUrl" :alt="o.label" class="absolute inset-0 h-full w-full object-cover" @click.stop="openLightbox(o.data?.imageUrl ?? '')" />
              <span class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-8 text-xs font-black text-white">
                <span class="flex items-center justify-between gap-2">
                  <span>{{ o.label }}</span>
                  <span class="shrink-0 tabular-nums">{{ optionPercentage(o, topic) }}% · {{ o.voteCount }} 票</span>
                </span>
              </span>
              <span class="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-white/20"><span class="block h-full bg-[#3157d5]" :style="{ width: `${optionPercentage(o, topic)}%` }" /></span>
              <button type="button" class="focus-ring absolute left-1.5 top-1.5 z-10 grid size-7 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/70" aria-label="放大檢視圖片" @click.stop="openLightbox(o.data?.imageUrl ?? '')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              </button>
            </span>
          </div>
        </div>
        <p v-if="topic.myVote" class="mt-5 rounded-xl border-l-4 border-[#3f7a58] bg-[#e5f1e9] p-3 text-sm font-bold">你的選擇：{{ votedChoice }}</p>
    </template>
    <template v-else>
      <div class="space-y-5">
          <VoteResultBar v-for="o in visibleOptions" :key="o.id" :label="o.label" :percentage="optionPercentage(o, topic)" :count="o.voteCount" />
        </div>
        <p v-if="topic.myVote" class="mt-5 rounded-xl border-l-4 border-[#3f7a58] bg-[#e5f1e9] p-3 text-sm font-bold">你的選擇：{{ votedChoice }}</p>
        <button v-if="optionsCollapsed" type="button" class="focus-ring mt-4 w-full rounded-xl border border-[#e0c9a0] bg-[#fffaf0] px-3 py-2 text-xs font-bold text-[#8f5d14] transition hover:border-[#b0761f]" @click="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${hiddenCount}）` }}</button>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Topic } from '~/types/topic';
import { isImageOptionType, isImageRankType, isOptionPickType, isRatingType, optionPercentage } from '~/utils/topic';
import { VOTE_IDENTITY_NOTICE } from '~/utils/topic';
// 明確 import：Nuxt 自動註冊名含目錄前綴（QuickVoteSpectrum…），模板短名需靠顯式引入解析
import ImageOptionTile from '../vote/ImageOptionTile.vue';
import LotteryGame from './games/LotteryGame.vue';
import MatchingGame from './games/MatchingGame.vue';
import PuzzleGame from './games/PuzzleGame.vue';
import ScratchGame from './games/ScratchGame.vue';
import VoteMultiSelect from './VoteMultiSelect.vue';
import VoteRating from './VoteRating.vue';
import VoteShortAnswer from './VoteShortAnswer.vue';
import VoteSpectrum from './VoteSpectrum.vue';
import WheelGame from './games/WheelGame.vue';

const props = withDefaults(defineProps<{ topic: Topic; hideStats?: boolean }>(), { hideStats: false });
const emit = defineEmits<{ refreshed: [] }>();

const auth = useAuthStore();

const { src: lightboxSrc, open: openLightbox } = useLightbox();

const { isVotingOpen, participationReady, showResults } = useVotingGate(() => props.topic);
const isOptionPick = computed(() => isOptionPickType(props.topic.topicType));
const isImageOption = computed(() => isImageOptionType(props.topic.topicType));
const isImageRank = computed(() => isImageRankType(props.topic.topicType));
const isRating = computed(() => isRatingType(props.topic.topicType));
const isMultiSelect = computed(() => props.topic.topicType === 'MULTI_SELECT');
const isInteractionLocked = computed(() => !auth.isAuthed);
function emitRefreshed() { emit('refreshed'); }

const { voting, votingTargetId, submitQuickVote, changeQuickVote, withdrawVote } = useVoteMutation(() => props.topic, emitRefreshed);
const isSubQuestion = computed(() => props.topic.parentTopicId != null);
// 重複點擊已選選項＝重置；問卷子題只能首投，不可更改或重置
function onOptionVote(optionId: string) {
  if (isSubQuestion.value) {
    if (props.topic.hasVoted) return;
    void submitQuickVote(optionId);
    return;
  }
  if (props.topic.hasVoted && optionId === myVoteOptionId.value) {
    void withdrawVote();
    return;
  }
  if (props.topic.hasVoted) {
    void changeQuickVote(optionId);
    return;
  }
  void submitQuickVote(optionId);
}
function onChangeVote(optionId: string) {
  onOptionVote(optionId);
}
const votedOptionIndex = computed(() => props.topic.options.findIndex((option) => option.id === props.topic.myVote?.optionId));
const myVoteOptionId = computed(() => props.topic.myVote?.optionId ?? (votedOptionIndex.value >= 0 ? props.topic.options[votedOptionIndex.value]?.id ?? null : null));
const votedChoice = computed(() => props.topic.myVote?.choice || (votedOptionIndex.value >= 0 ? `選項 ${votedOptionIndex.value + 1}` : ''));

const { showAllOptions, optionsCollapsed, visibleOptions, hiddenCount, toggleOptions } = useCollapsedOptions(() => props.topic.options);
</script>

<style scoped>
.game-chip-in {
  animation: chip-in 0.32s cubic-bezier(0.22, 0.9, 0.35, 1.2) both;
}
@keyframes chip-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .game-chip-in {
    animation: none;
  }
}
</style>

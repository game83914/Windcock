<template>
  <div>
    <template v-if="isVotingOpen && (!showResults || (auth.canVote && !isSubQuestion))">
      <p class="mb-3 text-sm font-bold text-[#6d6861]">可選 1～{{ multiSelectLimit }} 項，選好後確認送出。</p>
        <div class="space-y-2.5">
          <label v-for="o in visibleOptions" :key="o.id" class="focus-within:ring-2 focus-within:ring-[#b0761f] flex min-h-12 items-center gap-3 rounded-xl border-2 px-4 py-3 font-bold transition" :class="[selectedOptionIds.includes(o.id) ? 'border-[#b0761f] bg-[#fff8ec] text-[#8f5d14]' : 'border-[#ded7cb] bg-white', isOptionDisabled(o.id) && !selectedOptionIds.includes(o.id) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer']">
            <input type="checkbox" class="size-5 accent-[#b0761f]" :checked="selectedOptionIds.includes(o.id)" :disabled="isOptionDisabled(o.id)" @change="toggleMultiSelection(o.id)" />
            <span class="flex-1">{{ o.label }}</span>
            <span v-if="showResults && !hideStats" class="text-xs tabular-nums">{{ multiSelectPercentage(o, topic) }}%</span>
          </label>
        </div>
      <button v-if="optionsCollapsed" type="button" class="focus-ring mt-3 w-full rounded-xl border border-[#e0c9a0] bg-[#fffaf0] px-3 py-2 text-xs font-bold text-[#8f5d14]" @click="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${hiddenCount}）` }}</button>
      <UiButton v-if="!isInteractionLocked && !topic.hasVoted" variant="quick" block class="mt-4" :disabled="voting || !multiSelectionValid || multiSelectionUnchanged" @click="submitMultiSelectVote">{{ voting ? '送出中…' : `確認選擇（${selectedOptionIds.length}）` }}</UiButton>
      <UiButton v-if="topic.hasVoted && !isSubQuestion" variant="outline" block class="mt-2" :disabled="voting" @click="withdrawVote">{{ voting ? '重置中…' : '重置' }}</UiButton>
      <p v-if="showResults && !hideStats" class="mt-4 text-xs text-[#77716a]">選取率以作答人數計算，每人可複選，因此百分比加總可能超過 100%。</p>
    </template>
    <template v-else>
      <div class="space-y-4">
        <div v-for="o in visibleOptions" :key="o.id">
          <div class="mb-1 flex items-center justify-between gap-3 text-sm font-bold"><span :class="myVoteOptionIds.includes(o.id) ? 'text-[#8f5d14]' : ''"><span v-if="myVoteOptionIds.includes(o.id)" aria-hidden="true">✓ </span>{{ o.label }}</span><span v-if="!hideStats" class="shrink-0 tabular-nums">{{ multiSelectPercentage(o, topic) }}% · {{ o.voteCount }} 次</span></div>
          <div v-if="!hideStats" class="h-2 rounded-full bg-[#dfdad0]"><div class="h-full rounded-full bg-[#3157d5]" :style="{ width: `${Math.min(multiSelectPercentage(o, topic), 100)}%` }" /></div>
        </div>
      </div>
      <p v-if="!hideStats" class="mt-4 text-xs text-[#77716a]">選取率以作答人數計算，每人可複選，因此百分比加總可能超過 100%。</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Topic } from '~/types/topic';
import { multiSelectPercentage } from '~/utils/topic';

const props = withDefaults(defineProps<{ topic: Topic; hideStats?: boolean }>(), { hideStats: false });
const emit = defineEmits<{ refreshed: [] }>();

const auth = useAuthStore();
const { error: toastError } = useToast();

const { isVotingOpen, showResults } = useVotingGate(() => props.topic);
const isInteractionLocked = computed(() => !auth.isAuthed);
function emitRefreshed() { emit('refreshed'); }

const { voting, submitMultiSelectVote: sendMultiSelectVote, withdrawVote } = useVoteMutation(() => props.topic, emitRefreshed);
const isSubQuestion = computed(() => props.topic.parentTopicId != null);

const votedOptionIndex = computed(() => props.topic.options.findIndex((option) => option.id === props.topic.myVote?.optionId));
const myVoteOptionId = computed(() => props.topic.myVote?.optionId ?? (votedOptionIndex.value >= 0 ? props.topic.options[votedOptionIndex.value]?.id ?? null : null));
const myVoteOptionIds = computed(() => props.topic.myVote?.optionIds ?? (myVoteOptionId.value ? [myVoteOptionId.value] : []));
const selectedOptionIds = ref<string[]>([...myVoteOptionIds.value]);
const multiSelectLimit = computed(() => Math.max(1, Math.min(props.topic.maxSelections ?? props.topic.options.length, props.topic.options.length)));
const multiSelectionValid = computed(() => selectedOptionIds.value.length >= 1 && selectedOptionIds.value.length <= multiSelectLimit.value);
const multiSelectionUnchanged = computed(() => selectedOptionIds.value.length === myVoteOptionIds.value.length && selectedOptionIds.value.every((id) => myVoteOptionIds.value.includes(id)));

const { showAllOptions, optionsCollapsed, visibleOptions, hiddenCount, toggleOptions } = useCollapsedOptions(() => props.topic.options);

// 選滿上限時鎖定未選選項；取消已選項目後自動解鎖
const selectionLocked = computed(() => selectedOptionIds.value.length >= multiSelectLimit.value);
function isOptionDisabled(optionId: string) {
  if (voting.value || isInteractionLocked.value) return true;
  return selectionLocked.value && !selectedOptionIds.value.includes(optionId);
}

function toggleMultiSelection(optionId: string) {
  if (selectedOptionIds.value.includes(optionId)) {
    selectedOptionIds.value = selectedOptionIds.value.filter((id) => id !== optionId);
    return;
  }
  if (selectedOptionIds.value.length >= multiSelectLimit.value) {
    toastError(`最多只能選 ${multiSelectLimit.value} 項`);
    return;
  }
  selectedOptionIds.value = [...selectedOptionIds.value, optionId];
}

async function submitMultiSelectVote() {
  if (voting.value || !auth.isAuthed || !multiSelectionValid.value || multiSelectionUnchanged.value) return;
  await sendMultiSelectVote([...selectedOptionIds.value]);
}

watch(() => props.topic.myVote?.optionIds, (optionIds) => {
  selectedOptionIds.value = [...(optionIds ?? [])];
});
watch(() => props.topic.id, (nextId, previousId) => {
  if (nextId === previousId) return;
  selectedOptionIds.value = [...(props.topic.myVote?.optionIds ?? [])];
});
</script>

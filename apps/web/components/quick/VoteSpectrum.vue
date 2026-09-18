<template>
  <div>
    <template v-if="!showResults && isVotingOpen">
      <div class="flex items-end justify-between">
        <span class="text-sm font-bold text-[#6d6861]">目前選擇</span>
        <strong class="text-4xl font-black tabular-nums text-[#3157d5]">{{ spectrumValue }}<small class="ml-1 text-sm text-[#77716a]">/ 100</small></strong>
      </div>
      <input v-model.number="spectrumValue" type="range" min="0" max="100" class="spec-range focus-ring mt-5 w-full accent-[#3157d5]" :class="{ 'cursor-not-allowed opacity-60': isInteractionLocked }" :disabled="isInteractionLocked" />
      <div class="mt-2 flex justify-between text-xs font-bold text-[#77716a]"><span>0</span><span>50</span><span>100</span></div>
      <UiButton v-if="!isInteractionLocked" variant="data" block class="mt-6" :disabled="voting" @click="submitSpectrumVote">
        {{ voting ? '送出中…' : `確認送出 ${spectrumValue} 分` }}
      </UiButton>
    </template>

    <template v-else-if="isVotingOpen && showResults">
      <div v-if="!hideStats" class="flex items-end justify-between">
        <span class="text-sm font-bold text-[#6d6861]">社群中位數</span>
        <strong class="text-4xl font-black tabular-nums text-[#b0761f]">{{ Math.round(Number(topic.spectrumMedian || 0)) }}<small class="ml-1 text-sm text-[#77716a]">/ 100</small></strong>
      </div>
      <div v-if="!hideStats" class="relative mt-5 h-2 rounded-full bg-[#dfdad0]"><div class="h-full rounded-full bg-[#b0761f]" :style="{ width: `${Number(topic.spectrumMedian || 0)}%` }" /></div>
      <div class="mt-6 rounded-xl bg-[#fffaf0] p-4">
        <div class="flex items-end justify-between">
          <span class="text-sm font-bold text-[#6d6861]">你的選擇</span>
          <strong class="text-2xl font-black tabular-nums text-[#b0761f]">{{ spectrumValue }}<small class="ml-1 text-xs text-[#77716a]">/ 100</small></strong>
        </div>
        <input v-model.number="spectrumValue" type="range" min="0" max="100" class="spec-range focus-ring mt-3 w-full accent-[#b0761f]" :disabled="voting || isSubQuestion || mySpectrumValue !== null" />
        <div class="mt-1 flex justify-between text-xs font-bold text-[#77716a]"><span>0</span><span>50</span><span>100</span></div>
        <UiButton v-if="!isSubQuestion" variant="outline" block class="mt-2" :disabled="voting" @click="withdrawSpectrumVote">{{ voting ? '重置中…' : '重置' }}</UiButton>
      </div>
    </template>

    <template v-else>
      <div v-if="!hideStats" class="flex items-end justify-between gap-4">
        <span class="text-sm font-bold text-[#6d6861]">社群中位數</span>
        <strong class="text-4xl font-black tabular-nums text-[#3157d5]">{{ Math.round(Number(topic.spectrumMedian || 0)) }}<small class="ml-1 text-sm text-[#77716a]">/ 100</small></strong>
      </div>
      <div v-if="!hideStats" class="relative mt-5 h-3 rounded-full bg-[#dfdad0]"><div class="h-full rounded-full bg-[#3157d5]" :style="{ width: `${Number(topic.spectrumMedian || 0)}%` }" /></div>
      <p v-if="topic.myVote" class="mt-4 rounded-xl border-l-4 border-[#3f7a58] bg-[#e5f1e9] p-3 text-sm font-bold">你的選擇：{{ votedChoice }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Topic } from '~/types/topic';

const props = withDefaults(defineProps<{ topic: Topic; hideStats?: boolean }>(), { hideStats: false });
const emit = defineEmits<{ refreshed: [] }>();

const api = useApi();
const auth = useAuthStore();
const { error: toastError } = useToast();

const { isVotingOpen, showResults } = useVotingGate(() => props.topic);
const isInteractionLocked = computed(() => !auth.isAuthed);
const isSubQuestion = computed(() => props.topic.parentTopicId != null);
function emitRefreshed() { emit('refreshed'); }

const voting = ref(false);
const spectrumValue = ref(50);
const votedOptionIndex = computed(() => props.topic.options.findIndex((option) => option.id === props.topic.myVote?.optionId));
const votedChoice = computed(() => props.topic.myVote?.choice || (votedOptionIndex.value >= 0 ? `選項 ${votedOptionIndex.value + 1}` : ''));
const mySpectrumValue = computed(() => {
  const value = props.topic.myVote?.spectrumValue;
  return value != null ? Number(value) : null;
});

async function submitSpectrumVote() {
  if (voting.value) return;
  voting.value = true;
  try {
    const res = await api.post<{ newBalance: string; rewardPoints: number }>(`/topics/${props.topic.id}/vote`, { spectrumValue: spectrumValue.value });
    auth.updatePoints(res.newBalance);
    emitRefreshed();
  } catch (e) {
    toastError(errorMessage(e));
  } finally {
    voting.value = false;
  }
}

async function withdrawSpectrumVote() {
  if (voting.value) return;
  voting.value = true;
  try {
    const res = await api.delete<{ success: boolean; newBalance: string }>(`/topics/${props.topic.id}/vote`);
    if (res.newBalance != null) auth.updatePoints(res.newBalance);
    emitRefreshed();
  } catch (e) {
    toastError(errorMessage(e));
  } finally {
    voting.value = false;
  }
}

watch(() => props.topic.myVote?.spectrumValue, (value) => {
  if (value != null) spectrumValue.value = Number(value);
});
</script>

<style scoped>
/* 光譜滑桿 */
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

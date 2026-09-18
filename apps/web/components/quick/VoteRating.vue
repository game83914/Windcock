<template>
  <div>
    <template v-if="!showResults && isVotingOpen">
      <p class="mb-4 text-sm font-bold text-[#6d6861]">{{ topic.topicType === 'STAR_RATING' ? '點選星數評分' : '選擇最符合你的刻度' }}</p>
      <div v-if="topic.topicType === 'STAR_RATING'" class="flex flex-wrap justify-center gap-1 sm:gap-2" role="radiogroup" aria-label="五星評分">
        <button v-for="(o, index) in topic.options" :key="o.id" type="button" role="radio" class="focus-ring p-1 text-4xl leading-none transition hover:scale-110" :class="optionValue(o, index) <= selectedRatingValue ? 'text-[#b0761f]' : 'text-[#d7d1c6]'" :aria-checked="myVoteOptionId === o.id" :aria-label="`${optionValue(o, index)} 星`" :disabled="voting || isInteractionLocked" @mouseenter="ratingHoverValue = optionValue(o, index)" @mouseleave="ratingHoverValue = null" @click="submitQuickVote(o.id)">★</button>
      </div>
      <div v-else>
        <div class="grid gap-2" :style="{ gridTemplateColumns: `repeat(${ratingScaleSize(topic)}, minmax(0, 1fr))` }" role="radiogroup" :aria-label="`${ratingScaleSize(topic)} 點量表`">
          <button v-for="(o, index) in topic.options" :key="o.id" type="button" role="radio" class="focus-ring grid aspect-square min-h-10 place-items-center rounded-xl border-2 bg-white text-sm font-black transition hover:border-[#b0761f]" :class="myVoteOptionId === o.id ? 'border-[#b0761f] text-[#8f5d14]' : 'border-[#ded7cb]'" :aria-checked="myVoteOptionId === o.id" :disabled="voting || isInteractionLocked" @click="submitQuickVote(o.id)">{{ optionValue(o, index) }}</button>
        </div>
        <div class="mt-2 flex justify-between gap-4 text-xs font-bold text-[#77716a]"><span>{{ topic.scaleMinLabel }}</span><span class="text-right">{{ topic.scaleMaxLabel }}</span></div>
      </div>
    </template>
    <template v-else>
      <div v-if="!hideStats" class="rounded-2xl bg-[#fff8ec] p-4 text-center">
        <p class="text-xs font-bold text-[#8f5d14]">平均評分</p>
        <strong class="mt-1 block text-4xl font-black tabular-nums text-[#b0761f]">{{ ratingAverage.toFixed(1) }}<small class="ml-1 text-sm text-[#77716a]">/ {{ ratingScaleSize(topic) }}</small></strong>
        <p v-if="topic.topicType === 'STAR_RATING'" class="mt-1 text-xl tracking-wider text-[#b0761f]">★★★★★</p>
        <div v-else class="mt-2 flex justify-between gap-4 text-xs font-bold text-[#77716a]"><span>{{ topic.scaleMinLabel }}</span><span class="text-right">{{ topic.scaleMaxLabel }}</span></div>
      </div>
      <div v-else class="rounded-2xl bg-[#fff8ec] p-4 text-center">
        <p class="text-xs font-bold text-[#8f5d14]">我的評分</p>
        <strong class="mt-1 block text-4xl font-black tabular-nums text-[#b0761f]">{{ myRatingValue }}<small class="ml-1 text-sm text-[#77716a]">/ {{ ratingScaleSize(topic) }}</small></strong>
        <p v-if="topic.topicType === 'STAR_RATING'" class="mt-1 text-xl tracking-wider text-[#b0761f]">{{ '★'.repeat(myRatingValue) }}{{ '☆'.repeat(Math.max(0, ratingScaleSize(topic) - myRatingValue)) }}</p>
      </div>
      <div v-if="!hideStats" class="mt-4 space-y-3">
        <button v-for="(o, index) in topic.options" :key="o.id" type="button" class="focus-ring block w-full text-left disabled:cursor-default" :disabled="voting || !isVotingOpen || !auth.canVote || isSubQuestion" @click="onChangeVote(o.id)">
          <VoteResultBar :label="topic.topicType === 'STAR_RATING' ? `${optionValue(o, index)} 星` : `${optionValue(o, index)} 分`" :percentage="optionPercentage(o, topic)" :count="o.voteCount" :highlighted="myVoteOptionId === o.id" row-class="mb-1 flex items-center justify-between gap-3 text-xs font-bold" value-class="tabular-nums" track-class="block h-2 rounded-full bg-[#dfdad0]" bar-class="block h-full rounded-full bg-[#b0761f]" />
        </button>
      </div>
      <UiButton v-if="topic.hasVoted && isVotingOpen && !isSubQuestion" variant="outline" block class="mt-4" :disabled="voting" @click="resetRating">{{ voting ? '重置中…' : '重置' }}</UiButton>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Topic } from '~/types/topic';
import { optionPercentage, optionValue, ratingScaleSize, weightedOptionAverage } from '~/utils/topic';

const props = withDefaults(defineProps<{ topic: Topic; hideStats?: boolean }>(), { hideStats: false });
const emit = defineEmits<{ refreshed: [] }>();

const auth = useAuthStore();

const { isVotingOpen, showResults } = useVotingGate(() => props.topic);
const isInteractionLocked = computed(() => !auth.isAuthed);
function emitRefreshed() { emit('refreshed'); }

const { voting, submitQuickVote, changeQuickVote, withdrawVote } = useVoteMutation(() => props.topic, emitRefreshed);
const isSubQuestion = computed(() => props.topic.parentTopicId != null);
function onChangeVote(optionId: string) {
  if (isSubQuestion.value) return;
  void changeQuickVote(optionId);
}

const ratingHoverValue = ref<number | null>(null);
async function resetRating() {
  ratingHoverValue.value = null;
  await withdrawVote();
}

const votedOptionIndex = computed(() => props.topic.options.findIndex((option) => option.id === props.topic.myVote?.optionId));
const myVoteOptionId = computed(() => props.topic.myVote?.optionId ?? (votedOptionIndex.value >= 0 ? props.topic.options[votedOptionIndex.value]?.id ?? null : null));
const ratingAverage = computed(() => weightedOptionAverage(props.topic));
const myRatingValue = computed(() => {
  const option = props.topic.options.find((o) => o.id === myVoteOptionId.value);
  const index = option ? props.topic.options.indexOf(option) : -1;
  return option && index >= 0 ? optionValue(option, index) : 0;
});
const selectedRatingValue = computed(() => {
  if (ratingHoverValue.value !== null) return ratingHoverValue.value;
  const option = props.topic.options[votedOptionIndex.value];
  return option ? optionValue(option, votedOptionIndex.value) : 0;
});

watch(() => props.topic.id, (nextId, previousId) => {
  if (nextId === previousId) return;
  ratingHoverValue.value = null;
});
</script>

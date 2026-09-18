<template>
  <div>
    <p v-if="hasVotedGame" class="mb-4 flex items-center gap-2 rounded-xl border border-[#e6cf9e] bg-[#fff8ec] px-3 py-2 text-xs font-bold text-[#8f5d14]">
      <span aria-hidden="true">✓</span> {{ isSubQuestion ? `已投「${votedChoice}」` : `已投「${votedChoice}」— 配對正確即完成換票。` }}
    </p>
    <p v-else class="text-sm leading-6 text-[#6d6861]">先點左側項目，再點右側對應的配對。配對正確即完成投票。</p>
    <div class="mt-4 grid grid-cols-2 gap-3">
      <div class="space-y-2">
        <button v-for="o in topic.options" :key="o.id" type="button" class="focus-ring relative flex min-h-12 w-full items-center rounded-xl border-2 bg-white px-3 py-2.5 text-left text-sm font-bold transition" :class="[matchedPair?.includes(o.id) ? 'match-success border-[#3f7a58] bg-[#e5f1e9] text-[#3f7a58]' : '', matchingLeftId === o.id ? 'matching-picked border-[#3157d5] bg-[#e7ecff] text-[#3157d5]' : 'border-[#ded7cb]']" :disabled="voting || matchingPending || isInteractionLocked || !!matchedPair" @click="onMatchingLeft(o.id)">
          <span class="min-w-0">{{ o.label }}</span>
          <span v-if="matchingLeftId === o.id" class="ml-2 text-[#3157d5]" aria-hidden="true">●</span>
        </button>
      </div>
      <div class="space-y-2">
        <button v-for="o in topic.options" :key="o.id" type="button" class="focus-ring flex min-h-12 w-full items-center rounded-xl border-2 border-dashed bg-white px-3 py-2.5 text-left text-sm font-bold transition" :class="[matchedPair?.includes(o.id) ? 'match-success border-[#3f7a58] bg-[#e5f1e9] text-[#3f7a58]' : '', matchingWrong === o.id ? 'match-wrong border-[#d84a36] bg-[#fbe9e5] text-[#a63222]' : '', matchingLeftId ? 'matching-ready border-[#3157d5] text-[#3157d5]' : 'border-[#cfc8bc] text-[#8b857d]']" :disabled="voting || matchingPending || isInteractionLocked || !!matchedPair || !matchingLeftId" @click="onMatchingRight(o.id)">{{ o.data?.match }}</button>
      </div>
    </div>
    <p v-if="matchingPending" class="mt-3 text-center text-xs font-bold text-[#3f7a58]">配對成功！送出中…</p>
    <div class="mt-3 text-center">
      <button v-if="matchedPair && hasVotedGame && !isSubQuestion" type="button" class="focus-ring text-xs font-bold text-[#3157d5] hover:underline" @click="resetMatching">重新配對（換票）</button>
    </div>
    <div v-if="hasVotedGame && !isSubQuestion" class="mt-3 flex justify-center">
      <UiButton variant="outline" size="sm" :disabled="voting" @click="withdrawVote">{{ voting ? '重置中…' : '重置' }}</UiButton>
    </div>
    <UiQuickMiniResults v-if="topic.hasVoted && !hideStats" :topic="topic" :changeable="!isSubQuestion" class="mt-5" />
  </div>
</template>

<script setup lang="ts">
import type { Topic, TopicOption } from '~/types/topic';

const props = withDefaults(defineProps<{ topic: Topic; hideStats?: boolean }>(), { hideStats: false });
const emit = defineEmits<{ refreshed: [] }>();

const auth = useAuthStore();
const { error: toastError } = useToast();

const isInteractionLocked = computed(() => !auth.isAuthed);
function emitRefreshed() { emit('refreshed'); }

const { voting, submitQuickVote, changeQuickVote, withdrawVote } = useVoteMutation(() => props.topic, emitRefreshed);
const isSubQuestion = computed(() => props.topic.parentTopicId != null);

const votedOptionIndex = computed(() => props.topic.options.findIndex((option) => option.id === props.topic.myVote?.optionId));
const myVoteOptionId = computed(() => props.topic.myVote?.optionId ?? (votedOptionIndex.value >= 0 ? props.topic.options[votedOptionIndex.value]?.id ?? null : null));
const votedChoice = computed(() => props.topic.myVote?.choice || (votedOptionIndex.value >= 0 ? `選項 ${votedOptionIndex.value + 1}` : ''));
const hasVotedGame = computed(() => !!props.topic.hasVoted);

const matchingLeftId = ref<string | null>(null);
const matchingPending = ref(false);
const matchedPair = ref<[string, string] | null>(null);
const matchingWrong = ref<string | null>(null);

async function submitLanded(option: TopicOption) {
  if (voting.value) return;
  if (option.id === myVoteOptionId.value) return;
  if (isSubQuestion.value && props.topic.hasVoted) return;
  if (props.topic.hasVoted) await changeQuickVote(option.id);
  else await submitQuickVote(option.id);
}

function onMatchingLeft(optionId: string) {
  if (voting.value || isInteractionLocked.value) return;
  if (isSubQuestion.value && hasVotedGame.value) return;
  matchingLeftId.value = matchingLeftId.value === optionId ? null : optionId;
}

function onMatchingRight(optionId: string) {
  if (voting.value || matchingPending.value || isInteractionLocked.value || !!matchedPair.value) return;
  const leftId = matchingLeftId.value;
  if (!leftId || leftId === optionId) return;
  const left = props.topic.options.find((option) => option.id === leftId);
  const right = props.topic.options.find((option) => option.id === optionId);
  matchingLeftId.value = null;
  if (left && right && left.label === right.data?.match) {
    matchingPending.value = true;
    matchedPair.value = [leftId, optionId];
    window.setTimeout(() => {
      matchingPending.value = false;
      void submitLanded(right);
      if (props.topic.hasVoted) resetMatching();
    }, 340);
  } else {
    matchingWrong.value = optionId;
    toastError('配對錯誤，請再試一次');
    window.setTimeout(() => {
      matchingWrong.value = null;
    }, 720);
  }
}

function resetMatching() {
  matchedPair.value = null;
  matchingLeftId.value = null;
}

watch(() => props.topic.id, (nextId, previousId) => {
  if (nextId === previousId) return;
  matchedPair.value = null;
  matchingLeftId.value = null;
});
</script>

<style scoped>
/* 連連看 */
.matching-picked,
.matching-ready {
  animation: matching-glow 1.5s ease-in-out infinite;
}
@keyframes matching-glow {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(49, 87, 213, 0.22);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(49, 87, 213, 0);
  }
}
.match-success {
  animation: match-success 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.3);
}
@keyframes match-success {
  0% {
    transform: scale(1);
  }
  45% {
    transform: scale(1.06);
  }
  100% {
    transform: scale(1);
  }
}
.match-wrong {
  animation: match-wrong 0.4s ease-in-out;
}
@keyframes match-wrong {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .matching-picked,
  .matching-ready,
  .match-success,
  .match-wrong {
    animation: none;
  }
}
</style>

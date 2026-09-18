<template>
  <div>
    <p v-if="hasVotedGame" class="mb-4 flex items-center gap-2 rounded-xl border border-[#e6cf9e] bg-[#fff8ec] px-3 py-2 text-xs font-bold text-[#8f5d14]">
      <span aria-hidden="true">✓</span> {{ isSubQuestion ? `已投「${votedChoice}」` : `已投「${votedChoice}」— 拼出另一詞即完成換票。` }}
    </p>
    <p v-else class="text-sm leading-6 text-[#6d6861]">把下方打亂的字塊依正確順序點回原詞，拼完即完成投票。</p>
    <div class="mt-4 space-y-4">
      <div v-for="o in topic.options" :key="o.id">
        <p class="mb-2 flex items-center justify-between text-xs font-bold text-[#77716a]">
          <span>進度 {{ Math.min(puzzleProgress[o.id] ?? 0, o.label.length) }} / {{ o.label.length }} · {{ o.label }}</span>
          <span class="ml-2 tracking-[0.18em]"><span class="text-[#3f7a58]">{{ '•'.repeat(Math.min(puzzleProgress[o.id] ?? 0, o.label.length)) }}</span><span class="text-[#d7d1c6]">{{ '•'.repeat(Math.max(o.label.length - (puzzleProgress[o.id] ?? 0), 0)) }}</span></span>
        </p>
        <div class="relative flex flex-wrap gap-2" :class="{ 'puzzle-row-shake': puzzleWrongRow === o.id }">
          <button v-for="(letter, index) in (puzzleShuffles[o.id] ?? o.label.split(''))" :key="index" type="button" class="focus-ring grid h-11 w-11 place-items-center rounded-xl border-2 text-lg font-black transition" :class="[puzzleDoneId === o.id ? 'tile-assemble border-[#3f7a58] bg-[#e5f1e9] text-[#3f7a58]' : '', puzzleJustIndex?.optionId === o.id && puzzleJustIndex?.index === index ? 'tile-pop border-[#3f7a58] bg-[#e5f1e9] text-[#3f7a58]' : (puzzleProgress[o.id] ?? 0) > 0 ? 'border-[#3157d5] bg-[#e7ecff] text-[#3157d5]' : 'border-[#ded7cb] bg-white']" :style="puzzleDoneId === o.id ? { animationDelay: `${index * 55}ms` } : undefined" :disabled="voting || isInteractionLocked || puzzleDoneId === o.id || (isSubQuestion && hasVotedGame)" @click="onPuzzleTile(o.id, index, letter)">{{ letter }}</button>
          <UiConfetti v-if="puzzleDoneId === o.id" :burst-key="`puzzle-${o.id}`" :count="10" />
        </div>
      </div>
    </div>
    <div v-if="hasVotedGame && !isSubQuestion" class="mt-3 flex justify-center">
      <UiButton variant="outline" size="sm" :disabled="voting" @click="withdrawVote">{{ voting ? '重置中…' : '重置' }}</UiButton>
    </div>
    <UiQuickMiniResults v-if="topic.hasVoted && !hideStats" :topic="topic" :changeable="!isSubQuestion" class="mt-5" />
  </div>
</template>

<script setup lang="ts">
import type { Topic, TopicOption } from '~/types/topic';
import { shuffle } from '~/utils/random';

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

const puzzleProgress = reactive<Record<string, number>>({});
const puzzleShuffles = shallowReactive<Record<string, string[]>>({});
const puzzleJustIndex = ref<{ optionId: string; index: number } | null>(null);
const puzzleWrongRow = ref<string | null>(null);
const puzzleDoneId = ref<string | null>(null);

function preparePuzzle() {
  for (const option of props.topic.options) {
    if (!puzzleShuffles[option.id]) puzzleShuffles[option.id] = shuffle([...option.label]);
  }
}

async function submitLanded(option: TopicOption) {
  if (voting.value) return;
  if (option.id === myVoteOptionId.value) return;
  if (isSubQuestion.value && props.topic.hasVoted) return;
  if (props.topic.hasVoted) await changeQuickVote(option.id);
  else await submitQuickVote(option.id);
}

function onPuzzleTile(optionId: string, index: number, letter: string) {
  if (voting.value || isInteractionLocked.value || puzzleDoneId.value === optionId) return;
  if (isSubQuestion.value && hasVotedGame.value) return;
  const option = props.topic.options.find((item) => item.id === optionId);
  if (!option) return;
  const progress = puzzleProgress[optionId] ?? 0;
  if (letter === option.label[progress]) {
    puzzleProgress[optionId] = progress + 1;
    puzzleJustIndex.value = { optionId, index };
    window.setTimeout(() => {
      if (puzzleJustIndex.value?.optionId === optionId && puzzleJustIndex.value?.index === index) puzzleJustIndex.value = null;
    }, 320);
    if (puzzleProgress[optionId] >= option.label.length) {
      for (const key of Object.keys(puzzleProgress)) if (key !== optionId) delete puzzleProgress[key];
      puzzleDoneId.value = optionId;
      window.setTimeout(() => void submitLanded(option), 380);
    }
  } else {
    puzzleProgress[optionId] = 0;
    puzzleWrongRow.value = optionId;
    toastError('順序不對，拼圖已打亂重來');
    window.setTimeout(() => {
      puzzleWrongRow.value = null;
    }, 760);
  }
}

watch(() => props.topic.id, (nextId, previousId) => {
  if (nextId === previousId) return;
  puzzleDoneId.value = null;
  for (const key of Object.keys(puzzleProgress)) delete puzzleProgress[key];
  preparePuzzle();
});

onMounted(() => {
  preparePuzzle();
});
</script>

<style scoped>
/* 拼圖 */
.tile-pop {
  animation: tile-pop 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.4);
}
@keyframes tile-pop {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.18);
  }
  100% {
    transform: scale(1);
  }
}
.tile-assemble {
  animation: tile-assemble 0.45s ease-out both;
}
@keyframes tile-assemble {
  from {
    transform: scale(1.25) rotate(4deg);
    box-shadow: 0 0 0 6px rgba(63, 122, 88, 0.25);
  }
  to {
    transform: scale(1) rotate(0deg);
    box-shadow: 0 0 0 0 rgba(63, 122, 88, 0);
  }
}
.puzzle-row-shake {
  animation: puzzle-row-shake 0.4s ease-in-out;
}
@keyframes puzzle-row-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tile-pop,
  .tile-assemble,
  .puzzle-row-shake {
    animation: none;
  }
}
</style>

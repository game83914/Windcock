<template>
  <div>
    <div>
      <button
        type="button"
        class="focus-ring relative mx-auto block w-full max-w-sm overflow-hidden rounded-xl text-left transition hover:brightness-[0.98] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80"
        :disabled="lotteryState === 'shaking' || lotteryState === 'drawing' || voting || isInteractionLocked || (hasVotedGame && isSubQuestion)"
        :aria-label="hasVotedGame ? '重置搖獎結果' : '點擊搖獎箱開始搖獎'"
        @click="handleLotteryClick"
      >
        <div class="lottery-shell relative">
          <div class="lottery-lid relative flex items-center justify-between px-4 py-2">
            <span class="lottery-lid-knob" aria-hidden="true" />
            <span class="text-[10px] font-black tracking-[0.18em] text-[#8f5d14]">搖獎箱</span>
            <span class="lottery-lid-knob" aria-hidden="true" />
          </div>
          <div class="relative mx-auto flex h-40 items-center justify-center px-3" :class="{ 'lottery-shake': lotteryState === 'shaking' }">
            <span v-if="hasVotedGame" class="flex flex-col items-center gap-3 text-center">
              <span class="text-[15px] font-black leading-snug text-[#8f5d14]">抽到了「{{ votedChoice }}」</span>
              <span class="grid size-14 place-items-center rounded-full border-2 border-[#ded7cb] bg-[#fffdf8] text-[#8f5d14] shadow-sm" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <path d="M3 4v6h6" />
                </svg>
              </span>
            </span>
            <span v-else-if="lotteryState === 'idle'" class="text-xs font-black tracking-[0.12em] text-[#8f5d14]">點擊箱體搖獎</span>
            <span v-else-if="lotteryState === 'shaking'" class="text-xs font-black tracking-[0.12em] text-[#8f5d14]">搖獎中…</span>
            <span v-else-if="lotteryState === 'drawing'" class="text-xs font-black tracking-[0.12em] text-[#8f5d14]">開獎中…</span>
            <span v-else class="text-xs font-black tracking-[0.12em] text-[#8f5d14]">抽籤完成</span>
            <span v-if="lotteryState === 'drawing'" class="lottery-light-beam pointer-events-none absolute left-1/2 top-10 z-10 -translate-x-1/2" aria-hidden="true" />
          </div>
        </div>
        <UiConfetti v-if="lotteryState === 'result'" :burst-key="`lottery-${lotteryConfettiKey}`" :count="14" />
      </button>
    </div>
    <UiQuickMiniResults v-if="topic.hasVoted && !hideStats" :topic="topic" :changeable="!isSubQuestion" class="mt-5" />
  </div>
</template>

<script setup lang="ts">
import { errorMessage } from '~/composables/useApi';
import type { Topic } from '~/types/topic';

interface GameDrawResponse {
  success: boolean;
  isNew: boolean;
  result: {
    optionId: string;
    label: string;
  };
  newBalance: string;
}

const props = withDefaults(defineProps<{ topic: Topic; hideStats?: boolean }>(), { hideStats: false });
const emit = defineEmits<{ refreshed: [] }>();

const auth = useAuthStore();
const api = useApi();
const { error: toastError } = useToast();

const isInteractionLocked = computed(() => !auth.isAuthed);
function emitRefreshed() { emit('refreshed'); }

const { voting, withdrawVote } = useVoteMutation(() => props.topic, emitRefreshed);
const isSubQuestion = computed(() => props.topic.parentTopicId != null);

const votedOptionIndex = computed(() => props.topic.options.findIndex((option) => option.id === props.topic.myVote?.optionId));
const votedChoice = computed(() => props.topic.myVote?.choice || (votedOptionIndex.value >= 0 ? `選項 ${votedOptionIndex.value + 1}` : ''));
const hasVotedGame = computed(() => !!props.topic.hasVoted);

const lotteryState = ref<'idle' | 'shaking' | 'drawing' | 'result'>('idle');
const lotteryConfettiKey = ref('');

async function handleLotteryClick() {
  if (!hasVotedGame.value) {
    await shakeLottery();
    return;
  }
  if (isSubQuestion.value) return;
  await resetLottery();
}

async function resetLottery() {
  const withdrawn = await withdrawVote();
  if (!withdrawn) return;
  lotteryState.value = 'idle';
  lotteryConfettiKey.value = '';
}

async function shakeLottery() {
  const options = props.topic.options;
  const topicId = props.topic.id;
  if (!options.length || lotteryState.value === 'shaking' || lotteryState.value === 'drawing' || voting.value || isInteractionLocked.value || hasVotedGame.value) return;
  lotteryState.value = 'shaking';
  try {
    // 結果由伺服器端 CSPRNG 決定，搖獎只是配樂
    const result = await api.post<GameDrawResponse>(`/topics/${topicId}/game-draw`);
    if (props.topic.id !== topicId) return;
    const option = props.topic.options.find((item) => item.id === result.result.optionId);
    if (!option) throw new Error('無法識別抽獎結果');
    auth.updatePoints(result.newBalance);
    const start = Date.now();
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, 1080 - (Date.now() - start))));
    if (props.topic.id !== topicId) return;
    lotteryState.value = 'drawing';
    await new Promise((resolve) => setTimeout(resolve, 520));
    if (props.topic.id !== topicId) return;
    lotteryState.value = 'result';
    lotteryConfettiKey.value = `${option.id}-${Date.now()}`;
    emitRefreshed();
  } catch (error) {
    if (props.topic.id !== topicId) return;
    lotteryState.value = 'idle';
    const message = errorMessage(error);
    toastError(message);
  }
}

watch(() => props.topic.id, (nextId, previousId) => {
  if (nextId === previousId) return;
  lotteryState.value = 'idle';
});
</script>

<style scoped>
.lottery-shake {
  animation: lottery-shake 0.4s ease-in-out infinite;
}
@keyframes lottery-shake {
  0%,
  100% {
    transform: translate(0, 0) rotate(0deg);
  }
  25% {
    transform: translate(-3px, 2px) rotate(-2deg);
  }
  50% {
    transform: translate(3px, -2px) rotate(2deg);
  }
  75% {
    transform: translate(-2px, -3px) rotate(1deg);
  }
}

/* 搖獎箱 */
.lottery-lid {
  background: linear-gradient(180deg, #c9a15e, #a8792f);
  border-radius: 10px 10px 0 0;
}
.lottery-lid-knob {
  display: block;
  height: 8px;
  width: 26px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.35);
}
.lottery-shell {
  background: linear-gradient(180deg, #fffdf8, #f3e7cf);
  border: 1px solid #e0c9a0;
  border-radius: 0 0 14px 14px;
  box-shadow: inset 0 -6px 14px -8px rgba(143, 93, 20, 0.35);
}
.lottery-light-beam {
  width: 2px;
  height: 84px;
  background: linear-gradient(180deg, rgba(255, 241, 201, 0), rgba(255, 220, 140, 0.85), rgba(255, 241, 201, 0));
  animation: beam-waver 0.5s ease-in-out infinite alternate;
}
@keyframes beam-waver {
  from {
    opacity: 0.55;
    transform: translateX(-50%) scaleY(1);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) scaleY(1.08);
  }
}
@media (prefers-reduced-motion: reduce) {
  .lottery-shake,
  .lottery-light-beam {
    animation: none;
  }
}
</style>

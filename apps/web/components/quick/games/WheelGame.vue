<template>
  <div>
    <p v-if="hasVotedGame" class="mb-4 text-center text-[15px] font-black leading-snug text-[#8f5d14]">你轉到了「{{ votedChoice }}」</p>
    <div class="relative mx-auto w-full max-w-72">
      <span class="wheel-pointer absolute left-1/2 top-0 z-10 -ml-[10px]" aria-hidden="true" />
      <div class="relative">
        <svg viewBox="0 0 200 200" class="block w-full drop-shadow-sm" :class="{ 'cursor-wait': wheelSpinning }" :style="wheelSpinning ? { transform: `rotate(${wheelDeg}deg)`, transition: 'transform 2.8s cubic-bezier(0.2, 0.7, 0.2, 1)' } : { transform: `rotate(${wheelDeg}deg)` }" role="img" aria-label="轉盤">
          <g v-for="(o, index) in topic.options" :key="o.id">
            <path :d="wheelArc(index)" :fill="wheelColors[index % wheelColors.length]" stroke="#fffaf0" stroke-width="1.5" :class="{ 'wheel-hit': (wheelHitIndex ?? votedOptionIndex) === index }" />
            <text :x="wheelLabel(index).x" :y="wheelLabel(index).y" :transform="`rotate(${wheelLabel(index).rotate} ${wheelLabel(index).x} ${wheelLabel(index).y})`" text-anchor="middle" font-size="12" font-weight="700" fill="#fffaf0">{{ o.label }}</text>
          </g>
        </svg>
        <button
          type="button"
          class="wheel-hub focus-ring absolute left-1/2 top-1/2 z-20 grid aspect-square w-[21%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-[#ded7cb] text-sm font-black text-[#8f5d14] shadow-sm transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-75"
          :class="{ 'hub-pulse': !wheelSpinning && !voting }"
          :disabled="wheelSpinning || voting || isInteractionLocked || (hasVotedGame && isSubQuestion)"
          :aria-label="hasVotedGame ? '重置轉盤結果' : '轉動轉盤'"
          @click="handleGoClick"
        >
          <span v-if="!hasVotedGame">GO</span>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v6h6" />
          </svg>
        </button>
        <span v-if="wheelSpinning" class="wheel-sheen pointer-events-none absolute inset-0 rounded-full" aria-hidden="true" />
        <UiConfetti v-if="wheelHitIndex !== null" :burst-key="`wheel-${wheelConfettiKey}`" :count="14" />
      </div>
    </div>
    <UiQuickMiniResults v-if="topic.hasVoted && !hideStats" :topic="topic" :changeable="!isSubQuestion" class="mt-5" />
  </div>
</template>

<script setup lang="ts">
import { errorMessage } from '~/composables/useApi';
import { wheelSegmentRotation } from '~/utils/wheel';
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

const wheelDeg = ref(0);
const wheelSpinning = ref(false);
const wheelHitIndex = ref<number | null>(null);
const wheelConfettiKey = ref('');
const userSpunOnce = ref(false);
const wheelColors = ['#b0761f', '#3157d5', '#3f7a58', '#9a6a12', '#7c3aed', '#c2410c', '#0e7490', '#be185d'];

async function handleGoClick() {
  if (!hasVotedGame.value) {
    await spinWheel();
    return;
  }
  if (isSubQuestion.value) return;
  const withdrawn = await withdrawVote();
  if (!withdrawn) return;
  wheelDeg.value = 0;
  wheelHitIndex.value = null;
  wheelConfettiKey.value = '';
}

function polar(radius: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [100 + radius * Math.cos(rad), 100 + radius * Math.sin(rad)];
}

function wheelArc(index: number): string {
  const count = props.topic.options.length;
  const size = 360 / Math.max(count, 1);
  const [x0, y0] = polar(98, index * size);
  const [x1, y1] = polar(98, index * size + size);
  return `M100 100 L${x0.toFixed(2)} ${y0.toFixed(2)} A98 98 0 ${size > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

function wheelLabel(index: number) {
  const count = props.topic.options.length;
  const size = 360 / Math.max(count, 1);
  const mid = index * size + size / 2;
  const [x, y] = polar(62, mid);
  return { x, y, rotate: mid };
}

async function spinWheel() {
  const options = props.topic.options;
  const topicId = props.topic.id;
  if (!options.length || wheelSpinning.value || voting.value || isInteractionLocked.value) return;
  wheelSpinning.value = true;
  wheelHitIndex.value = null;
  try {
    // 落點由伺服器端 CSPRNG 決定，轉動角度只是呈現結果
    const result = await api.post<GameDrawResponse>(`/topics/${topicId}/game-draw`);
    if (props.topic.id !== topicId) return;
    const idx = props.topic.options.findIndex((item) => item.id === result.result.optionId);
    if (idx < 0) throw new Error('無法辨識轉盤結果');
    auth.updatePoints(result.newBalance);
    // jitter 僅為視覺微調，落點區段已由伺服器決定
    const desired = wheelSegmentRotation(idx, options.length, Math.random());
    const current = ((wheelDeg.value % 360) + 360) % 360;
    const delta = ((desired - current + 360) % 360) + 1080;
    userSpunOnce.value = true;
    wheelDeg.value += delta;
    await new Promise((resolve) => setTimeout(resolve, 2800));
    if (props.topic.id !== topicId) return;
    wheelSpinning.value = false;
    wheelHitIndex.value = idx;
    wheelConfettiKey.value = `${options[idx].id}-${Date.now()}`;
    emitRefreshed();
  } catch (error) {
    if (props.topic.id !== topicId) return;
    wheelSpinning.value = false;
    const message = errorMessage(error);
    toastError(message);
  }
}

watch(() => props.topic.myVote?.optionId, (optionId) => {
  if (userSpunOnce.value || !optionId) return;
  // 重新進入頁面時，讓指標指向伺服器決定的落點
  const idx = props.topic.options.findIndex((option) => option.id === optionId);
  if (idx >= 0) wheelDeg.value = wheelSegmentRotation(idx, props.topic.options.length, 0.5);
}, { immediate: true });

watch(() => props.topic.id, (nextId, previousId) => {
  if (nextId === previousId) return;
  wheelDeg.value = 0;
  wheelHitIndex.value = null;
  userSpunOnce.value = false;
});
</script>

<style scoped>
/* 轉盤 */
.wheel-pointer {
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 16px solid #d84a36;
  filter: drop-shadow(0 2px 3px rgba(23, 23, 23, 0.35));
  animation: pointer-bob 1.8s ease-in-out infinite;
  transform-origin: 50% 0;
}
@keyframes pointer-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(5px);
  }
}
.wheel-hub {
  background: radial-gradient(circle at 50% 42%, #fffdf8, #ebd9b8);
  transition: filter 0.25s ease;
}
.hub-pulse {
  animation: hub-pulse 2.4s ease-in-out infinite;
}
@keyframes hub-pulse {
  0%,
  100% {
    filter: drop-shadow(0 0 2px rgba(176, 118, 31, 0.25));
  }
  50% {
    filter: drop-shadow(0 0 9px rgba(176, 118, 31, 0.55));
  }
}
.wheel-sheen {
  background: conic-gradient(from 0deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0) 12%, rgba(255, 255, 255, 0) 88%, rgba(255, 255, 255, 0.4));
  animation: wheel-sheen 1.1s linear infinite;
}
@keyframes wheel-sheen {
  to {
    transform: rotate(360deg);
  }
}
.wheel-hit {
  animation: wheel-hit-flash 0.7s ease 2;
}
@keyframes wheel-hit-flash {
  0%,
  100% {
    stroke: #fffaf0;
    stroke-width: 1.5;
    filter: none;
  }
  45% {
    stroke: #ffffff;
    stroke-width: 3.5;
    filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.95));
  }
}

@media (prefers-reduced-motion: reduce) {
  .wheel-pointer,
  .hub-pulse,
  .wheel-sheen,
  .wheel-hit {
    animation: none;
  }
}
</style>

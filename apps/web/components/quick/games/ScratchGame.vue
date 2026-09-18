<template>
  <div>
    <p v-if="!hasVotedGame" class="text-sm leading-6 text-[#6d6861]">在卡片上按住並來回刮開，第一次觸碰時會決定你的隨機結果。</p>

    <div class="mt-4">
      <div class="scratch-card relative mx-auto aspect-[8/5] w-full max-w-lg select-none overflow-hidden rounded-3xl border-2 border-[#d6b16d] bg-[#fff8ec] shadow-[0_12px_35px_rgba(128,84,16,0.16)]">
        <div class="absolute inset-0 grid place-items-center overflow-hidden bg-gradient-to-br from-[#fff8dc] via-[#f8e5b8] to-[#e2b65d]">
          <img v-if="revealImageUrl" :src="revealImageUrl" alt="" class="absolute inset-0 h-full w-full object-cover" />
          <div v-else class="scratch-reveal-fallback absolute inset-0 grid place-items-center text-[#70470d]" aria-hidden="true">
            <span class="grid size-24 place-items-center rounded-full border-4 border-current/30 bg-white/35 text-5xl font-black">★</span>
          </div>
          <div v-if="drawing && !selectedOption" class="absolute inset-0 grid place-items-center bg-[#fff8ec]/75 text-sm font-black text-[#8f5d14]">正在決定結果…</div>
          <strong v-if="showText && selectedOption" class="absolute inset-x-5 bottom-5 rounded-2xl bg-black/65 px-4 py-3 text-center text-xl font-black text-white shadow-lg sm:text-2xl">{{ selectedOption.label }}</strong>
        </div>

        <canvas
          v-show="!revealed"
          ref="canvasEl"
          class="absolute inset-0 h-full w-full touch-none"
          :class="disabled ? 'cursor-not-allowed' : 'cursor-crosshair'"
          role="img"
          aria-label="刮刮卡封面，按住並移動以刮開"
          :aria-disabled="disabled"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @lostpointercapture="onPointerUp"
        />
        <UiConfetti v-if="confettiKey" :burst-key="confettiKey" :count="22" />
      </div>
    </div>

    <p v-if="drawError" class="mt-3 rounded-xl border-l-4 border-[#d84a36] bg-[#fbe9e5] p-3 text-xs font-bold text-[#a63222]">{{ drawError }}</p>
    <UiButton v-if="hasVotedGame && !isSubQuestion" variant="outline" block class="mt-2" :disabled="voting || drawing" @click="resetAndReroll">{{ voting ? '重置中…' : '重置' }}</UiButton>
    <UiQuickMiniResults v-if="topic.hasVoted && !hideStats" :topic="topic" :changeable="false" class="mt-5" />
  </div>
</template>

<script setup lang="ts">
import { errorMessage } from '~/composables/useApi';
import type { Topic, TopicOption } from '~/types/topic';
import UiConfetti from '../../ui/UiConfetti.vue';
import UiQuickMiniResults from '../../ui/UiQuickMiniResults.vue';

interface ScratchDrawResponse {
  success: boolean;
  isNew: boolean;
  result: {
    optionId: string;
    label: string;
    revealImageUrl: string | null;
    showText: boolean;
  };
  newBalance: string;
}

const props = withDefaults(defineProps<{ topic: Topic; hideStats?: boolean; disabled?: boolean }>(), { hideStats: false, disabled: false });
const emit = defineEmits<{ refreshed: [] }>();

const GRID_COLUMNS = 48;
const GRID_ROWS = 30;
const COMPLETION_THRESHOLD = 0.7;
// 筆刷半徑以刮刮卡寬度為準，避免不同版面手感不一致
const BRUSH_RADIUS_RATIO = 0.045;

function brushRadiusFor(cardWidth: number) {
  return Math.max(8, cardWidth * BRUSH_RADIUS_RATIO);
}

const api = useApi();
const auth = useAuthStore();
const { error: toastError } = useToast();
const canvasEl = shallowRef<HTMLCanvasElement | null>(null);
const selectedOption = ref<TopicOption | null>(null);
const responseRevealImageUrl = ref<string | null>(null);
const responseShowText = ref<boolean | null>(null);
const drawing = ref(false);
const revealed = ref(false);
const coverage = ref(0);
const drawError = ref('');
const confettiKey = ref('');
const coveredCells = new Uint8Array(GRID_COLUMNS * GRID_ROWS);
let coveredCount = 0;
let activePointerId: number | null = null;
let lastPoint: { x: number; y: number } | null = null;
let resizeObserver: ResizeObserver | null = null;
let canvasGeneration = 0;
let drawGeneration = 0;

const isSubQuestion = computed(() => props.topic.parentTopicId != null);
const firstOptionData = computed(() => props.topic.options[0]?.data);
const coverImageUrl = computed(() => firstOptionData.value?.scratchCoverImageUrl ?? null);
const showText = computed(() => responseShowText.value ?? firstOptionData.value?.scratchShowText !== false);
const revealImageUrl = computed(() => {
  if (responseRevealImageUrl.value) return responseRevealImageUrl.value;
  return selectedOption.value?.data?.scratchRevealImageUrl ?? null;
});
const hasVotedGame = computed(() => props.topic.hasVoted || revealed.value);

function persistedOption(): TopicOption | null {
  const optionId = props.topic.myVote?.optionId;
  if (optionId) return props.topic.options.find((option) => option.id === optionId) ?? null;
  const choice = props.topic.myVote?.choice;
  return choice ? props.topic.options.find((option) => option.label === choice) ?? null : null;
}

function syncPersistedResult() {
  const option = persistedOption();
  if (!props.topic.hasVoted || !option) return;
  selectedOption.value = option;
  revealed.value = true;
}

function drawFallbackCover(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#8d6117');
  gradient.addColorStop(0.5, '#d2ad61');
  gradient.addColorStop(1, '#9b6711');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  for (let offset = -height; offset < width + height; offset += 18) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset - height, height);
    ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.max(20, Math.min(width / 9, 38))}px sans-serif`;
  ctx.fillText('SCRATCH', width / 2, height / 2 - 10);
  ctx.font = `700 ${Math.max(11, Math.min(width / 28, 15))}px sans-serif`;
  ctx.fillText('刮開揭曉', width / 2, height / 2 + 25);
}

function eraseCoveredCells(ctx: CanvasRenderingContext2D, width: number, height: number, brushRadius: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let column = 0; column < GRID_COLUMNS; column++) {
      if (!coveredCells[row * GRID_COLUMNS + column]) continue;
      ctx.beginPath();
      ctx.arc((column + 0.5) * width / GRID_COLUMNS, (row + 0.5) * height / GRID_ROWS, brushRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function initializeCanvas() {
  const generation = ++canvasGeneration;
  const canvas = canvasEl.value;
  if (!canvas || revealed.value) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawFallbackCover(ctx, rect.width, rect.height);
  eraseCoveredCells(ctx, rect.width, rect.height, brushRadiusFor(rect.width));

  if (coverImageUrl.value) {
    const image = new Image();
    image.onload = () => {
      if (generation !== canvasGeneration || revealed.value || canvasEl.value !== canvas) return;
      ctx.globalCompositeOperation = 'source-over';
      const scale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      ctx.drawImage(image, (rect.width - width) / 2, (rect.height - height) / 2, width, height);
      eraseCoveredCells(ctx, rect.width, rect.height, brushRadiusFor(rect.width));
    };
    image.src = coverImageUrl.value;
  }
}

function canvasPoint(event: PointerEvent) {
  const rect = canvasEl.value?.getBoundingClientRect();
  if (!rect) return null;
  return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width, height: rect.height };
}

function markCoverage(x: number, y: number, width: number, height: number, brushRadius: number) {
  const radiusX = Math.ceil(brushRadius / width * GRID_COLUMNS);
  const radiusY = Math.ceil(brushRadius / height * GRID_ROWS);
  const centerColumn = Math.floor(x / width * GRID_COLUMNS);
  const centerRow = Math.floor(y / height * GRID_ROWS);
  for (let row = Math.max(0, centerRow - radiusY); row <= Math.min(GRID_ROWS - 1, centerRow + radiusY); row++) {
    for (let column = Math.max(0, centerColumn - radiusX); column <= Math.min(GRID_COLUMNS - 1, centerColumn + radiusX); column++) {
      const cellX = (column + 0.5) * width / GRID_COLUMNS;
      const cellY = (row + 0.5) * height / GRID_ROWS;
      if (Math.hypot(cellX - x, cellY - y) > brushRadius) continue;
      const index = row * GRID_COLUMNS + column;
      if (coveredCells[index]) continue;
      coveredCells[index] = 1;
      coveredCount++;
    }
  }
  coverage.value = coveredCount / coveredCells.length;
  if (coverage.value >= COMPLETION_THRESHOLD) finishReveal();
}

function scratchTo(event: PointerEvent) {
  const canvas = canvasEl.value;
  const point = canvasPoint(event);
  const ctx = canvas?.getContext('2d');
  if (!canvas || !point || !ctx) return;
  const from = lastPoint ?? point;
  const brushRadius = brushRadiusFor(point.width);
  const distance = Math.hypot(point.x - from.x, point.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / (brushRadius / 2)));
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let step = 0; step <= steps; step++) {
    const ratio = step / steps;
    const x = from.x + (point.x - from.x) * ratio;
    const y = from.y + (point.y - from.y) * ratio;
    ctx.beginPath();
    ctx.arc(x, y, brushRadius, 0, Math.PI * 2);
    ctx.fill();
    markCoverage(x, y, point.width, point.height, brushRadius);
  }
  ctx.restore();
  lastPoint = point;
}

async function requestDraw() {
  if (drawing.value || selectedOption.value || props.disabled) return;
  const topicId = props.topic.id;
  const generation = ++drawGeneration;
  drawing.value = true;
  drawError.value = '';
  try {
    const result = await api.post<ScratchDrawResponse>(`/topics/${topicId}/scratch-draw`);
    if (generation !== drawGeneration || props.topic.id !== topicId) return;
    const option = props.topic.options.find((item) => item.id === result.result.optionId)
      ?? props.topic.options.find((item) => item.label === result.result.label);
    if (!option) throw new Error('無法識別刮刮樂結果');
    selectedOption.value = option;
    responseRevealImageUrl.value = result.result.revealImageUrl;
    responseShowText.value = result.result.showText;
    auth.updatePoints(result.newBalance);
    if (coverage.value >= COMPLETION_THRESHOLD) finishReveal();
  } catch (error) {
    if (generation !== drawGeneration || props.topic.id !== topicId) return;
    const message = errorMessage(error);
    drawError.value = message;
    toastError(message);
  } finally {
    if (generation === drawGeneration) drawing.value = false;
  }
}

function finishReveal() {
  if (revealed.value || coverage.value < COMPLETION_THRESHOLD || !selectedOption.value) return;
  revealed.value = true;
  confettiKey.value = `scratch-${props.topic.id}-${selectedOption.value.id}-${Date.now()}`;
  activePointerId = null;
  emit('refreshed');
}

function onPointerDown(event: PointerEvent) {
  if (revealed.value || props.disabled || activePointerId != null) return;
  activePointerId = event.pointerId;
  canvasEl.value?.setPointerCapture(event.pointerId);
  lastPoint = null;
  void requestDraw();
  scratchTo(event);
}

function onPointerMove(event: PointerEvent) {
  if (event.pointerId !== activePointerId || revealed.value) return;
  scratchTo(event);
}

function onPointerUp(event: PointerEvent) {
  if (event.pointerId !== activePointerId) return;
  if (canvasEl.value?.hasPointerCapture(event.pointerId)) canvasEl.value.releasePointerCapture(event.pointerId);
  activePointerId = null;
  lastPoint = null;
}

function clearLocalResult() {
  drawGeneration++;
  canvasGeneration++;
  drawing.value = false;
  if (activePointerId != null && canvasEl.value?.hasPointerCapture(activePointerId)) {
    canvasEl.value.releasePointerCapture(activePointerId);
  }
  activePointerId = null;
  lastPoint = null;
  selectedOption.value = null;
  responseRevealImageUrl.value = null;
  responseShowText.value = null;
  revealed.value = false;
  coverage.value = 0;
  coveredCount = 0;
  coveredCells.fill(0);
  confettiKey.value = '';
  drawError.value = '';
  nextTick(initializeCanvas);
}

function emitRefreshed() {
  emit('refreshed');
}

const { voting, withdrawVote } = useVoteMutation(() => props.topic, emitRefreshed);

async function resetAndReroll() {
  if (isSubQuestion.value || drawing.value) return;
  if (await withdrawVote()) clearLocalResult();
}

watch(() => [props.topic.id, props.topic.hasVoted, props.topic.myVote?.optionId] as const, (current, previous) => {
  const topicId = current[0];
  const previousTopicId = previous?.[0];
  if (topicId !== previousTopicId || (previous?.[1] && !current[1])) clearLocalResult();
  syncPersistedResult();
}, { immediate: true });

watch(coverImageUrl, () => nextTick(initializeCanvas));

onMounted(() => {
  nextTick(initializeCanvas);
  if (canvasEl.value) {
    resizeObserver = new ResizeObserver(initializeCanvas);
    resizeObserver.observe(canvasEl.value);
  }
});

onUnmounted(() => {
  drawGeneration++;
  canvasGeneration++;
  resizeObserver?.disconnect();
});
</script>

<style scoped>
.scratch-card {
  isolation: isolate;
}

.scratch-reveal-fallback {
  background-image:
    radial-gradient(circle at 20% 25%, rgba(255, 255, 255, 0.75) 0 3px, transparent 4px),
    radial-gradient(circle at 75% 70%, rgba(128, 84, 16, 0.18) 0 4px, transparent 5px);
  background-size: 44px 44px, 58px 58px;
}
</style>

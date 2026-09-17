<template>
  <div>
    <UiImageLightbox v-model:src="lightboxSrc" />
    <div v-if="!participationReady" class="h-24 animate-pulse rounded-xl bg-[#eee9e0]" />

    <div v-else-if="!auth.isAuthed" class="space-y-3 rounded-xl border border-[#e6cf9e] bg-[#fff8ec] p-5 text-center">
      <p class="text-sm font-black text-[#8f5d14]">登入即可玩「二選一排名賽」</p>
      <p class="text-xs leading-5 text-[#8b857d]">逐對二選一，完成後會揭曉你的完整排名，並與社群總排名一起顯示。</p>
      <UiButton to="/login" variant="quick" class="mt-1">門號登入開始排名</UiButton>
    </div>

    <div v-else-if="!auth.canVote" class="rounded-xl border border-[#e6cf9e] bg-[#fff8ec] p-4 text-sm font-bold text-[#8f5d14]">{{ VOTE_IDENTITY_NOTICE }}</div>

    <template v-else>
      <template v-if="!done">
        <div v-if="!started" class="space-y-3 rounded-xl border border-[#e6cf9e] bg-[#fff8ec] p-5 text-center">
          <p class="text-sm font-black text-[#8f5d14]">二選一排名賽</p>
          <p class="text-xs leading-5 text-[#8b857d]">逐對二選一，最多約 {{ maxComparisons }} 次比較就能排出完整個人名次，並與社群總排名一起顯示。</p>
          <UiButton variant="quick" class="mt-1" @click="start">開始排名</UiButton>
        </div>

        <template v-else>
          <div class="mb-4">
            <div class="flex items-center justify-between text-xs font-bold text-[#6d6861]">
              <span>逐對對戰</span>
              <span class="tabular-nums">{{ comparisonsCount }} 次比較</span>
            </div>
            <div class="mt-2 h-1.5 rounded-full bg-[#f0e6d2]">
              <div class="h-full rounded-full bg-[#b0761f] transition-[width] duration-300" :style="{ width: `${progressPercent}%` }" />
            </div>
            <p class="mt-2 text-xs text-[#8b857d]">最多約 {{ maxComparisons }} 次比較就能排出完整名次</p>
          </div>

          <div v-if="leftOption && rightOption" class="grid grid-cols-2 gap-3">
            <div v-for="(option, side) in { left: leftOption, right: rightOption }" :key="side" class="group relative aspect-square overflow-hidden rounded-2xl border-2 border-[#e0c9a0] bg-white transition" :class="{ 'border-[#b0761f]': side === 'left' }">
              <img :src="option.data?.imageUrl" :alt="option.label" class="absolute inset-0 h-full w-full object-cover" @click.stop="openLightbox(option.data?.imageUrl ?? '')" />
              <span class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-10 text-xs font-black text-white">{{ option.label }}</span>
              <button type="button" class="focus-ring absolute inset-0 bg-black/0 transition hover:bg-black/25" :disabled="submitting" :aria-label="`選 ${option.label}`" @click="chooseSide(side)"><span class="pointer-events-none grid h-full w-full place-items-center text-sm font-black text-transparent transition group-hover:text-white">選這個</span></button>
              <button type="button" class="focus-ring absolute left-1.5 top-1.5 z-10 grid size-7 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/70" aria-label="放大檢視圖片" @click.stop="openLightbox(option.data?.imageUrl ?? '')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              </button>
            </div>
          </div>

          <p class="mt-3 text-center text-xs leading-5 text-[#8b857d]">兩張圖片哪個更勝一籌？連續點選直到排出完整名次。比較中立場重複沒關係，系統會逐步收斂。</p>
        </template>
      </template>

      <template v-else>
        <div class="space-y-5">
          <section>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-black text-[#6d6861]">你的完整排名</h3>
              <span v-if="submittedRanking.length" class="text-xs tabular-nums text-[#8b857d]">{{ submittedRanking.length }} 名 · {{ comparisonsCount }} 次比較</span>
            </div>
            <ol class="mt-3 space-y-2">
              <li v-for="(option, index) in rankedOptions" :key="option.id" class="flex items-center gap-3 rounded-xl border border-[#ded7cb] bg-white p-2.5">
                <span class="grid size-8 shrink-0 place-items-center rounded-full text-xs font-black" :class="rankBadgeClass(index)">{{ index + 1 }}</span>
                <img :src="option.data?.imageUrl" :alt="option.label" class="size-11 shrink-0 rounded-lg border border-[#e0c9a0] object-cover" />
                <span class="min-w-0 flex-1 truncate text-sm font-bold">{{ optionLabel(option) }}</span>
              </li>
            </ol>
          </section>

          <section>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-black text-[#6d6861]">社群總排名</h3>
              <span v-if="community" class="text-xs tabular-nums text-[#8f5d14]">已玩 {{ community.playCount }} 人</span>
            </div>
            <div v-if="community" class="mt-3 space-y-2">
              <p v-if="!community.ranking.length" class="rounded-xl border border-dashed border-[#e0c9a0] bg-[#fffaf0] p-4 text-sm text-[#8b857d]">還沒有其他人玩，成為第一個完成排名的人。</p>
              <div v-else v-for="(entry, index) in community.ranking" :key="entry.optionId" class="flex items-center gap-3 rounded-xl border border-[#ded7cb] bg-white p-2.5">
                <span class="grid size-8 shrink-0 place-items-center rounded-full text-xs font-black" :class="rankBadgeClass(index)">{{ index + 1 }}</span>
                <img :src="communityOption(entry.optionId)?.data?.imageUrl" :alt="communityOption(entry.optionId)?.label" class="size-11 shrink-0 rounded-lg border border-[#e0c9a0] object-cover" />
                <span class="min-w-0 flex-1 truncate text-sm font-bold">{{ communityOption(entry.optionId)?.label || '圖片' }}</span>
                <span class="shrink-0 text-xs tabular-nums text-[#8b857d]">平均 {{ entry.rank.toFixed(1) }} 名</span>
              </div>
            </div>
            <div v-else class="mt-3 h-24 animate-pulse rounded-xl bg-[#eee9e0]" />
          </section>

          <div class="flex flex-col items-center gap-2 border-t border-[#f0e6d2] pt-4">
            <UiButton variant="quick" :disabled="submitting" @click="replay">{{ submitting ? '送出中…' : '再玩一次（更新我的排名）' }}</UiButton>
            <p class="text-xs text-[#8b857d]">重玩會覆蓋你上次的排名，不影響已完成的其他人。</p>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Topic, TopicCommunityRanking, TopicOption } from '~/types/topic';
import { VOTE_IDENTITY_NOTICE } from '~/utils/topic';
import { errorMessage } from '~/composables/useApi';

const props = defineProps<{ topic: Topic }>();
const emit = defineEmits<{ refreshed: [] }>();

const api = useApi();
const auth = useAuthStore();
const { success: toastSuccess, error: toastError } = useToast();

const lightboxSrc = ref<string | null>(null);
function openLightbox(src: string) { lightboxSrc.value = src; }

const participationReady = computed(() => !auth.isAuthed || Boolean(auth.capabilitySummary?.participation));

const done = ref(false);
const started = ref(false);
const playing = ref(false);
const submitting = ref(false);
const submittedRanking = ref<string[]>([]);
const comparisonsCount = ref(0);
const community = ref<TopicCommunityRanking | null>(null);
const leftOption = ref<TopicOption | null>(null);
const rightOption = ref<TopicOption | null>(null);

const maxComparisons = computed(() => mergeSortMaxComparisons(props.topic.options.length));
const progressPercent = computed(() => {
  if (!maxComparisons.value) return 0;
  return Math.min(100, Math.round((comparisonsCount.value / maxComparisons.value) * 100));
});
const rankedOptions = computed(() => submittedRanking.value.map((id) => props.topic.options.find((option) => option.id === id)!).filter(Boolean));
const communityOption = (optionId: string) => props.topic.options.find((option) => option.id === optionId);
function optionLabel(option: TopicOption) {
  if (option.label) return option.label;
  const index = props.topic.options.findIndex((item) => item.id === option.id);
  return index >= 0 ? `圖片 ${index + 1}` : '圖片';
}

let activeRun = 0;
let pendingChoose: ((side: 'left' | 'right') => void) | null = null;

function mergeSortMaxComparisons(n: number): number {
  if (n <= 1) return 0;
  const mid = Math.floor(n / 2);
  return mergeSortMaxComparisons(mid) + mergeSortMaxComparisons(n - mid) + (n - 1);
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function chooseSide(side: 'left' | 'right') {
  if (!pendingChoose) return;
  const resolve = pendingChoose;
  pendingChoose = null;
  comparisonsCount.value += 1;
  resolve(side);
}

function askCompare(a: TopicOption, b: TopicOption): Promise<'left' | 'right'> {
  leftOption.value = a;
  rightOption.value = b;
  return new Promise((resolve) => {
    pendingChoose = resolve;
  });
}

async function mergeSort(list: TopicOption[]): Promise<TopicOption[]> {
  if (list.length <= 1) return list;
  const mid = Math.floor(list.length / 2);
  const left = await mergeSort(list.slice(0, mid));
  const right = await mergeSort(list.slice(mid));
  const merged: TopicOption[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const winner = await askCompare(left[i], right[j]);
    if (winner === 'left') {
      merged.push(left[i]);
      i += 1;
    } else {
      merged.push(right[j]);
      j += 1;
    }
  }
  return merged.concat(left.slice(i), right.slice(j));
}

async function loadCommunity() {
  try {
    community.value = await api.get<TopicCommunityRanking>(`/topics/${props.topic.id}/rankings`);
  } catch {
    community.value = null;
  }
}

async function submitRanking(ranking: string[]) {
  submitting.value = true;
  try {
    const res = await api.post<{ success: boolean; rewardPoints: number; isNew: boolean; playCount: number }>(`/topics/${props.topic.id}/rank`, {
      ranking,
      comparisons: comparisonsCount.value,
    });
    submittedRanking.value = ranking;
    done.value = true;
    toastSuccess(res.isNew ? '排名已完成' : '排名已更新（覆蓋先前記錄）');
    emit('refreshed');
  } catch (e) {
    toastError(errorMessage(e));
  } finally {
    submitting.value = false;
  }
  await loadCommunity();
}

async function play() {
  if (playing.value || submitting.value || done.value) return;
  const run = ++activeRun;
  playing.value = true;
  comparisonsCount.value = 0;
  const sorted = await mergeSort(shuffleArray([...props.topic.options]));
  playing.value = false;
  if (run !== activeRun || !sorted.length) return;
  await submitRanking(sorted.map((option) => option.id));
}

function start() {
  if (submitting.value) return;
  started.value = true;
  void play();
}

function replay() {
  if (submitting.value) return;
  done.value = false;
  started.value = true;
  submittedRanking.value = [];
  community.value = null;
  leftOption.value = null;
  rightOption.value = null;
  void play();
}

function rankBadgeClass(index: number) {
  if (index === 0) return 'bg-[#b0761f] text-white';
  if (index === 1) return 'bg-[#9aa0a6] text-white';
  if (index === 2) return 'bg-[#b3541e] text-white';
  return 'bg-[#f0e6d2] text-[#8b857d]';
}

onMounted(async () => {
  if (props.topic.myRanking) {
    submittedRanking.value = props.topic.myRanking;
    comparisonsCount.value = props.topic.myRankingComparisons ?? 0;
    done.value = true;
    await loadCommunity();
  }
});

watch(() => props.topic.id, () => {
  activeRun += 1;
  pendingChoose = null;
  playing.value = false;
  submitting.value = false;
  done.value = false;
  started.value = false;
  submittedRanking.value = [];
  comparisonsCount.value = 0;
  community.value = null;
  leftOption.value = null;
  rightOption.value = null;
  if (props.topic.myRanking) {
    submittedRanking.value = props.topic.myRanking;
    comparisonsCount.value = props.topic.myRankingComparisons ?? 0;
    done.value = true;
    void loadCommunity();
  }
});
</script>
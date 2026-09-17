<template>
  <article role="link" tabindex="0" class="group flex h-full cursor-pointer flex-col rounded-2xl border border-[#d7d1c6] bg-[#faf8f3] p-5 transition hover:-translate-y-1 hover:border-[#171717] hover:shadow-[6px_6px_0_#d7d1c6] focus-ring sm:p-6" @click="goTopic" @keydown.enter="goTopic">
    <UiImageLightbox v-model:src="lightboxSrc" />
    <div class="mb-5 flex items-center justify-between gap-3">
      <span class="rounded-full px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-white" :style="{ backgroundColor: meta.color }">{{ meta.label }}</span>
      <div class="flex items-center gap-2">
        <NuxtLink v-if="topic.creator.type === 'MEMBER' && topic.creator.id" :to="`/members/${topic.creator.id}`" class="focus-ring bg-[#ebe6dc] px-2 py-1 text-[11px] font-bold text-[#6d6861] hover:text-[#171717]" @click.stop @keydown.enter.stop>{{ topic.creator.nickname }}</NuxtLink>
        <span v-if="topic.moderationStatus === 'PENDING_REVIEW'" class="bg-[#fff0d7] px-2 py-1 text-[11px] font-bold text-[#9a5b12]">待複核</span>
        <span v-else-if="topic.hasVoted" class="bg-[#e5f1e9] px-2 py-1 text-[11px] font-bold text-[#3f7a58]">已投票</span>
        <span v-else class="text-xs font-bold text-[#77716a]">{{ deadlineLabel(topic.voteEndAt, deadlineNow) }}</span>
      </div>
    </div>

    <NuxtLink :to="`/topic/${topic.id}`" class="focus-ring text-xl font-black leading-snug tracking-[-0.025em] transition group-hover:text-[#d84a36]" @click.stop>{{ topic.title }}</NuxtLink>

    <div v-if="topic.topicType === 'SPECTRUM'" class="mt-8">
      <div class="mb-2 flex items-end justify-between">
        <span class="text-xs text-[#77716a]">社群風向</span>
        <span v-if="spectrumValue !== null" class="text-2xl font-black tabular-nums">{{ Math.round(spectrumValue) }}<small class="text-xs text-[#77716a]"> / 100</small></span>
        <span v-else class="text-xs font-bold text-[#77716a]">尚無投票資料</span>
      </div>
      <div class="relative h-2 bg-[#dfdad0]">
        <div v-if="spectrumValue !== null" class="h-full bg-[#3157d5]" :style="{ width: `${spectrumValue}%` }" />
      </div>
    </div>

    <div v-else class="mt-8 space-y-3">
      <div v-for="option in options" :key="option.id">
        <div class="mb-1 flex justify-between text-xs">
          <span class="flex min-w-0 items-center gap-1.5 truncate pr-3 font-medium"><img v-if="option.data?.imageUrl" :src="option.data.imageUrl" :alt="`放大 ${option.label}`" class="h-6 w-6 shrink-0 cursor-zoom-in rounded-lg border border-[#ded7cb] object-cover transition hover:opacity-80" @click.stop="openLightbox(option.data.imageUrl)" /><span class="truncate">{{ option.label }}</span></span>
          <span class="font-bold tabular-nums">{{ optionPercentage(option, topic) }}%</span>
        </div>
        <div class="h-1.5 bg-[#dfdad0]">
          <div class="h-full" :style="{ width: `${optionPercentage(option, topic)}%`, backgroundColor: meta.color }" />
        </div>
      </div>
    </div>

    <div class="mt-auto border-t border-[#ded8cd] pt-5 text-xs text-[#77716a]" :class="topic.topicType === 'SPECTRUM' ? 'mt-8' : 'mt-7'">
      <span v-if="topic.kind === 'SURVEY'"><strong class="text-[#171717]">{{ topic.surveyQuestionCount ?? topic.questions?.length ?? 0 }}</strong> 題</span>
      <span v-else><strong class="text-[#171717]">{{ formatCompactNumber(topic.totalVotes) }}</strong> 人參與</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Topic } from '~/types/topic';
import { deadlineLabel, formatCompactNumber, getCategoryMeta, leadingOptions, optionPercentage } from '~/utils/topic';

const props = defineProps<{ topic: Topic }>();
const router = useRouter();
const meta = computed(() => props.topic.kind === 'SURVEY'
  ? { key: 'survey', label: '問卷', eyebrow: '多題組合', color: '#b0761f', soft: '#fff0d7' }
  : getCategoryMeta(props.topic.category));
const options = computed(() => leadingOptions(props.topic, 2));
const deadlineNow = useState<number>('topic-deadline-now', () => Date.now());
const lightboxSrc = ref<string | null>(null);
function openLightbox(src: string) { lightboxSrc.value = src; }
function goTopic() { router.push(`/topic/${props.topic.id}`); }
const spectrumValue = computed(() => props.topic.spectrumMedian === null || props.topic.spectrumMedian === undefined
  ? null
  : Number(props.topic.spectrumMedian));
</script>

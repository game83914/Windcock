<template>
  <article role="link" tabindex="0" class="group flex h-full cursor-pointer flex-col rounded-2xl border border-[#d7d1c6] bg-[#faf8f3] p-5 transition hover:-translate-y-1 hover:border-[#171717] hover:shadow-[6px_6px_0_#d7d1c6] focus-ring sm:p-6" @click="goTopic" @keydown.enter="goTopic">
    <UiImageLightbox v-model:src="lightboxSrc" />
    <div class="mb-5 flex items-center justify-between gap-3">
      <span class="rounded-full px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-white" :style="{ backgroundColor: meta.color }">{{ meta.label }}</span>
      <div class="flex items-center gap-2">
        <span v-if="topic.moderationStatus === 'PENDING_REVIEW'" class="bg-[#fff0d7] px-2 py-1 text-[11px] font-bold text-[#9a5b12]">待複核</span>
        <span class="text-xs font-bold text-[#77716a]">{{ deadlineLabel(topic.voteEndAt, deadlineNow) }}</span>
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
      <VoteResultBar
        v-for="option in options"
        :key="option.id"
        :label="option.label"
        :percentage="optionPercentage(option, topic)"
        :image-src="option.data?.imageUrl ?? null"
        row-class="mb-1 flex justify-between text-xs"
        label-class="flex min-w-0 items-center gap-1.5 truncate pr-3 font-medium"
        value-class="font-bold tabular-nums"
        track-class="h-1.5 bg-[#dfdad0]"
        bar-class="h-full"
        :bar-style="{ backgroundColor: meta.color }"
        @image-zoom="openLightbox(option.data?.imageUrl ?? '')"
      />
    </div>

    <div class="mt-auto flex items-center justify-between gap-2 border-t border-[#ded8cd] pt-5 text-xs text-[#77716a]" :class="topic.topicType === 'SPECTRUM' ? 'mt-8' : 'mt-7'">
      <span class="flex min-w-0 items-center gap-1.5">
        <NuxtLink v-if="topic.creator.type === 'MEMBER' && topic.creator.id" :to="`/members/${topic.creator.id}`" class="focus-ring min-w-0 truncate font-bold hover:text-[#171717]" @click.stop @keydown.enter.stop>{{ topic.creator.nickname }}</NuxtLink>
        <span v-else class="min-w-0 truncate font-bold">{{ topic.creator.nickname }}</span>
        <span aria-hidden="true">·</span>
        <span class="shrink-0">{{ formatTimeAgo(topic.createdAt, deadlineNow) }}</span>
      </span>
      <span class="flex shrink-0 items-center gap-2">
        <span v-if="topic.hasVoted" class="bg-[#e5f1e9] px-2 py-1 text-[11px] font-bold text-[#3f7a58]">已投票</span>
        <span v-if="topic.kind === 'SURVEY'"><strong class="text-[#171717]">{{ topic.surveyQuestionCount ?? topic.questions?.length ?? 0 }}</strong> 題</span>
        <span v-else-if="topic.kind === 'STAGED'"><strong class="text-[#171717]">{{ topic.totalRounds ?? topic.rounds?.length ?? 0 }}</strong> 輪 · 第 {{ topic.currentRound ?? topic.rounds?.length ?? 0 }} 輪</span>
        <span v-else><strong class="text-[#171717]">{{ formatCompactNumber(topic.totalVotes) }}</strong> 人參與</span>
      </span>
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
  : props.topic.kind === 'STAGED'
    ? { key: 'staged', label: '回合制', eyebrow: '回合制快問', color: '#b0761f', soft: '#fff0d7' }
  : getCategoryMeta(props.topic.category));
const options = computed(() => leadingOptions(props.topic, 2));
const deadlineNow = useDeadlineNow();
const { src: lightboxSrc, open: openLightbox } = useLightbox();
function goTopic() { router.push(`/topic/${props.topic.id}`); }
const spectrumValue = computed(() => props.topic.spectrumMedian === null || props.topic.spectrumMedian === undefined
  ? null
  : Number(props.topic.spectrumMedian));
</script>

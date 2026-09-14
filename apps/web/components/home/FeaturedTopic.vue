<template>
  <article class="editorial-grid relative isolate min-h-[500px] overflow-hidden bg-[#171717] p-6 text-white sm:p-8 lg:min-h-0 lg:p-9">
    <div class="absolute right-0 top-0 h-28 w-28 border-b border-l border-white/20" />
    <div class="relative flex h-full flex-col">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <span class="eyebrow flex items-center gap-2 text-lg text-white/65">
          <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-[#e85a43] motion-reduce:animate-none" />
          正在發生
        </span>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <span v-if="topic.creator.type === 'MEMBER'" class="border border-white/20 px-3 py-1 text-xs text-white/70">會員發起</span>
          <span v-if="topic.moderationStatus === 'PENDING_REVIEW'" class="bg-[#b86b12] px-3 py-1 text-xs font-bold text-white">待複核</span>
          <span class="px-4 py-1.5 text-lg font-bold" :style="{ backgroundColor: categoryMeta.color, color: contrastTextColor(categoryMeta.color) }">{{ categoryMeta.label }}</span>
        </div>
      </div>

      <div class="my-auto min-h-0 py-6">
        <p v-if="topic.description" class="mb-4 line-clamp-2 max-w-xl text-sm leading-6 text-white/55">{{ topic.description }}</p>
        <h2 class="line-clamp-2 max-w-3xl text-3xl font-black leading-tight tracking-[-0.04em] sm:text-5xl lg:text-[3.1rem]">
          {{ topic.title }}
        </h2>

        <div v-if="topic.topicType === 'SPECTRUM'" class="mt-9 max-w-2xl">
          <div class="mb-3 flex items-end justify-between">
            <span class="text-sm text-white/60">目前社群位置</span>
            <span v-if="spectrumValue !== null" class="text-4xl font-black tabular-nums">{{ Math.round(spectrumValue) }}<small class="ml-1 text-base text-white/45">/ 100</small></span>
            <span v-else class="text-sm font-bold text-white/60">尚無投票資料</span>
          </div>
          <div class="relative h-3 bg-white/15">
            <div v-if="spectrumValue !== null" class="absolute inset-y-0 left-0 bg-[#e85a43]" :style="{ width: `${spectrumValue}%` }" />
            <span v-if="spectrumValue !== null" class="absolute top-1/2 h-6 w-1 -translate-x-1/2 -translate-y-1/2 bg-white" :style="{ left: `${spectrumValue}%` }" />
          </div>
          <div class="mt-2 flex justify-between text-xs text-white/40"><span>0</span><span>中間</span><span>100</span></div>
        </div>

        <div v-else class="mt-9 max-w-2xl space-y-4">
          <div v-for="(option, index) in options" :key="option.id">
            <div class="mb-1.5 flex items-center justify-between text-sm">
              <span class="font-semibold">{{ option.label }}</span>
              <span class="font-bold tabular-nums">{{ optionPercentage(option, topic) }}%</span>
            </div>
            <div class="h-2 bg-white/15">
              <div
                class="h-full transition-[width] duration-500"
                :class="index === 0 ? 'bg-[#e85a43]' : 'bg-[#5274e8]'"
                :style="{ width: `${optionPercentage(option, topic)}%` }"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-4 border-t border-white/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-2 text-xs font-semibold text-white/60">
          <span class="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3.5 py-1.5">
            已表態 <strong class="tabular-nums text-white">{{ formatCompactNumber(topic.totalVotes) }}</strong> 人
          </span>
          <span class="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3.5 py-1.5 tabular-nums">
            {{ deadlineLabel(topic.voteEndAt, deadlineNow) }}
          </span>
        </div>
        <NuxtLink
          :to="`/topic/${topic.id}`"
          class="focus-ring inline-flex items-center justify-center gap-3 bg-white px-5 py-3 text-sm font-bold text-[#171717] transition hover:bg-[#e85a43] hover:text-white"
        >
          {{ isVotingOpen ? '立即表態' : '查看結果' }}
          <span aria-hidden="true">&rarr;</span>
        </NuxtLink>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Topic } from '~/types/topic';
import { contrastTextColor, deadlineLabel, formatCompactNumber, getCategoryMeta, leadingOptions, optionPercentage } from '~/utils/topic';

const props = defineProps<{ topic: Topic }>();
const options = computed(() => leadingOptions(props.topic, 2));
const categoryMeta = computed(() => getCategoryMeta(props.topic.category));
const deadlineNow = useState<number>('topic-deadline-now', () => Date.now());
const spectrumValue = computed(() => props.topic.spectrumMedian === null || props.topic.spectrumMedian === undefined
  ? null
  : Number(props.topic.spectrumMedian));
const isVotingOpen = computed(() => props.topic.status === 'OPEN'
  && Boolean(props.topic.voteEndAt)
  && new Date(props.topic.voteEndAt!).getTime() > deadlineNow.value);
</script>

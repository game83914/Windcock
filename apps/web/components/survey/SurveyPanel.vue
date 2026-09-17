<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center gap-3">
      <p class="text-sm font-black">已完成 {{ answeredCount }} / {{ questions.length }} 題</p>
      <div class="h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-[#ebe6dc]">
        <div class="h-full rounded-full bg-[#b0761f] transition-all" :style="{ width: `${progressPercent}%` }" />
      </div>
    </div>

    <p v-if="allAnswered" class="rounded-2xl border-l-4 border-[#3f7a58] bg-[#e5f1e9] p-4 text-sm font-bold text-[#2f6244]">
      感謝完成問卷！以下是各題目前的即時結果。
    </p>

    <section
      v-for="(question, index) in questions"
      :key="question.id"
      class="overflow-hidden rounded-2xl border border-[#ded7cb] bg-[#faf8f3] shadow-[0_8px_28px_rgba(23,23,23,0.08)]"
    >
      <header class="border-b border-[#ded7cb] px-5 py-4 sm:px-6">
        <p class="eyebrow-modern text-[#b0761f]">第 {{ index + 1 }} / {{ questions.length }} 題 · {{ topicTypeLabel(question.topicType) }}</p>
        <h3 class="mt-1 text-lg font-black leading-snug">{{ question.title }}</h3>
      </header>
      <div class="p-5 sm:p-6">
        <QuickVotePanel :topic="question" @refreshed="emit('refreshed')" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Topic } from '~/types/topic';
import { topicTypeLabel } from '~/utils/topic';

const props = defineProps<{ topic: Topic }>();
const emit = defineEmits<{ refreshed: [] }>();

const questions = computed(() => props.topic.questions ?? []);
const answeredCount = computed(() => props.topic.surveyAnsweredCount ?? questions.value.filter((question) => question.hasVoted).length);
const allAnswered = computed(() => questions.value.length > 0 && answeredCount.value >= questions.value.length);
const progressPercent = computed(() => {
  if (!questions.value.length) return 0;
  return Math.round((answeredCount.value / questions.value.length) * 100);
});
</script>

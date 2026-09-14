<template>
  <div v-if="topics.length" class="flex flex-col bg-[#171717]" role="region" aria-roledescription="輪播" aria-label="置頂議題" @mouseenter="setHoverPaused(true)" @mouseleave="setHoverPaused(false)" @focusin="setFocusPaused(true)" @focusout="setFocusPaused(false)">
    <div class="min-h-[500px] lg:h-[500px]">
      <Transition name="fade" mode="out-in">
        <HomeFeaturedTopic :key="current.id" :topic="current" class="min-h-[500px] lg:h-full" />
      </Transition>
    </div>

    <div v-if="topics.length > 1" class="flex items-center justify-center border-t border-white/15 px-6 sm:px-9 lg:px-11">
      <div class="flex items-center" role="group" aria-label="選擇置頂議題">
        <button
          v-for="(topic, index) in topics"
          :key="topic.id"
          type="button"
          class="focus-ring group grid h-11 w-11 place-items-center"
          :aria-label="`切換到第 ${index + 1} 個置頂議題：${topic.title}`"
          :aria-current="index === activeIndex ? 'true' : undefined"
          @click="goTo(index)"
        >
          <span class="h-2.5 w-2.5 rounded-full transition" :class="index === activeIndex ? 'bg-white' : 'bg-white/30 group-hover:bg-white/60'" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Topic } from '~/types/topic';

const props = defineProps<{ topics: Topic[] }>();

const activeIndex = ref(0);
const current = computed<Topic>(() => props.topics[activeIndex.value] ?? props.topics[0]);
const prefersReducedMotion = ref(false);
const hoverPaused = ref(false);
const focusPaused = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;
let motionQuery: MediaQueryList | null = null;

const AUTOPLAY_INTERVAL = 6000;

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function setHoverPaused(paused: boolean) {
  hoverPaused.value = paused;
  scheduleAutoplay();
}

function setFocusPaused(paused: boolean) {
  focusPaused.value = paused;
  scheduleAutoplay();
}

function scheduleAutoplay() {
  clearTimer();
  if (props.topics.length <= 1 || prefersReducedMotion.value || hoverPaused.value || focusPaused.value) return;
  timer = setTimeout(next, AUTOPLAY_INTERVAL);
}

function next() {
  activeIndex.value = (activeIndex.value + 1) % props.topics.length;
}

function goTo(index: number) {
  activeIndex.value = index;
}

function updateMotionPreference(event: MediaQueryListEvent | MediaQueryList) {
  prefersReducedMotion.value = event.matches;
  scheduleAutoplay();
}

watch(() => props.topics.length, (length) => {
  if (activeIndex.value >= length) activeIndex.value = 0;
  scheduleAutoplay();
}, { flush: 'sync' });

watch(activeIndex, scheduleAutoplay);

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  updateMotionPreference(motionQuery);
  motionQuery.addEventListener('change', updateMotionPreference);
});
onUnmounted(() => {
  clearTimer();
  motionQuery?.removeEventListener('change', updateMotionPreference);
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.35s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .fade-enter-active,
  .fade-leave-active {
    transition: none;
  }
}
</style>

<template>
  <Teleport to="body">
    <Transition name="lb">
      <div
        v-if="src"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-[#171717]/70 p-4 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-label="放大圖片"
        @click.self="close"
        @keydown.esc="close"
      >
        <button type="button" class="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-lg font-black text-[#171717] shadow-lg transition hover:bg-white" aria-label="關閉" @click="close">&times;</button>
        <img :src="src" :alt="alt || '選項圖片'" class="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl" />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{ src: string | null; alt?: string }>();
const emit = defineEmits<{ 'update:src': [value: string | null] }>();

function close() { emit('update:src', null); }

if (import.meta.client) {
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && props.src) close(); };
  watch(() => props.src, (v) => {
    if (v) {
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    } else {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    }
  });
  onUnmounted(() => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; });
}
</script>

<style scoped>
.lb-enter-active, .lb-leave-active { transition: opacity 0.2s ease; }
.lb-enter-from, .lb-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .lb-enter-active, .lb-leave-active { transition: none; }
}
</style>

<template>
  <span class="inline-grid shrink-0 place-items-center overflow-hidden bg-[#171717] font-black text-white" :class="sizeClass" :title="nickname || undefined">
    <img v-if="avatarUrl && !failed" :src="avatarUrl" :alt="`${nickname}的頭像`" class="h-full w-full object-cover" @error="failed = true" />
    <span v-else>{{ initial }}</span>
  </span>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ nickname?: string | null; avatarUrl?: string | null; size?: 'sm' | 'md' | 'lg' }>(), {
  nickname: '會員',
  avatarUrl: null,
  size: 'md',
});
const failed = ref(false);
const initial = computed(() => (props.nickname || '會').slice(0, 1));
const sizeClass = computed(() => ({ sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-14 w-14 text-xl' }[props.size]));
watch(() => props.avatarUrl, () => { failed.value = false; });
</script>

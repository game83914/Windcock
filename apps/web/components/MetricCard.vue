<template>
  <article class="border border-[#d7d1c6] bg-white p-4">
    <p class="text-[10px] font-black tracking-[0.08em] text-[#77716a]">{{ label }}</p>
    <p class="mt-2 text-2xl font-black tabular-nums">{{ value }} <small class="text-xs text-[#77716a]">{{ suffix }}</small></p>
  </article>
</template>

<script setup lang="ts">
defineProps<{ label: string; value: string; suffix: string }>();
</script>

<template>
  <button
    type="button"
    :class="classes"
    :aria-pressed="active ? 'true' : 'false'"
    @click="emit('toggle', !active)"
  >
    <span v-if="dotColor" class="inline-block h-2 w-2 rounded-full" :style="{ backgroundColor: dotColor }" />
    <slot />
  </button>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  active?: boolean;
  activeClass?: string;
  dotColor?: string;
}>(), {
  active: false,
  activeClass: 'bg-[#171717] text-white border-[#171717]',
  dotColor: undefined,
});

const emit = defineEmits<{ toggle: [active: boolean] }>();

const base = 'focus-ring inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition active:scale-[0.98]';

const neutral = 'border-[#ded7cb] bg-white text-[#5f5a53] hover:border-[#171717] hover:text-[#171717]';

const classes = computed(() => [base, props.active ? props.activeClass : neutral]);
</script>
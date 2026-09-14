<template>
  <component
    :is="linkTag"
    :to="linkTag === 'NuxtLink' ? to : undefined"
    :type="linkTag === 'button' ? 'button' : undefined"
    :class="classes"
    :disabled="linkTag === 'button' && disabled"
    @click="emit('click', $event)"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
type CardVariant = 'plain' | 'quick' | 'featured';

const props = withDefaults(defineProps<{
  to?: string;
  variant?: CardVariant;
  disabled?: boolean;
  padding?: boolean;
}>(), {
  to: undefined,
  variant: 'plain',
  disabled: false,
  padding: true,
});

const emit = defineEmits<{ click: [event: MouseEvent] }>();

const linkTag = computed(() => props.to ? 'NuxtLink' : 'button');

const base = 'focus-ring block w-full text-left rounded-2xl transition will-change-transform';

const variants: Record<CardVariant, string> = {
  plain: 'border border-[#ded7cb] bg-[#faf8f3] shadow-[0_1px_3px_rgba(23,23,23,0.06)] hover:shadow-[0_8px_24px_rgba(23,23,23,0.10)]',
  quick: 'border border-[#e6cf9e] bg-[#fff8ec] shadow-[0_1px_3px_rgba(176,118,31,0.08)] hover:shadow-[0_8px_24px_rgba(176,118,31,0.12)]',
  featured: 'bg-[#171717] text-white',
};

const interactive = computed(() => Boolean(props.to || props.disabled === false));
const hover = computed(() => interactive.value ? props.to ? 'hover:-translate-y-1' : 'hover:bg-[#f1ede4]' : 'cursor-default');

const classes = computed(() => [
  base,
  variants[props.variant],
  props.padding ? 'p-5 sm:p-6' : '',
  hover.value,
]);
</script>
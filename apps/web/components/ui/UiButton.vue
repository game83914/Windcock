<template>
  <component
    :is="linkTag"
    :to="linkTag === 'NuxtLink' ? to : undefined"
    :type="linkTag === 'button' ? type : undefined"
    :class="classes"
    :disabled="linkTag === 'button' && disabled"
    :aria-disabled="disabled ? 'true' : undefined"
    :tabindex="disabled ? -1 : undefined"
    @click="onClick"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
type ButtonVariant = 'primary' | 'action' | 'data' | 'outline' | 'ghost' | 'quick' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

const props = withDefaults(defineProps<{
  to?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit';
  disabled?: boolean;
  block?: boolean;
}>(), {
  to: undefined,
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  block: false,
});

const emit = defineEmits<{ click: [event: MouseEvent] }>();

const linkTag = computed(() => props.to ? 'NuxtLink' : 'button');

const base = 'focus-ring inline-flex items-center justify-center gap-2 font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 rounded-xl';

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 py-1.5 text-xs',
  md: 'min-h-11 px-5 py-2.5 text-sm',
  lg: 'min-h-13 px-7 py-3.5 text-base',
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-[#171717] text-white hover:bg-[#2b2b2b] shadow-[0_2px_8px_rgba(23,23,23,0.18)]',
  action: 'bg-[#d84a36] text-white hover:bg-[#bf3a28] shadow-[0_2px_8px_rgba(216,74,54,0.25)]',
  data: 'bg-[#3157d5] text-white hover:bg-[#2746b4] shadow-[0_2px_8px_rgba(49,87,213,0.25)]',
  outline: 'border border-[#c9c1b4] bg-white text-[#171717] hover:border-[#171717]',
  ghost: 'text-[#5f5a53] hover:bg-[#ebe6dc]',
  quick: 'bg-[#b0761f] text-white hover:bg-[#97641a] shadow-[0_2px_8px_rgba(176,118,31,0.25)]',
  success: 'bg-[#3f7a58] text-white hover:bg-[#35664b] shadow-[0_2px_8px_rgba(63,122,88,0.22)]',
};

const classes = computed(() => [
  base,
  sizes[props.size],
  variants[props.variant],
  props.block ? 'w-full' : '',
]);

function onClick(event: MouseEvent) {
  if (props.disabled) {
    event.preventDefault();
    return;
  }
  emit('click', event);
}
</script>
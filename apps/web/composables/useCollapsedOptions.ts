import { OPTION_COLLAPSE_LIMIT } from '~/utils/topic';

export function useCollapsedOptions<T>(options: MaybeRefOrGetter<T[]>) {
  const showAllOptions = ref(false);

  const optionsCollapsed = computed(() => !showAllOptions.value && toValue(options).length > OPTION_COLLAPSE_LIMIT);

  const visibleOptions = computed(() => optionsCollapsed.value ? toValue(options).slice(0, OPTION_COLLAPSE_LIMIT) : toValue(options));

  const hiddenCount = computed(() => toValue(options).length - visibleOptions.value.length);

  function toggleOptions() {
    showAllOptions.value = !showAllOptions.value;
  }

  return { showAllOptions, optionsCollapsed, visibleOptions, hiddenCount, toggleOptions };
}

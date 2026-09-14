import type { Category } from '~/types/topic';
import { applyCategoryRules } from '~/utils/topic';

export function useCategories() {
  const api = useApi();
  const { data, status, refresh } = useAsyncData('categories', () => api.get<Category[]>('/categories'), { default: () => [] });
  const active = computed(() => (data.value ?? []).filter((category) => category.isActive));
  watch(data, (categories) => applyCategoryRules(categories), { immediate: true });
  return { data, active, status, refresh };
}
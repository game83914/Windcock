<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="focus-ring grid size-9 max-w-full min-w-0 place-items-center rounded-full text-[#171717]"
      :aria-expanded="open ? 'true' : 'false'"
      aria-haspopup="listbox"
      aria-label="篩選與排序"
      @click="toggle"
    >
      <svg class="shrink-0 text-[#77716a]" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z" /></svg>
    </button>

    <div
      v-if="open"
      ref="panelEl"
      class="absolute left-0 top-[calc(100%+6px)] z-30 max-h-[35vh] w-60 overflow-auto rounded-xl border border-[#d7d1c6] bg-white p-3 shadow-[0_12px_32px_rgba(0,0,0,0.14)]"
      role="listbox"
      aria-label="篩選與排序"
    >
      <fieldset v-if="hasCategory" class="pb-1">
        <legend class="mb-1.5 px-2.5 text-xs font-bold text-[#77716a]">分類</legend>
        <div class="space-y-0.5">
          <button
            data-dd-first
            type="button"
            role="radio"
            class="filter-row"
            :class="categoryValue === 'all' ? 'filter-row-active' : ''"
            :aria-checked="categoryValue === 'all' ? 'true' : 'false'"
            @click="selectCategory('all')"
          >
            <span class="filter-dot" :class="categoryValue === 'all' ? 'filter-dot-active' : ''" />
            全部
          </button>
          <button
            v-for="item in categories"
            :key="item.key"
            type="button"
            role="radio"
            class="filter-row"
            :class="categoryValue === item.key ? 'filter-row-active' : ''"
            :aria-checked="categoryValue === item.key ? 'true' : 'false'"
            @click="selectCategory(item.key)"
          >
            <span class="filter-dot" :class="categoryValue === item.key ? 'filter-dot-active' : ''" />
            {{ item.key === 'quick' ? '快問' : item.label }}
          </button>
        </div>
      </fieldset>

      <fieldset v-if="hasSort" class="mt-1 border-t border-[#eee9e0] pt-2 pb-1">
        <legend class="mb-1.5 px-2.5 text-xs font-bold text-[#77716a]">排序</legend>
        <div class="space-y-0.5">
          <button
            type="button"
            role="radio"
            class="filter-row"
            :class="sortValue === 'ACTIVITY' ? 'filter-row-active' : ''"
            :aria-checked="sortValue === 'ACTIVITY' ? 'true' : 'false'"
            @click="selectSort('ACTIVITY')"
          >
            <span class="filter-dot" :class="sortValue === 'ACTIVITY' ? 'filter-dot-active' : ''" />
            更新時間
          </button>
          <button
            type="button"
            role="radio"
            class="filter-row"
            :class="sortValue === 'POPULAR' ? 'filter-row-active' : ''"
            :aria-checked="sortValue === 'POPULAR' ? 'true' : 'false'"
            @click="selectSort('POPULAR')"
          >
            <span class="filter-dot" :class="sortValue === 'POPULAR' ? 'filter-dot-active' : ''" />
            熱門
          </button>
          <button
            type="button"
            role="radio"
            class="filter-row"
            :class="sortValue === 'NEWEST' ? 'filter-row-active' : ''"
            :aria-checked="sortValue === 'NEWEST' ? 'true' : 'false'"
            @click="selectSort('NEWEST')"
          >
            <span class="filter-dot" :class="sortValue === 'NEWEST' ? 'filter-dot-active' : ''" />
            建立時間
          </button>
        </div>
      </fieldset>

      <fieldset v-if="hasParticipation" class="mt-1 border-t border-[#eee9e0] pt-2">
        <legend class="mb-1.5 px-2.5 text-xs font-bold text-[#77716a]">參與</legend>
        <div class="space-y-0.5">
          <button
            type="button"
            role="radio"
            class="filter-row"
            :class="effectiveParticipation === 'ALL' ? 'filter-row-active' : ''"
            :aria-checked="effectiveParticipation === 'ALL' ? 'true' : 'false'"
            @click="selectParticipation('ALL')"
          >
            <span class="filter-dot" :class="effectiveParticipation === 'ALL' ? 'filter-dot-active' : ''" />
            全部
          </button>
          <button
            type="button"
            role="radio"
            class="filter-row"
            :class="[effectiveParticipation === 'UNVOTED' ? 'filter-row-active' : '', !isAuthed ? 'filter-row-disabled' : '']"
            :aria-checked="effectiveParticipation === 'UNVOTED' ? 'true' : 'false'"
            :disabled="!isAuthed"
            :title="isAuthed ? '' : '登入後可篩選未投票議題'"
            @click="selectParticipation('UNVOTED')"
          >
            <span class="filter-dot" :class="effectiveParticipation === 'UNVOTED' ? 'filter-dot-active' : ''" />
            未投票
          </button>
        </div>
      </fieldset>

      <fieldset v-if="hasStatus" class="mt-1 border-t border-[#eee9e0] pt-2">
        <legend class="mb-1.5 px-2.5 text-xs font-bold text-[#77716a]">狀態</legend>
        <div class="space-y-0.5">
          <button
            type="button"
            role="radio"
            class="filter-row"
            :class="statusValue === 'ACTIVE' ? 'filter-row-active' : ''"
            :aria-checked="statusValue === 'ACTIVE' ? 'true' : 'false'"
            @click="selectStatus('ACTIVE')"
          >
            <span class="filter-dot" :class="statusValue === 'ACTIVE' ? 'filter-dot-active' : ''" />
            進行中
          </button>
          <button
            type="button"
            role="radio"
            class="filter-row"
            :class="statusValue === 'ENDED' ? 'filter-row-active' : ''"
            :aria-checked="statusValue === 'ENDED' ? 'true' : 'false'"
            @click="selectStatus('ENDED')"
          >
            <span class="filter-dot" :class="statusValue === 'ENDED' ? 'filter-dot-active' : ''" />
            已截止
          </button>
          <button
            type="button"
            role="radio"
            class="filter-row"
            :class="statusValue === 'ALL' ? 'filter-row-active' : ''"
            :aria-checked="statusValue === 'ALL' ? 'true' : 'false'"
            @click="selectStatus('ALL')"
          >
            <span class="filter-dot" :class="statusValue === 'ALL' ? 'filter-dot-active' : ''" />
            全部
          </button>
        </div>
      </fieldset>
    </div>
  </div>
</template>

<script setup lang="ts">
interface FilterCategory {
  key: string;
  label: string;
}

const props = withDefaults(defineProps<{
  category?: string;
  categories?: FilterCategory[];
  sort?: string;
  participation?: 'ALL' | 'UNVOTED';
  status?: 'ACTIVE' | 'ENDED' | 'ALL';
  isAuthed: boolean;
}>(), {
  category: undefined,
  categories: () => [],
  sort: undefined,
  participation: undefined,
  status: undefined,
});

const emit = defineEmits<{
  'update:category': [value: string];
  'update:sort': [value: string];
  'update:participation': [value: 'ALL' | 'UNVOTED'];
  'update:status': [value: 'ACTIVE' | 'ENDED' | 'ALL'];
}>();

const root = ref<HTMLElement | null>(null);
const panelEl = ref<HTMLElement | null>(null);
const open = ref(false);

const hasCategory = computed(() => props.category !== undefined);
const hasSort = computed(() => props.sort !== undefined);
const hasParticipation = computed(() => props.participation !== undefined);
const hasStatus = computed(() => props.status !== undefined);
const categoryValue = computed(() => props.category ?? 'all');
const sortValue = computed(() => props.sort ?? 'ACTIVITY');
const statusValue = computed(() => props.status ?? 'ACTIVE');
const effectiveParticipation = computed<'ALL' | 'UNVOTED'>(() => props.isAuthed ? (props.participation ?? 'ALL') : 'ALL');

function selectCategory(value: string) {
  if (props.category === undefined || value === categoryValue.value) return;
  emit('update:category', value);
}

function selectSort(value: string) {
  if (props.sort === undefined || value === sortValue.value) return;
  emit('update:sort', value);
}

function selectParticipation(value: 'ALL' | 'UNVOTED') {
  if (!props.isAuthed || value === effectiveParticipation.value) return;
  emit('update:participation', value);
}

function selectStatus(value: 'ACTIVE' | 'ENDED' | 'ALL') {
  if (props.status === undefined || value === statusValue.value) return;
  emit('update:status', value);
}

function toggle() {
  open.value = !open.value;
  if (open.value) {
    requestAnimationFrame(() => panelEl.value?.querySelector<HTMLElement>('[data-dd-first]')?.focus());
  }
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) return;
  if (event.key === 'Escape') {
    open.value = false;
    root.value?.querySelector<HTMLButtonElement>('button')?.focus();
  }
}

function onGlobalDown(event: MouseEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node)) open.value = false;
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('mousedown', onGlobalDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('mousedown', onGlobalDown);
});
</script>

<style scoped>
.filter-row {
  @apply flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-bold text-[#171717] transition hover:bg-[#f4f1ea];
}
.filter-row-active {
  @apply bg-[#f4f1ea];
}
.filter-row-disabled {
  @apply cursor-not-allowed text-[#aaa49b] hover:bg-transparent;
}
.filter-dot {
  @apply grid size-4 shrink-0 place-items-center rounded-full border border-[#d3cbc0];
}
.filter-dot-active {
  @apply border-[#171717];
}
.filter-dot::after {
  content: '';
  @apply size-1.5 rounded-full bg-transparent;
}
.filter-dot-active::after {
  @apply bg-[#171717];
}
</style>
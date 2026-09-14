<template>
  <li>
    <div
      class="group flex items-start gap-1 border-l-2 py-1 pr-1"
      :class="selectedId === node.id ? 'border-[#3157d5] bg-[#e7ecff]' : 'border-transparent hover:bg-[#ebe6dc]'"
      :style="{ paddingLeft: `${Math.min(node.depth, 4) * 12 + 4}px` }"
    >
      <button
        v-if="node.children.length"
        type="button"
        class="focus-ring mt-1 grid h-7 w-7 shrink-0 place-items-center text-xs font-black text-[#6d6861]"
        :aria-label="expanded ? '收合衍生立場' : '展開衍生立場'"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? '−' : '+' }}
      </button>
      <span v-else class="mt-1 block h-7 w-7 shrink-0" />
      <button
        type="button"
        class="focus-ring min-w-0 flex-1 py-1 text-left"
        :aria-current="selectedId === node.id ? 'true' : undefined"
        @click="emit('select', node.id)"
      >
        <span class="line-clamp-2 text-sm font-bold leading-5">{{ node.title }}</span>
        <span class="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#77716a]">
          <span>{{ node.agreed }} 認同</span>
          <span v-if="node.discussionCount">{{ node.discussionCount }} 討論</span>
          <span v-if="node.children.length">{{ descendantCount }} 個衍生</span>
        </span>
      </button>
    </div>

    <ul v-if="node.children.length && expanded">
      <StanceTreeNavNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :selected-id="selectedId"
        @select="emit('select', $event)"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import type { StanceNode } from '~/types/topic';

const props = defineProps<{ node: StanceNode; selectedId?: string | null }>();
const emit = defineEmits<{ select: [stanceId: string] }>();
const expanded = ref(props.node.depth === 0 || containsSelected(props.node, props.selectedId));
const descendantCount = computed(() => countDescendants(props.node));

watch(() => props.selectedId, (selectedId) => {
  if (containsSelected(props.node, selectedId)) expanded.value = true;
});

function containsSelected(node: StanceNode, selectedId?: string | null): boolean {
  if (!selectedId) return false;
  return node.id === selectedId || node.children.some((child) => containsSelected(child, selectedId));
}

function countDescendants(node: StanceNode): number {
  return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
}
</script>

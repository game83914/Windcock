<template>
  <div :aria-label="ariaLabel" role="img" class="relative h-full w-full min-h-[380px]">
    <VChart
      ref="chartRef"
      class="h-full w-full"
      :option="option"
      :autoresize="true"
      @rendered="syncHighlight"
      @click="handleChartClick"
    />
    <p class="sr-only">此視圖以圖形呈現立場的階層與規模；可切回「列表」視圖操作每個立場。</p>
  </div>
</template>

<script setup lang="ts">
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { GraphChart, TreeChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import type { StanceNode, StanceTreeResponse } from '~/types/topic';

use([CanvasRenderer, TreeChart, GraphChart, TooltipComponent]);

const DEPTH_PALETTE = ['#3157d5', '#d84a36', '#3f7a58', '#9a5b12', '#7b4fd0', '#6d6861'];
const CENTER_ID = '__topic__';

const props = withDefaults(defineProps<{
  mode: 'MIND' | 'CONSTELLATION';
  tree: StanceTreeResponse;
  topicTitle: string;
  selectedId?: string | null;
  showAllDepth?: boolean;
  resetKey?: number;
}>(), {
  selectedId: null,
  showAllDepth: false,
  resetKey: 0,
});

const emit = defineEmits<{ select: [stanceId: string] }>();

const chartRef = ref<{ chart?: { dispatchAction: (payload: Record<string, unknown>) => void } | null } | null>(null);
const highlighted = ref<string | null>(null);

const visibleNodes = computed(() => {
  const all = flatten(props.tree.roots);
  return props.showAllDepth ? all : all.filter((node) => node.depth <= 1);
});
const ariaLabel = computed(
  () => `${props.mode === 'MIND' ? '心智圖' : '星空圖'}，顯示 ${visibleNodes.value.length} 個立場節點`,
);

const option = computed<Record<string, unknown>>(() => {
  void props.resetKey;
  return props.mode === 'MIND' ? mindOption() : graphOption();
});

function mindOption(): Record<string, unknown> {
  const center: Record<string, unknown> = {
    id: CENTER_ID,
    name: CENTER_ID,
    title: props.topicTitle,
    count: props.tree.count,
    rootCount: props.tree.roots.length,
    symbolSize: 15,
    itemStyle: { color: '#171717' },
    label: { fontSize: 12, fontWeight: 800 },
    children: mindData(props.tree.roots),
  };
  return {
    tooltip: { trigger: 'item', formatter: (params: any) => stanceTooltip(params.data) },
    series: [
      {
        id: `mind-${props.showAllDepth ? 'all' : '2'}`,
        type: 'tree',
        layout: 'orthogonal',
        orient: 'LR',
        data: [center],
        initialTreeDepth: props.showAllDepth ? 99 : 2,
        expandAndCollapse: true,
        roam: true,
        symbol: 'circle',
        edgeShape: 'polyline',
        edgeForkPosition: '50%',
        lineStyle: { color: '#d7d1c6', width: 1 },
        label: {
          show: true,
          formatter: (params: any) => truncateLabel(params.data.title, params.data.depth === undefined ? 14 : params.data.depth === 0 ? 12 : 8),
          position: 'top',
          distance: 4,
          color: '#3a3631',
          fontSize: 10,
          lineHeight: 14,
        },
        emphasis: {
          label: { show: true, formatter: (params: any) => params.data.title, fontWeight: 800, fontSize: 12, color: '#171717' },
          itemStyle: { borderColor: '#171717', borderWidth: 3, shadowBlur: 12, shadowColor: 'rgba(23,23,23,0.28)' },
          lineStyle: { width: 2.5, color: '#3157d5' },
        },
        animationDuration: 500,
        animationDurationUpdate: 300,
      },
    ],
  };
}

function mindData(nodes: StanceNode[]): Record<string, unknown>[] {
  return nodes.map((node) => ({
    id: node.id,
    name: node.id,
    title: node.title,
    depth: node.depth,
    agreed: node.agreed,
    disagreed: node.disagreed,
    discussionCount: node.discussionCount,
    symbolSize: nodeSize(node.agreed, 26),
    itemStyle: { color: depthColor(node.depth) },
    label: { fontSize: node.depth === 0 ? 11 : 10 },
    children: node.children.length ? mindData(node.children) : undefined,
  }));
}

function graphOption(): Record<string, unknown> {
  const nodes = visibleNodes.value;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const links: Array<{ source: string; target: string }> = [];
  for (const node of nodes) {
    if (node.depth === 0) {
      links.push({ source: CENTER_ID, target: node.id });
    } else if (node.parentId && nodeById.has(node.parentId)) {
      links.push({ source: node.parentId, target: node.id });
    }
  }
  return {
    tooltip: { trigger: 'item', formatter: (params: any) => stanceTooltip(params.data) },
    series: [
      {
        id: `graph-${props.showAllDepth ? 'all' : '2'}`,
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        data: [
          {
            id: CENTER_ID,
            name: CENTER_ID,
            title: props.topicTitle,
            count: props.tree.count,
            rootCount: props.tree.roots.length,
            symbolSize: 15,
            itemStyle: { color: '#171717' },
          },
          ...nodes.map((node) => ({
            id: node.id,
            name: node.id,
            title: node.title,
            depth: node.depth,
            agreed: node.agreed,
            disagreed: node.disagreed,
            discussionCount: node.discussionCount,
            descendantCount: descendantCount(node),
            symbolSize: nodeSize(node.agreed),
            itemStyle: { color: depthColor(node.depth) },
          })),
        ],
        links,
        force: { repulsion: 200, gravity: 0.1, edgeLength: [45, 110], friction: 0.6, layoutAnimation: true },
        scaleLimit: { min: 0.3, max: 5 },
        symbol: 'circle',
        lineStyle: { color: '#cfc8bc', width: 1.5, curveness: 0.15, opacity: 0.85 },
        label: { show: false },
        emphasis: {
          focus: 'adjacency',
          label: { show: true, fontWeight: 800, fontSize: 12, color: '#171717' },
          itemStyle: { borderColor: '#171717', borderWidth: 3, shadowBlur: 12, shadowColor: 'rgba(23,23,23,0.28)' },
          lineStyle: { width: 2.5, color: '#3157d5' },
        },
        animationDuration: 500,
        animationDurationUpdate: 600,
        animationEasingUpdate: 'cubicOut',
      },
    ],
  };
}

function handleChartClick(params: Record<string, unknown>) {
  const data = params.data as Record<string, unknown> | undefined;
  const id = typeof data?.id === 'string' ? data.id : null;
  if (!id || id === CENTER_ID) return;
  emit('select', id);
}

function syncHighlight() {
  const inst = chartRef.value?.chart;
  if (!inst) return;
  if (highlighted.value) {
    inst.dispatchAction({ type: 'downplay', seriesIndex: 0, name: highlighted.value });
  }
  highlighted.value = props.selectedId ?? null;
  if (highlighted.value) {
    inst.dispatchAction({ type: 'highlight', seriesIndex: 0, name: highlighted.value });
  }
}

watch(() => props.selectedId, () => nextTick(syncHighlight), { flush: 'post' });

function flatten(nodes: StanceNode[]): StanceNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function nodeSize(agreed: number, max = 30): number {
  return Math.round(Math.min(max, 8 + 4 * Math.log2(agreed + 1)));
}

function truncateLabel(title: string, max: number): string {
  if (title.length <= max) return title;
  return `${title.slice(0, max)}…`;
}

function depthColor(depth: number): string {
  return depth < 0 ? '#171717' : DEPTH_PALETTE[depth % DEPTH_PALETTE.length];
}

function descendantCount(node: StanceNode): number {
  return node.children.reduce((total, child) => total + 1 + descendantCount(child), 0);
}

function stanceTooltip(data: Record<string, unknown> | undefined): string {
  if (!data) return '';
  if (data.id === CENTER_ID) {
    return `<b>${escapeHtml(String(data.title ?? ''))}</b><br>${data.rootCount} 個直接立場 · 共 ${data.count} 個立場節點`;
  }
  const parts = [`<b>${escapeHtml(String(data.title ?? ''))}</b>`];
  if (typeof data.depth === 'number') parts.push(`深度 ${data.depth + 1} 層`);
  parts.push(`${data.agreed ?? 0} 認同 · ${data.disagreed ?? 0} 不認同 · ${data.discussionCount ?? 0} 討論`);
  if (typeof data.descendantCount === 'number') parts.push(`${data.descendantCount} 個衍生立場`);
  return parts.join('<br>');
}

function escapeHtml(value: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, (ch) => map[ch]);
}
</script>
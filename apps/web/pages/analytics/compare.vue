<template>
  <div class="mx-auto max-w-6xl pb-12">
    <header class="border-b-2 border-[#171717] pb-7">
      <p class="eyebrow text-[#3157d5]">企業分析</p>
      <h1 class="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">跨議題比較工作台</h1>
      <p class="mt-3 max-w-2xl text-sm leading-6 text-[#6d6861]">比較 2–5 個議題的參與規模、投票速度、群眾輪廓與立場結構。不同議題的選項含義不同，因此結果採並列呈現，不製造虛假的共同支持率。</p>
    </header>

    <div v-if="loading" class="mt-7 h-64 animate-pulse bg-[#e5e0d6]" />
    <p v-else-if="pageError" role="alert" class="mt-7 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm font-bold text-[#a63222]">{{ pageError }}</p>
    <section v-else-if="access && !access.canCompare" class="mt-7 border-2 border-[#171717] bg-[#faf8f3] p-7 shadow-[6px_6px_0_#d7d1c6]">
      <p class="eyebrow text-[#d84a36]">尚未開通</p><h2 class="mt-2 text-2xl font-black">申請企業跨議題分析</h2><p class="mt-3 max-w-xl text-sm leading-6 text-[#5f5a53]">此功能採人工企業授權，可開通給指定會員或合作組織。請聯絡平台營運團隊確認分析需求與使用期間。</p>
    </section>

    <template v-else-if="access?.canCompare">
      <section class="mt-7 border-2 border-[#171717] bg-[#faf8f3] p-5 shadow-[5px_5px_0_#d7d1c6]">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 class="text-xl font-black">選擇比較議題</h2><p class="mt-1 text-xs text-[#77716a]">已選 {{ selectedIds.length }} / 5 個</p></div><button type="button" class="focus-ring min-h-11 bg-[#3157d5] px-5 text-sm font-black text-white disabled:opacity-40" :disabled="selectedIds.length < 2 || comparing" @click="compare">{{ comparing ? '分析中…' : '產生比較分析' }}</button></div>
        <div class="mt-4 grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          <label v-for="topic in topics" :key="topic.id" class="flex cursor-pointer items-start gap-3 border bg-white p-3" :class="selectedIds.includes(topic.id) ? 'border-[#3157d5] shadow-[inset_3px_0_0_#3157d5]' : 'border-[#d7d1c6]'">
            <input type="checkbox" class="mt-1 accent-[#3157d5]" :checked="selectedIds.includes(topic.id)" :disabled="!selectedIds.includes(topic.id) && selectedIds.length >= 5" @change="toggleTopic(topic.id)" />
            <span class="text-sm"><small class="block font-black text-[#77716a]">{{ getCategoryMeta(topic.category).label }}</small><strong class="mt-1 block leading-5">{{ topic.title }}</strong></span>
          </label>
        </div>
        <label class="mt-4 block max-w-sm border-t border-[#d7d1c6] pt-4"><span class="mb-2 block text-xs font-black text-[#5f5a53]">群眾輪廓維度</span><select v-model="dimension" class="focus-ring w-full border-2 border-[#171717] bg-white px-4 py-3 text-sm font-bold"><optgroup v-for="group in demographicDimensionGroups" :key="group.label" :label="group.label"><option v-for="item in group.items" :key="item.value" :value="item.value">{{ item.label }}</option></optgroup></select></label>
      </section>

      <p v-if="operationError" role="alert" class="mt-5 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm font-bold text-[#a63222]">{{ operationError }}</p>

      <template v-if="result">
        <p v-if="resultStale" class="mt-5 border-l-4 border-[#9a5b12] bg-[#fff0d7] p-4 text-sm font-bold text-[#7a4a10]">選擇條件已變更，下方仍顯示上一次分析。請重新產生比較。</p>
        <div class="mt-8 grid gap-5 lg:grid-cols-2">
          <article class="border border-[#d7d1c6] bg-white p-4"><h2 class="font-black">參與規模</h2><DataChart class="mt-3 h-80" :option="volumeChart" /></article>
          <article class="border border-[#d7d1c6] bg-white p-4"><h2 class="font-black">平均每日參與</h2><p class="mt-1 text-xs text-[#77716a]">依議題公開後至目前或截止日的有效期間計算。</p><DataChart class="mt-3 h-80" :option="velocityChart" /></article>
          <article class="border border-[#d7d1c6] bg-white p-4"><h2 class="font-black">領先差距</h2><DataChart class="mt-3 h-80" :option="leadMarginChart" /></article>
          <article class="border border-[#d7d1c6] bg-white p-4"><h2 class="font-black">共識與討論密度</h2><p class="mt-1 text-xs text-[#77716a]">共同立場占比與每 100 票產生的討論數。</p><DataChart class="mt-3 h-80" :option="structureChart" /></article>
        </div>
        <section class="mt-6"><div class="border-b-2 border-[#171717] pb-3"><p class="eyebrow text-[#3157d5]">議題剖面</p><h2 class="mt-1 text-2xl font-black">結果、樣本與討論結構</h2></div><div class="mt-4 grid gap-4 lg:grid-cols-2">
          <article v-for="item in result.items" :key="item.id" class="border-2 border-[#171717] bg-[#faf8f3] p-5">
            <p class="text-xs font-black text-[#77716a]">{{ getCategoryMeta(item.category).label }}</p><NuxtLink :to="`/topic/${item.id}?section=statistics`" class="focus-ring mt-2 block text-lg font-black leading-6 hover:text-[#3157d5]">{{ item.title }}</NuxtLink>
            <div class="mt-4 grid grid-cols-2 gap-px bg-[#d7d1c6] text-xs sm:grid-cols-3"><div class="bg-white p-3"><small>總票數</small><strong class="mt-1 block text-lg">{{ item.totalVotes }}</strong></div><div class="bg-white p-3"><small>人口涵蓋</small><strong class="mt-1 block text-lg">{{ item.profileCoveragePercent }}%</strong></div><div class="bg-white p-3"><small>每日平均</small><strong class="mt-1 block text-lg">{{ item.votesPerDay }}</strong></div><div class="bg-white p-3"><small>共識率</small><strong class="mt-1 block text-lg">{{ item.commonGroundRate }}%</strong></div><div class="bg-white p-3"><small>每百票討論</small><strong class="mt-1 block text-lg">{{ item.discussionsPer100Votes }}</strong></div><div class="bg-white p-3"><small>正式立場</small><strong class="mt-1 block text-lg">{{ item.stanceCount }}</strong></div></div>
            <div v-if="item.spectrum" class="mt-4 grid grid-cols-2 gap-px bg-[#d7d1c6] text-xs"><div class="bg-white p-3"><small>光譜中位數</small><strong class="mt-1 block text-lg">{{ item.spectrum.median ?? '—' }}</strong></div><div class="bg-white p-3"><small>離散程度</small><strong class="mt-1 block text-lg">{{ item.spectrum.stddev ?? '—' }}</strong></div></div>
            <div v-else class="mt-4 space-y-2"><div v-for="option in item.options" :key="option.optionId"><div class="flex justify-between text-xs"><span>{{ option.label }}</span><strong>{{ option.percentage }}%</strong></div><div class="mt-1 h-2 bg-[#e5e0d6]"><div class="h-full bg-[#3157d5]" :style="{ width: `${option.percentage}%` }" /></div></div></div>
            <div v-if="item.demographic?.insights.length" class="mt-4 space-y-2"><p v-for="insight in item.demographic.insights" :key="`${insight.group}-${insight.optionId || insight.metric}`" class="border-l-4 border-[#d84a36] bg-[#fbe9e5] p-3 text-xs leading-5">{{ demographicLabel(insight.group) }}：{{ demographicInsightText(insight) }}</p></div>
            <details v-if="item.demographic?.available" class="mt-4 border border-[#d7d1c6] bg-white p-3"><summary class="focus-ring cursor-pointer text-xs font-black">查看完整群眾分群</summary><div class="mt-3 space-y-2"><div v-for="group in item.demographic.groups" :key="group.key" class="border-t border-[#e5e0d6] pt-2 text-xs"><strong>{{ demographicLabel(group.key) }}（{{ group.count }}）</strong><p v-if="group.options" class="mt-1 text-[#5f5a53]">{{ group.options.map((option) => `${option.label} ${option.percentage}%`).join(' · ') }}</p><p v-else class="mt-1 text-[#5f5a53]">光譜中位數 {{ group.median ?? '—' }}</p></div></div></details>
          </article>
        </div></section>
        <p class="mt-5 text-right text-xs text-[#77716a]">產生時間：{{ new Date(result.generatedAt).toLocaleString('zh-TW') }}</p>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { AnalyticsComparison, AnalyticsComparisonAccess } from '~/types/analytics';
import type { DemographicDimension } from '~/types/profile';
import type { Topic, TopicListResponse } from '~/types/topic';
import { getCategoryMeta } from '~/utils/topic';

definePageMeta({ middleware: 'auth' });
useSeoMeta({ title: '跨議題比較｜輿論測風向' });
const api = useApi();
const loading = ref(true); const comparing = ref(false); const pageError = ref(''); const operationError = ref('');
const access = ref<AnalyticsComparisonAccess | null>(null); const topics = ref<Topic[]>([]); const selectedIds = ref<string[]>([]); const result = ref<AnalyticsComparison | null>(null);
const dimension = ref<DemographicDimension>('AGE_BAND');
const volumeChart = computed(() => comparisonBar('totalVotes', '票'));
const velocityChart = computed(() => comparisonBar('votesPerDay', '票／日'));
const leadMarginChart = computed(() => comparisonBar('leadMargin', '百分點'));
const structureChart = computed(() => { const items = result.value?.items ?? []; return { color: ['#3f7a58', '#d84a36'], tooltip: { trigger: 'axis' }, legend: { bottom: 0 }, grid: { left: 20, right: 20, top: 15, bottom: 50, containLabel: true }, xAxis: { type: 'value', axisLabel: { formatter: '{value}' } }, yAxis: { type: 'category', data: items.map((item) => truncate(item.title)) }, series: [{ name: '共識率 %', type: 'bar', data: items.map((item) => item.commonGroundRate) }, { name: '每百票討論', type: 'bar', data: items.map((item) => item.discussionsPer100Votes) }] }; });
const comparisonKey = computed(() => `${[...selectedIds.value].sort().join(',')}|${dimension.value}`);
const lastComparisonKey = ref('');
const resultStale = computed(() => Boolean(result.value) && comparisonKey.value !== lastComparisonKey.value);
function comparisonBar(field: 'totalVotes' | 'votesPerDay' | 'leadMargin', unit: string) { const items = result.value?.items ?? []; return { color: ['#3157d5'], tooltip: { trigger: 'axis', valueFormatter: (value: number) => `${value} ${unit}` }, grid: { left: 20, right: 20, top: 15, bottom: 20, containLabel: true }, xAxis: { type: 'value' }, yAxis: { type: 'category', data: items.map((item) => truncate(item.title)) }, series: [{ type: 'bar', data: items.map((item) => item[field]), barMaxWidth: 30 }] }; }
function truncate(value: string) { return value.length > 16 ? `${value.slice(0, 16)}…` : value; }
function toggleTopic(id: string) { selectedIds.value = selectedIds.value.includes(id) ? selectedIds.value.filter((item) => item !== id) : [...selectedIds.value, id]; }
function demographicLabel(value: string) { return demographicLabels[value] || value; }
function demographicInsightText(insight: NonNullable<AnalyticsComparison['items'][number]['demographic']>['insights'][number]) { return insight.metric === 'MEDIAN_GAP' ? `光譜中位數較整體${insight.value >= 0 ? '高' : '低'} ${Math.abs(insight.value)} 分` : `「${insight.optionLabel}」較整體${insight.value >= 0 ? '高' : '低'} ${Math.abs(insight.value)} 個百分點`; }
async function compare() { comparing.value = true; operationError.value = ''; try { result.value = await api.get<AnalyticsComparison>('/analytics/comparison', { topicIds: selectedIds.value.join(','), dimension: dimension.value }); lastComparisonKey.value = comparisonKey.value; } catch (cause) { operationError.value = errorMessage(cause); } finally { comparing.value = false; } }
onMounted(async () => { try { access.value = await api.get<AnalyticsComparisonAccess>('/analytics/access'); if (access.value.canCompare) topics.value = (await api.get<TopicListResponse>('/topics', { limit: 50 })).items; } catch (cause) { pageError.value = errorMessage(cause); } finally { loading.value = false; } });
</script>

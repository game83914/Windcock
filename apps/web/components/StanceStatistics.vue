<template>
  <section data-stance-statistics class="border-2 border-[#171717] bg-[#faf8f3] shadow-[6px_6px_0_#d7d1c6]">
    <header class="grid gap-5 border-b border-[#171717] px-5 py-6 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-end">
      <div>
        <p class="eyebrow text-[#3f7a58]">統計數據</p>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-[#6d6861]">開發期間分析模組免費提供管理員、合作廠商與議題小組測試。資料反映平台參與者，不代表全體民意。</p>
      </div>
      <div v-if="access" class="border-l-4 border-[#3157d5] bg-[#e7ecff] px-4 py-3">
        <p class="text-[10px] font-black text-[#5f5a53]">目前有效票數</p>
        <p class="mt-1 text-3xl font-black tabular-nums text-[#3157d5]">{{ access.totalVotes }}</p>
      </div>
    </header>

    <div class="p-4 sm:p-6">
      <p v-if="pageError" role="alert" class="mb-5 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm font-bold text-[#a63222]">{{ pageError }}</p>
      <div v-if="loading" role="status" class="grid gap-3 md:grid-cols-3"><div v-for="item in 3" :key="item" class="h-44 animate-pulse bg-[#e5e0d6]" /></div>

      <template v-else-if="access">
        <div class="grid gap-3 md:grid-cols-3">
          <article v-for="item in moduleCards" :key="item.module" class="flex flex-col border-2 p-4" :class="item.access.available ? 'border-[#3f7a58] bg-[#eff6f1]' : 'border-[#cfc8bc] bg-white'">
            <div class="flex items-start justify-between gap-3">
              <div><p class="text-[10px] font-black tracking-[0.12em]" :class="item.access.available ? 'text-[#3f7a58]' : 'text-[#77716a]'">{{ item.kicker }}</p><h3 class="mt-1 text-lg font-black">{{ item.title }}</h3></div>
              <span v-if="item.access.available" class="bg-[#3f7a58] px-2 py-1 text-[10px] font-black text-white">可查看</span>
            </div>
            <p class="mt-3 flex-1 text-xs leading-5 text-[#5f5a53]">{{ item.description }}</p>
            <button v-if="item.access.available" type="button" class="focus-ring mt-4 min-h-11 border border-[#3f7a58] px-4 text-sm font-black text-[#2f6547]" @click="scrollToModule(item.module)">查看分析 &darr;</button>
            <p v-else class="mt-4 bg-[#ebe6dc] p-3 text-xs font-bold text-[#77716a]">目前資料尚未達顯示條件。</p>
          </article>
        </div>

        <section v-if="executiveInsights.length" class="mt-10 border-2 border-[#171717] bg-white p-5 sm:p-6">
          <div class="border-b border-[#171717] pb-4">
            <p class="eyebrow text-[#3157d5]">決策摘要</p>
            <h3 class="mt-1 text-2xl font-black">目前最值得注意的訊號</h3>
            <p class="mt-2 text-xs leading-5 text-[#77716a]">以下為平台參與者洞察，不代表全體人口；請搭配樣本數、涵蓋率與方法說明判讀。</p>
          </div>
          <div class="mt-4 grid gap-px bg-[#d7d1c6] md:grid-cols-2">
            <article v-for="insight in executiveInsights" :key="insight.kicker" class="bg-[#faf8f3] p-4">
              <p class="text-[10px] font-black tracking-[0.12em]" :style="{ color: insight.color }">{{ insight.kicker }}</p>
              <strong class="mt-2 block text-xl font-black">{{ insight.title }}</strong>
              <p class="mt-2 text-xs leading-5 text-[#5f5a53]">{{ insight.description }}</p>
            </article>
          </div>
        </section>

        <section v-if="trendAccess?.available" id="analytics-result-trends" class="mt-10 scroll-mt-28 border-t-4 border-[#3157d5] pt-5">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p class="eyebrow text-[#3157d5]">01 / 結果與趨勢</p><h3 class="mt-1 text-2xl font-black">票流如何形成</h3></div><p v-if="trends" class="text-xs text-[#77716a]">最近更新 {{ formatTime(trends.generatedAt) }}</p></div>
          <div v-if="moduleLoading.RESULT_TRENDS" class="mt-5 h-80 animate-pulse bg-[#e5e0d6]" />
          <template v-else-if="trends">
            <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="總投票" :value="String(trends.totalVotes)" suffix="票" />
              <MetricCard label="領先差距" :value="String(trends.leadMargin)" suffix="百分點" />
              <MetricCard label="最近 24 小時" :value="String(trends.velocity.last24Hours)" :suffix="velocityLabel" />
              <MetricCard label="單日高峰" :value="String(trends.peakDay?.votes ?? 0)" :suffix="trends.peakDay ? `票 · ${formatDate(trends.peakDay.date)}` : '票'" />
            </div>
            <div v-if="trends.spectrum" class="mt-3 grid gap-3 sm:grid-cols-4">
              <MetricCard label="中位數" :value="formatMetric(trends.spectrum.median)" suffix="分" />
              <MetricCard label="第一四分位" :value="formatMetric(trends.spectrum.q1)" suffix="分" />
              <MetricCard label="第三四分位" :value="formatMetric(trends.spectrum.q3)" suffix="分" />
              <MetricCard label="離散程度" :value="formatMetric(trends.spectrum.stddev)" suffix="標準差" />
            </div>
            <div class="mt-5 grid gap-5 lg:grid-cols-2">
              <article class="border border-[#d7d1c6] bg-white p-4"><h4 class="font-black">目前分布</h4><DataChart class="mt-3 h-72" :option="resultChartOption" /></article>
              <article v-if="!trends.spectrum" class="border border-[#d7d1c6] bg-white p-4"><h4 class="font-black">選項占比走勢</h4><p class="mt-1 text-xs text-[#77716a]">觀察領先交叉與支持比例是否持續變動。</p><DataChart class="mt-3 h-72" :option="shareTimelineChartOption" /></article>
              <article class="border border-[#d7d1c6] bg-white p-4" :class="!trends.spectrum && 'lg:col-span-2'"><h4 class="font-black">每日參與動能</h4><DataChart class="mt-3 h-72" :option="timelineChartOption" /></article>
            </div>
            <details v-if="trends.options.length" class="mt-4 border border-[#d7d1c6] bg-white p-4"><summary class="focus-ring cursor-pointer text-sm font-black">查看選項精確數據</summary><div class="mt-4 overflow-x-auto"><table class="w-full min-w-[36rem] text-left text-xs"><thead class="border-b-2 border-[#171717]"><tr><th class="p-2">選項</th><th class="p-2 text-right">目前票數</th><th class="p-2 text-right">目前占比</th><th class="p-2 text-right">近 24 小時</th><th class="p-2 text-right">占比變化</th></tr></thead><tbody class="divide-y divide-[#d7d1c6]"><tr v-for="option in trends.options" :key="option.optionId"><td class="p-2 font-bold">{{ option.label }}</td><td class="p-2 text-right tabular-nums">{{ option.count }}</td><td class="p-2 text-right tabular-nums">{{ option.percentage }}%</td><td class="p-2 text-right tabular-nums">{{ momentumFor(option.optionId)?.last24Hours ?? 0 }}</td><td class="p-2 text-right font-bold tabular-nums">{{ signed(momentumFor(option.optionId)?.shareChange ?? 0) }} 個百分點</td></tr></tbody></table></div></details>
            <p class="mt-4 border-l-2 border-[#9a5b12] pl-3 text-xs leading-5 text-[#77716a]">{{ trends.methodology }}</p>
          </template>
        </section>

        <section v-if="demographicAccess?.available" id="analytics-demographics" class="mt-10 scroll-mt-28 border-t-4 border-[#d84a36] pt-5">
          <div><p class="eyebrow text-[#d84a36]">02 / 群眾輪廓</p><h3 class="mt-1 text-2xl font-black">誰參與了這次投票</h3></div>
          <label class="mt-4 block max-w-sm"><span class="mb-2 block text-xs font-black text-[#5f5a53]">分析維度</span><select :value="dimension" class="focus-ring w-full border-2 border-[#171717] bg-white px-4 py-3 text-sm font-bold" @change="setDimension(($event.target as HTMLSelectElement).value as DemographicDimension)"><optgroup v-for="group in demographicDimensionGroups" :key="group.label" :label="group.label"><option v-for="item in group.items" :key="item.value" :value="item.value">{{ item.label }}</option></optgroup></select></label>
          <div v-if="moduleLoading.DEMOGRAPHICS" class="mt-4 h-80 animate-pulse bg-[#e5e0d6]" />
          <template v-else-if="demographics">
            <div class="mt-3 grid gap-3 sm:grid-cols-3"><MetricCard label="有效分群樣本" :value="String(demographics.dimensionVotes)" suffix="票" /><MetricCard label="資料涵蓋率" :value="String(demographics.coveragePercent)" suffix="%" /><MetricCard label="匿名門檻" :value="String(demographics.thresholds.cohort)" suffix="人／群" /></div>
            <p v-if="!demographics.available" class="mt-5 border border-[#d7d1c6] bg-white p-6 text-center text-sm text-[#5f5a53]">目前資料未達匿名顯示門檻。</p>
            <template v-else>
              <article class="mt-5 border border-[#d7d1c6] bg-white p-4"><h4 class="font-black">各群組選擇分布</h4><DataChart class="mt-3 h-[26rem]" :option="demographicChartOption" /></article>
              <div v-if="demographics.insights.length" class="mt-4 grid gap-3 md:grid-cols-3"><article v-for="insight in demographics.insights" :key="`${insight.group}-${insight.optionId || insight.metric}`" class="border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm"><strong class="block">{{ demographicLabel(insight.group) }}</strong><p class="mt-1 text-xs leading-5">{{ insightText(insight) }}</p></article></div>
              <details class="mt-4 border border-[#d7d1c6] bg-white p-4"><summary class="focus-ring cursor-pointer text-sm font-black">查看完整分群數據</summary><div class="mt-4 overflow-x-auto"><table class="w-full min-w-[38rem] text-left text-xs"><thead class="border-b-2 border-[#171717]"><tr><th class="p-2">群組</th><th class="p-2 text-right">樣本</th><template v-if="demographicOptionLabels.length"><th v-for="label in demographicOptionLabels" :key="label" class="p-2 text-right">{{ label }}</th></template><th v-else class="p-2 text-right">光譜中位數</th></tr></thead><tbody class="divide-y divide-[#d7d1c6]"><tr v-for="group in demographicRows" :key="group.key"><td class="p-2 font-bold">{{ group.key === 'BASELINE' ? '整體基準' : demographicLabel(group.key) }}</td><td class="p-2 text-right tabular-nums">{{ group.count }}</td><template v-if="group.options"><td v-for="label in demographicOptionLabels" :key="label" class="p-2 text-right tabular-nums">{{ group.options.find((item) => item.label === label)?.percentage ?? 0 }}%</td></template><td v-else class="p-2 text-right tabular-nums">{{ group.median ?? '—' }}</td></tr></tbody></table></div></details>
            </template>
            <p v-if="demographics.suppressed" class="mt-3 text-xs text-[#77716a]">部分群組因樣本不足或互補隱藏規則而不顯示。</p>
            <p class="mt-4 border-l-2 border-[#9a5b12] pl-3 text-xs leading-5 text-[#77716a]">{{ demographics.methodology }}</p>
          </template>
        </section>

        <section v-if="stanceAccess?.available" id="analytics-stances" class="mt-10 scroll-mt-28 border-t-4 border-[#3f7a58] pt-5">
          <div><p class="eyebrow text-[#3f7a58]">03 / 立場結構</p><h3 class="mt-1 text-2xl font-black">共識與分歧落在哪裡</h3></div>
          <div v-if="moduleLoading.STANCE_INSIGHTS" class="mt-5 h-80 animate-pulse bg-[#e5e0d6]" />
          <template v-else-if="stances">
            <div class="mt-5 grid gap-3 sm:grid-cols-3"><MetricCard label="正式立場" :value="String(stances.stanceCount)" suffix="個" /><MetricCard label="直接回應議題" :value="String(stances.directStanceCount)" suffix="個" /><MetricCard label="跨陣營共同立場" :value="String(stances.commonGroundCount)" suffix="個" /></div>
            <article v-if="stanceScatterOption" class="mt-5 border border-[#d7d1c6] bg-white p-4"><h4 class="font-black">跨陣營支持地圖</h4><p class="mt-1 text-xs text-[#77716a]">越靠右上，代表越能同時獲得兩個陣營支持。</p><DataChart class="mt-3 h-[28rem]" :option="stanceScatterOption" /></article>
            <div class="mt-5 divide-y divide-[#d7d1c6] border border-[#d7d1c6] bg-white">
              <article v-for="node in stances.nodes" :key="node.id" class="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div><span v-if="node.commonGround" class="mr-2 bg-[#3f7a58] px-2 py-1 text-[10px] font-black text-white">共同立場</span><span v-if="node.suppressed" class="mr-2 bg-[#ebe6dc] px-2 py-1 text-[10px] font-black text-[#6d6861]">小樣本隱藏</span><NuxtLink :to="stanceLink(node.id)" class="focus-ring font-black leading-6 hover:text-[#3157d5]">{{ node.title }}</NuxtLink><p class="mt-1 text-xs text-[#77716a]">{{ privateCount(node.agreed) }} 認同 · {{ privateCount(node.disagreed) }} 不認同 · {{ node.discussionCount }} 討論</p></div>
                <NuxtLink :to="stanceLink(node.id, node.discussionCount > 0)" class="focus-ring min-h-10 py-3 text-xs font-black text-[#3157d5]">{{ node.discussionCount ? '查看討論' : '查看立場' }} &rarr;</NuxtLink>
              </article>
            </div>
            <p class="mt-4 border-l-2 border-[#9a5b12] pl-3 text-xs leading-5 text-[#77716a]">{{ stances.methodology }}</p>
          </template>
        </section>

        <aside class="mt-10 grid gap-4 border-2 border-[#171717] bg-[#171717] p-5 text-white md:grid-cols-[1fr_auto] md:items-center">
          <div><p class="eyebrow text-[#9fb2ff]">企業分析</p><h3 class="mt-1 text-xl font-black">比較多個議題的群眾傾向與討論結構</h3><p class="mt-2 text-xs leading-5 text-[#d7d1c6]">跨議題比較採人工企業授權，適合媒體、研究團隊與合作組織。</p></div>
          <NuxtLink to="/analytics/compare" class="focus-ring bg-white px-5 py-3 text-center text-sm font-black text-[#171717]">前往比較工作台 &rarr;</NuxtLink>
        </aside>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';
import type { DemographicDimension } from '~/types/profile';
import type { AnalyticsAccess, AnalyticsModule, DemographicAnalytics, DemographicAnalyticsGroup, StanceAnalytics, TrendAnalytics } from '~/types/analytics';

const props = defineProps<{ topicId: string }>();
const api = useApi();
const auth = useAuthStore();
const route = useRoute();
const access = ref<AnalyticsAccess | null>(null);
const trends = ref<TrendAnalytics | null>(null);
const demographics = ref<DemographicAnalytics | null>(null);
const stances = ref<StanceAnalytics | null>(null);
const loading = ref(true);
const pageError = ref('');
const dimension = ref<DemographicDimension>('AGE_BAND');
const moduleLoading = reactive<Record<AnalyticsModule, boolean>>({ RESULT_TRENDS: false, DEMOGRAPHICS: false, STANCE_INSIGHTS: false });
const palette = ['#3157d5', '#d84a36', '#9a5b12', '#3f7a58', '#7b4fd0', '#6d6861'];
const moduleMeta: Record<AnalyticsModule, { kicker: string; title: string; description: string; anchor: string }> = {
  RESULT_TRENDS: { kicker: '測試期間免費', title: '結果與趨勢', description: '查看專業結果圖、光譜分布、領先差距，以及票數隨時間累積的變化。', anchor: 'analytics-result-trends' },
  DEMOGRAPHICS: { kicker: '測試期間免費', title: '群眾輪廓', description: '比較人口、居住、工作、收入、生活狀態與人格的匿名單維度投票傾向。', anchor: 'analytics-demographics' },
  STANCE_INSIGHTS: { kicker: '測試期間免費', title: '立場結構', description: '分析跨陣營支持率、共同立場，以及哪些內容帶來最多討論。', anchor: 'analytics-stances' },
};

const moduleCards = computed(() => access.value?.modules.map((item) => ({ ...moduleMeta[item.module], module: item.module, access: item })) ?? []);
const trendAccess = computed(() => access.value?.modules.find((item) => item.module === 'RESULT_TRENDS'));
const demographicAccess = computed(() => access.value?.modules.find((item) => item.module === 'DEMOGRAPHICS'));
const stanceAccess = computed(() => access.value?.modules.find((item) => item.module === 'STANCE_INSIGHTS'));
const velocityLabel = computed(() => trends.value?.velocity.changePercent === null ? '票' : `票 · ${trends.value!.velocity.changePercent! >= 0 ? '+' : ''}${trends.value!.velocity.changePercent}%`);
const leadingOption = computed(() => [...(trends.value?.options ?? [])].sort((a, b) => b.percentage - a.percentage)[0] ?? null);
const fastestMomentum = computed(() => trends.value?.optionMomentum.find((item) => item.optionId === trends.value?.fastestGrowingOptionId) ?? null);
const executiveInsights = computed(() => {
  const items: Array<{ kicker: string; title: string; description: string; color: string }> = [];
  if (trends.value?.spectrum) {
    items.push({ kicker: '目前位置', title: trends.value.spectrum.median === null ? '尚無光譜資料' : `中位數 ${trends.value.spectrum.median} 分`, description: `中間 50% 的參與者落在 ${formatMetric(trends.value.spectrum.q1)}–${formatMetric(trends.value.spectrum.q3)} 分。`, color: '#3157d5' });
  } else if (leadingOption.value) {
    items.push({ kicker: '目前領先', title: `${leadingOption.value.label} ${leadingOption.value.percentage}%`, description: `與次高選項相差 ${trends.value?.leadMargin ?? 0} 個百分點。`, color: '#3157d5' });
  }
  if (trends.value?.latestCrossover) {
    items.push({ kicker: '最近轉折', title: `${trends.value.latestCrossover.toLabel} 取得領先`, description: `${formatDate(trends.value.latestCrossover.date)} 超越「${trends.value.latestCrossover.fromLabel}」。`, color: '#d84a36' });
  } else if (fastestMomentum.value?.last24Hours) {
    items.push({ kicker: '近 24 小時動能', title: `${fastestMomentum.value.label} ${signed(fastestMomentum.value.shareChange)} 個百分點`, description: `最近 24 小時新增 ${fastestMomentum.value.last24Hours} 票。`, color: '#d84a36' });
  }
  const demographicInsight = demographics.value?.insights[0];
  if (demographicInsight) {
    items.push({ kicker: '最大群眾差異', title: demographicLabel(demographicInsight.group), description: insightText(demographicInsight), color: '#9a5b12' });
  } else if (demographics.value) {
    items.push({ kicker: '輪廓資料品質', title: `涵蓋率 ${demographics.value.coveragePercent}%`, description: `目前有 ${demographics.value.dimensionVotes} 筆有效分群樣本。`, color: '#9a5b12' });
  }
  if (stances.value) {
    const rate = stances.value.stanceCount ? Math.round(stances.value.commonGroundCount / stances.value.stanceCount * 100) : 0;
    items.push({ kicker: '共識訊號', title: `${stances.value.commonGroundCount} 個跨陣營立場`, description: `占目前正式立場約 ${rate}%；小樣本支持資料不列入。`, color: '#3f7a58' });
  }
  return items.slice(0, 4);
});

const resultChartOption = computed(() => {
  if (!trends.value) return {};
  const data = trends.value.spectrum?.bins ?? trends.value.options.map((item) => ({ label: item.label, count: item.count }));
  return { color: [palette[0]], tooltip: { trigger: 'axis' }, grid: { left: 20, right: 20, top: 15, bottom: 25, containLabel: true }, xAxis: { type: 'value' }, yAxis: { type: 'category', data: data.map((item) => item.label), axisLabel: { interval: 0 } }, series: [{ type: 'bar', data: data.map((item) => item.count), barMaxWidth: 28 }] };
});
const timelineChartOption = computed(() => ({ color: [palette[0], palette[1]], tooltip: { trigger: 'axis' }, legend: { bottom: 0 }, grid: { left: 20, right: 20, top: 20, bottom: 45, containLabel: true }, xAxis: { type: 'category', data: trends.value?.timeline.map((item) => item.date.slice(5)) ?? [] }, yAxis: [{ type: 'value' }, { type: 'value' }], series: [{ name: '累積票數', type: 'line', smooth: true, data: trends.value?.timeline.map((item) => item.cumulativeVotes) ?? [] }, { name: '當日新增', type: 'bar', yAxisIndex: 1, data: trends.value?.timeline.map((item) => item.votes) ?? [] }] }));
const shareTimelineChartOption = computed(() => ({
  color: palette,
  tooltip: { trigger: 'axis', valueFormatter: (value: number) => `${value}%` },
  legend: { bottom: 0 },
  grid: { left: 20, right: 20, top: 20, bottom: 55, containLabel: true },
  xAxis: { type: 'category', data: trends.value?.timeline.map((item) => item.date.slice(5)) ?? [] },
  yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
  series: (trends.value?.options ?? []).map((option) => ({ name: option.label, type: 'line', smooth: true, showSymbol: false, data: trends.value?.timeline.map((point) => point.options.find((item) => item.optionId === option.optionId)?.percentage ?? 0) ?? [] })),
}));
const demographicChartOption = computed(() => {
  const groups = demographics.value?.groups ?? [];
  const optionLabels = groups[0]?.options?.map((item) => item.label) ?? [];
  return { color: palette, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, legend: { bottom: 0 }, grid: { left: 20, right: 20, top: 15, bottom: 55, containLabel: true }, xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } }, yAxis: { type: 'category', data: groups.map((group) => demographicLabel(group.key)) }, series: optionLabels.map((label) => ({ name: label, type: 'bar', stack: 'total', data: groups.map((group) => group.options?.find((item) => item.label === label)?.percentage ?? 0) })) };
});
const demographicRows = computed<DemographicAnalyticsGroup[]>(() => demographics.value?.baseline
  ? [demographics.value.baseline, ...demographics.value.groups]
  : demographics.value?.groups ?? []);
const demographicOptionLabels = computed(() => demographics.value?.baseline?.options?.map((item) => item.label)
  ?? demographics.value?.groups[0]?.options?.map((item) => item.label)
  ?? []);
const stanceScatterOption = computed(() => {
  const nodes = stances.value?.nodes.filter((node) => node.camps?.length === 2) ?? [];
  if (!nodes.length) return null;
  const camps = nodes[0].camps!;
  return { color: [palette[2]], tooltip: { formatter: (params: any) => `${params.data.name}<br>${camps[0].label} ${params.data.value[0]}%<br>${camps[1].label} ${params.data.value[1]}%` }, grid: { left: 20, right: 25, top: 20, bottom: 30, containLabel: true }, xAxis: { type: 'value', min: 0, max: 100, name: camps[0].label, axisLabel: { formatter: '{value}%' } }, yAxis: { type: 'value', min: 0, max: 100, name: camps[1].label, axisLabel: { formatter: '{value}%' } }, series: [{ type: 'scatter', symbolSize: (value: number[]) => Math.max(10, Math.min(30, (value[2] || 0) + 8)), data: nodes.map((node) => ({ name: node.title, value: [node.camps![0].supportPercent, node.camps![1].supportPercent, node.discussionCount] })) }] };
});

let demographicRequestId = 0;

async function load() {
  loading.value = true; pageError.value = '';
  try { access.value = await api.get<AnalyticsAccess>(`/topics/${props.topicId}/analytics/access`); await loadAvailable(); }
  catch (cause) { pageError.value = errorMessage(cause); }
  finally { loading.value = false; }
}
async function loadAvailable() {
  const jobs: Promise<void>[] = [];
  if (trendAccess.value?.available) jobs.push(loadTrends());
  if (demographicAccess.value?.available) jobs.push(loadDemographics());
  if (stanceAccess.value?.available) jobs.push(loadStances());
  await Promise.all(jobs);
}
async function loadTrends() { moduleLoading.RESULT_TRENDS = true; try { trends.value = await api.get<TrendAnalytics>(`/topics/${props.topicId}/analytics/trends`); } catch (cause) { pageError.value = errorMessage(cause); } finally { moduleLoading.RESULT_TRENDS = false; } }
async function loadDemographics() { const requestId = ++demographicRequestId; moduleLoading.DEMOGRAPHICS = true; try { const result = await api.get<DemographicAnalytics>(`/topics/${props.topicId}/analytics/demographics`, { dimension: dimension.value }); if (requestId === demographicRequestId) demographics.value = result; } catch (cause) { if (requestId === demographicRequestId) pageError.value = errorMessage(cause); } finally { if (requestId === demographicRequestId) moduleLoading.DEMOGRAPHICS = false; } }
async function loadStances() { moduleLoading.STANCE_INSIGHTS = true; try { stances.value = await api.get<StanceAnalytics>(`/topics/${props.topicId}/analytics/stances`); } catch (cause) { pageError.value = errorMessage(cause); } finally { moduleLoading.STANCE_INSIGHTS = false; } }
function setDimension(value: DemographicDimension) { dimension.value = value; loadDemographics(); }
function demographicLabel(value: string) { return demographicLabels[value] || value; }
function insightText(insight: DemographicAnalytics['insights'][number]) { if (insight.metric === 'MEDIAN_GAP') return `光譜中位數較整體樣本${insight.value >= 0 ? '高' : '低'} ${Math.abs(insight.value)} 分。`; return `選擇「${insight.optionLabel}」的比例較整體樣本${insight.value >= 0 ? '高' : '低'} ${Math.abs(insight.value)} 個百分點。`; }
function momentumFor(optionId: string) { return trends.value?.optionMomentum.find((item) => item.optionId === optionId); }
function signed(value: number) { return `${value > 0 ? '+' : ''}${value}`; }
function formatMetric(value: number | null) { return value === null ? '—' : String(Math.round(value * 10) / 10); }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric' }).format(new Date(`${value}T00:00:00+08:00`)); }
function privateCount(value: number | null) { return value === null ? '—' : String(value); }
function stanceLink(stanceId: string, discussion = false): RouteLocationRaw { return { path: route.path, query: { section: 'stances', stance: stanceId, ...(discussion ? { tab: 'discussion' } : {}) } }; }
function formatTime(value: string) { return new Date(value).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
async function scrollToModule(module: AnalyticsModule) { await nextTick(); document.getElementById(moduleMeta[module].anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
watch(() => props.topicId, () => { trends.value = null; demographics.value = null; stances.value = null; load(); });
onMounted(load);
</script>

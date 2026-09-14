<template>
  <section class="border-2 border-[#171717] bg-[#faf8f3] p-4 sm:p-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="eyebrow text-[#171717]">議題生成器</p>
        <h2 class="mt-1 text-xl font-black">匯入完整議題 JSON</h2>
        <p class="mt-1 max-w-2xl text-xs leading-5 text-[#5f5a53]">貼上已整理好的議題 JSON（含補充內容與立場樹），檢查通過後會自動填入下方表單，於表單底部一併建立議題與立場。系統直接讀取並驗證，不會以 AI 補全或檢查內容。</p>
      </div>
      <div class="flex items-center gap-2">
        <label class="focus-ring inline-flex min-h-10 cursor-pointer items-center border border-[#171717] bg-white px-3 text-xs font-black">
          <span>選擇 .json 檔案</span>
          <input ref="fileInput" type="file" accept=".json,application/json" class="sr-only" @change="loadFile" />
        </label>
        <button type="button" class="focus-ring min-h-10 px-2 text-xs font-black text-[#6d6861]" @click="insertTemplate">填入範本</button>
      </div>
    </div>

    <div class="mt-4">
      <label class="block text-xs font-black" for="topic-json-import">JSON 內容</label>
      <textarea id="topic-json-import" v-model="source" rows="12" class="focus-ring mt-2 w-full resize-y border border-[#bfb8ad] bg-white p-3 font-mono text-xs leading-5" placeholder='{\n  "title": "……",\n  "category": "politics",\n  "topicType": "BINARY",\n  "options": ["支持", "反對"],\n  "voteDurationDays": 7,\n  "blocks": [],\n  "stances": []\n}' spellcheck="false" />
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-3">
      <button type="button" class="focus-ring min-h-11 bg-[#171717] px-5 text-sm font-black text-white disabled:opacity-40" :disabled="busy || !source.trim()" @click="preview">{{ busy ? '檢查中…' : '檢查並預覽' }}</button>
      <span class="text-[11px] text-[#77716a]">{{ source.trim().length }} / 200000</span>
    </div>

    <div v-if="summary" class="mt-4 border-t border-[#ded8cd] pt-4">
      <dl class="grid gap-2 sm:grid-cols-2">
        <div class="border border-[#d7d1c6] bg-[#f8f6f1] p-3">
          <dt class="text-[10px] font-black tracking-[0.14em] text-[#8b857d]">標題</dt>
          <dd class="mt-1 text-sm font-bold leading-5">{{ summary.title }}</dd>
        </div>
        <div class="border border-[#d7d1c6] bg-[#f8f6f1] p-3">
          <dt class="text-[10px] font-black tracking-[0.14em] text-[#8b857d]">摘要</dt>
          <dd class="mt-1 text-sm font-bold leading-5">{{ summary.categoryLabel }}．{{ summary.topicTypeLabel }}．{{ summary.optionCount }} 選項．{{ summary.blockCount }} 補充．{{ summary.stanceLabel }}</dd>
        </div>
      </dl>
      <p class="mt-3 border-l-4 border-[#3f7a58] bg-[#e5f1e9] p-3 text-xs font-bold text-[#2f6547]">已填入下方表單，可自行查驗與修改；確認後於表單底部建立議題。</p>
    </div>

    <p v-if="validationError" role="alert" class="mt-4 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-3 text-xs font-bold text-[#a63222]">{{ validationError }}</p>
  </section>
</template>

<script setup lang="ts">
import type { TopicImportPayload } from '~/types/topic';
import { errorMessage } from '~/composables/useApi';
import { getCategoryMeta } from '~/utils/topic';

const emit = defineEmits<{ applied: [payload: TopicImportPayload] }>();
const props = defineProps<{ categories: Array<{ key: string }> }>();

const source = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const busy = ref(false);
const validationError = ref('');
const summary = ref<{
  title: string;
  categoryLabel: string;
  topicTypeLabel: string;
  optionCount: number;
  blockCount: number;
  stanceLabel: string;
} | null>(null);

const MAX_DEPTH = 4;

const text = (value: unknown, min: number, max: number) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;

function loadFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    source.value = String(reader.result ?? '').trim();
    validationError.value = '';
    summary.value = null;
  };
  reader.onerror = () => { validationError.value = '無法讀取檔案'; };
  reader.readAsText(file);
  input.value = '';
}

function insertTemplate() {
  source.value = JSON.stringify({
    title: '你支持地方政府試辦行人優先區嗎？',
    description: '試辦期間重新配置道路空間，並持續觀察事故與通行效率變化。',
    category: props.categories[0]?.key ?? 'politics',
    topicType: 'BINARY',
    options: ['支持', '支持但可調整'],
    voteDurationDays: 7,
    blocks: [{
      type: 'CASE',
      title: '某縣市實際案例',
      content: '該縣市在特定學區周邊劃設行人優先區，並限制車流。',
      sourceLabel: '縣市政府資料',
      sourceUrl: 'https://example.gov.tw/report',
      occurredAt: '2025-01-15',
    }],
    stances: [
      { title: '支持優先區，但要求保留停車位', rationale: '快速通行不該以鄰里停車需求為代價。', children: [{ title: '尖峰時段仍開放接送臨停', rationale: '學區接送是剛性需求。' }] },
      { title: '反對全面禁行私人車輛', rationale: '應先提供替代的大眾運輸與停車空間。' },
    ],
  }, null, 2);
  validationError.value = '';
  summary.value = null;
}

function stanceStats(nodes?: TopicImportPayload['stances'], depth = 0): { count: number; maxDepth: number } {
  let count = 0;
  let maxDepth = depth;
  for (const node of nodes ?? []) {
    count += 1;
    const child = stanceStats(node.children, depth + 1);
    count += child.count;
    maxDepth = Math.max(maxDepth, child.maxDepth);
  }
  return { count, maxDepth };
}

function preview() {
  busy.value = true;
  validationError.value = '';
  summary.value = null;
  try {
    const data = JSON.parse(source.value) as TopicImportPayload;
    validate(data);
    const { count, maxDepth } = stanceStats(data.stances);
    const activeKeys = new Set(props.categories.map((item) => item.key));
    const category = activeKeys.has(data.category) ? getCategoryMeta(data.category) : null;
    summary.value = {
      title: data.title,
      categoryLabel: category ? category.label : data.category,
      topicTypeLabel: data.topicType === 'SPECTRUM' ? '光譜題' : data.topicType === 'BINARY' ? '二元題' : '多選題',
      optionCount: data.options?.length ?? 0,
      blockCount: data.blocks?.length ?? 0,
      stanceLabel: count ? `${count} 筆立場，最深 ${maxDepth + 1} 層` : '無立場',
    };
    emit('applied', data);
  } catch (cause) {
    validationError.value = errorMessage(cause);
  } finally {
    busy.value = false;
  }
}

function validate(data: TopicImportPayload) {
  const activeKeys = new Set(props.categories.map((item) => item.key));

  if (!text(data.title, 10, 100)) throw new Error('標題需為 10–100 個字');
  if (data.description !== undefined && !text(data.description, 20, 2000)) throw new Error('一句話說明需為 20–2000 個字，或留空');
  if (!data.category || typeof data.category !== 'string' || !activeKeys.has(data.category)) throw new Error('分類需是現行啟用的分類 key');
  if (!['BINARY', 'MULTIPLE', 'SPECTRUM'].includes(data.topicType)) throw new Error('topicType 需為 BINARY / MULTIPLE / SPECTRUM');
  if (![3, 7, 14, 30].includes(data.voteDurationDays)) throw new Error('投票天數需為 3 / 7 / 14 / 30');
  const options = (data.options ?? []).map((option) => option.trim()).filter(Boolean);
  if (data.topicType === 'SPECTRUM' && options.length) throw new Error('光譜題不需要設定選項');
  if (data.topicType === 'BINARY') {
    if (options.length !== 2) throw new Error('二元題必須設定 2 個選項');
  } else if (data.topicType === 'MULTIPLE' && (options.length < 2 || options.length > 6)) throw new Error('多選題必須設定 2 到 6 個選項');
  if (new Set(options).size !== options.length) throw new Error('選項不可重複');
  const blocks = data.blocks ?? [];
  if (blocks.length > 8) throw new Error('補充內容最多 8 筆');
  for (const block of blocks) {
    if (!['BACKGROUND', 'CASE', 'DATA', 'SOURCE', 'PERSPECTIVES'].includes(block.type)) throw new Error('補充內容 type 不正確');
    if (!text(block.title, 3, 120)) throw new Error('補充內容標題需為 3–120 個字');
    if (!text(block.content, 10, 2000)) throw new Error('補充內容需為 10–2000 個字');
    if (block.type === 'SOURCE' && !block.sourceUrl) throw new Error('來源連結模組必須提供網址');
    if (block.sourceUrl) {
      try {
        const url = new URL(block.sourceUrl);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch {
        throw new Error('來源網址需以 http:// 或 https:// 開頭');
      }
    }
  }
  validateStances(data.stances, 0);
}

function validateStances(nodes: TopicImportPayload['stances'], depth: number) {
  for (const node of nodes ?? []) {
    if (!text(node.title, 2, 80)) throw new Error('立場標題需為 2–80 個字');
    if (node.rationale !== undefined && (typeof node.rationale !== 'string' || node.rationale.trim().length > 200)) throw new Error('立場理由最多 200 個字');
    if (depth > MAX_DEPTH) throw new Error(`立場最深只能到第 ${MAX_DEPTH} 層`);
    validateStances(node.children, depth + 1);
  }
}
</script>
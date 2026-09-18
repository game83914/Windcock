<template>
  <div class="space-y-6">
    <UiImageLightbox v-model:src="lightboxSrc" />

    <label v-if="showTitleInput" class="block">
      <span class="mb-2 block text-sm font-bold">題目</span>
      <input v-model.trim="questionTitle" data-field="question-title" maxlength="100" placeholder="例如：你今天中午想吃什麼？" class="field-input" :class="{ 'field-input-error': fieldErrors['question-title'] }" />
      <p v-if="fieldErrors['question-title']" class="mt-2 text-xs font-bold text-[#a63222]">{{ fieldErrors['question-title'] }}</p>
    </label>

    <label v-if="showTypeSelect" class="block">
      <span class="mb-2 block text-sm font-bold">題型</span>
      <select v-model="type" class="field-input w-full font-bold" @change="onBuilderTypeChange">
        <option v-for="item in BUILDER_TYPES" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
    </label>

    <div v-if="isScratch" class="space-y-5 border-t border-[#f0e6d2] pt-5">
      <div>
        <span class="mb-2 block text-sm font-bold">刮刮卡封面（選填）</span>
        <TopicsOptionImageInput v-model="scratchCard.coverImageUrl" @preview="lightboxSrc = $event" />
        <p class="mt-2 text-xs leading-5 text-[#77716a]">未上傳時會使用預設刮刮卡封面。</p>
      </div>
      <fieldset>
        <legend class="mb-2 text-sm font-bold">揭曉圖片</legend>
        <div class="grid gap-2 sm:grid-cols-2">
          <label class="flex cursor-pointer items-start gap-2 rounded-xl border border-[#ded7cb] bg-white p-3 text-sm">
            <input v-model="scratchCard.revealMode" type="radio" value="SHARED" class="mt-0.5 accent-[#b0761f]" />
            <span><strong class="block">共用圖片</strong><span class="mt-0.5 block text-xs text-[#77716a]">所有結果使用同一張揭曉圖</span></span>
          </label>
          <label class="flex cursor-pointer items-start gap-2 rounded-xl border border-[#ded7cb] bg-white p-3 text-sm">
            <input v-model="scratchCard.revealMode" type="radio" value="PER_RESULT" class="mt-0.5 accent-[#b0761f]" />
            <span><strong class="block">各結果圖片</strong><span class="mt-0.5 block text-xs text-[#77716a]">每個結果可設定不同圖片</span></span>
          </label>
        </div>
      </fieldset>
      <div v-if="scratchCard.revealMode === 'SHARED'">
        <span class="mb-2 block text-sm font-bold">共用揭曉圖片（選填）</span>
        <TopicsOptionImageInput v-model="scratchCard.sharedRevealImageUrl" @preview="lightboxSrc = $event" />
      </div>
      <label class="flex items-center justify-between gap-4 rounded-xl bg-[#fff8ec] px-4 py-3">
        <span><strong class="block text-sm">顯示結果文字</strong><span class="mt-0.5 block text-xs text-[#77716a]">在揭曉圖片上顯示結果名稱</span></span>
        <input v-model="scratchCard.showText" type="checkbox" class="h-5 w-5 shrink-0 accent-[#b0761f]" />
      </label>
      <p v-if="scratchImageWarning" class="rounded-xl border-l-4 border-[#d89a36] bg-[#fff4dc] p-3 text-xs font-bold leading-5 text-[#8f5d14]">{{ scratchImageWarning }}</p>
      <div class="relative mx-auto aspect-[8/5] max-w-sm overflow-hidden rounded-2xl border-2 border-[#d6b16d] bg-gradient-to-br from-[#fff1c9] via-[#f7d98a] to-[#c98b2b] shadow-sm">
        <img v-if="scratchCard.coverImageUrl" :src="scratchCard.coverImageUrl" alt="刮刮卡封面預覽" class="h-full w-full object-cover" />
        <div v-else class="grid h-full place-items-center text-center text-[#805410]"><span><strong class="block text-xl">SCRATCH</strong><span class="mt-1 block text-xs font-bold tracking-widest">刮開揭曉</span></span></div>
      </div>
    </div>

    <div v-if="usesRows" class="border-t border-[#f0e6d2] pt-5">
      <div class="flex items-center justify-between">
        <span class="text-sm font-bold">{{ rowHeading }}</span>
        <span class="text-xs font-bold text-[#8f5d14]">{{ filledCount }} / {{ rowLimitLabel }}</span>
      </div>
      <div ref="rowsEl" class="mt-3 space-y-3">
        <div v-for="(row, index) in rows" :key="row.id" class="flex items-center gap-3">
          <span data-drag-handle class="grid h-8 w-8 shrink-0 cursor-grab place-items-center rounded-full bg-[#f0e6d2] text-xs font-black text-[#8f5d14] active:cursor-grabbing" title="拖曳以排序" aria-label="拖曳以排序">{{ index + 1 }}</span>
          <TopicsOptionImageInput v-if="isImageType || (isScratch && scratchCard.revealMode === 'PER_RESULT')" v-model="rows[index].image" @preview="lightboxSrc = $event" />
          <input v-model.trim="rows[index].label" :data-field="`option-${index}`" maxlength="50" :placeholder="rowPlaceholder" class="field-input" :class="{ 'field-input-error': fieldErrors[`option-${index}`] }" />
          <input v-if="type === 'MATCHING'" v-model.trim="rows[index].match" :data-field="`match-${index}`" maxlength="50" placeholder="右側配對" class="field-input" :class="{ 'field-input-error': fieldErrors[`match-${index}`] }" />
          <input v-if="type === 'SPIN_WHEEL'" v-model.trim="rows[index].weight" :data-field="`weight-${index}`" maxlength="4" inputmode="numeric" placeholder="權重" class="field-input w-20" :class="{ 'field-input-error': fieldErrors[`weight-${index}`] }" />
          <input v-if="isScratch" v-model.trim="rows[index].weight" :data-field="`weight-${index}`" maxlength="6" inputmode="numeric" placeholder="權重（選填）" class="field-input w-28" :class="{ 'field-input-error': fieldErrors[`weight-${index}`] }" />
          <button v-if="rows.length > minRows" type="button" class="focus-ring rounded-full px-2 text-xl text-[#8b857d]" aria-label="刪除項目" @click="removeRow(index)">&times;</button>
        </div>
      </div>
      <button v-if="rows.length < maxRows" type="button" class="focus-ring mt-3 rounded-full text-xs font-bold text-[#b0761f] hover:underline" @click="rows.push({ id: nextRowId(), label: '', match: '', weight: '', image: null })">＋ 新增{{ type === 'MATCHING' ? '配對' : '項目' }}</button>
      <p v-if="type === 'SPIN_WHEEL'" class="mt-2 text-xs leading-5 text-[#77716a]">權重為選填的轉盤機率（正整數）：數字愈大愈容易被轉到；留空則每格機率相同。</p>
      <p v-if="isScratch" class="mt-2 text-xs leading-5 text-[#77716a]">權重為選填的正整數；留空皆視為相同權重。圖片也可留空，系統會使用預設揭曉圖。</p>
      <label v-if="type === 'MULTI_SELECT'" class="mt-4 block">
        <span class="mb-2 block text-sm font-bold">每人最多可選</span>
        <select v-model.number="maxSelections" data-field="max-selections" class="field-input w-full font-bold sm:w-48">
          <option v-for="count in rows.length" :key="count" :value="count">{{ count }} 項</option>
        </select>
        <p class="mt-2 text-xs leading-5 text-[#77716a]">作答者至少需選 1 項，最多可選 {{ maxSelections }} 項。</p>
      </label>
    </div>

    <div v-if="type === 'STAR_RATING'" class="border-t border-[#f0e6d2] pt-5">
      <span class="mb-2 block text-sm font-bold">五星預覽</span>
      <div class="rounded-2xl bg-[#fff8ec] px-4 py-5 text-center text-4xl tracking-wider text-[#b0761f]" aria-label="五顆星">★★★★★</div>
    </div>

    <div v-if="isLikert" class="border-t border-[#f0e6d2] pt-5">
      <span class="mb-3 block text-sm font-bold">量表設定</span>
      <label class="block">
        <span class="mb-2 block text-sm font-bold">點數（3～10）</span>
        <select v-model.number="points" data-field="scale-points" class="field-input w-full font-bold sm:w-48" :class="{ 'field-input-error': fieldErrors['scale-points'] }">
          <option v-for="n in likertPointOptions" :key="n" :value="n">{{ n }} 點</option>
        </select>
      </label>
      <p v-if="fieldErrors['scale-points']" class="mt-2 text-xs font-bold text-[#a63222]">{{ fieldErrors['scale-points'] }}</p>
      <span class="mb-3 mt-4 block text-sm font-bold">量表端點</span>
      <div class="grid gap-3 sm:grid-cols-2">
        <label><span class="mb-1 block text-xs font-bold text-[#77716a]">最低分代表</span><input v-model.trim="scaleMinLabel" data-field="scale-min-label" maxlength="30" placeholder="例如：非常不同意" class="field-input" :class="{ 'field-input-error': fieldErrors['scale-min-label'] }" /></label>
        <label><span class="mb-1 block text-xs font-bold text-[#77716a]">最高分代表</span><input v-model.trim="scaleMaxLabel" data-field="scale-max-label" maxlength="30" placeholder="例如：非常同意" class="field-input" :class="{ 'field-input-error': fieldErrors['scale-max-label'] }" /></label>
      </div>
      <div class="mt-4 rounded-2xl bg-[#f8ecd6] p-4">
        <div class="grid gap-2" :style="{ gridTemplateColumns: `repeat(${likertPoints}, minmax(0, 1fr))` }">
          <span v-for="point in likertPoints" :key="point" class="grid aspect-square place-items-center rounded-full border border-[#c9a15e] bg-white text-xs font-black text-[#8f5d14]">{{ point }}</span>
        </div>
        <div class="mt-2 flex justify-between gap-4 text-xs font-bold text-[#8f5d14]"><span>{{ scaleMinLabel || '最低' }}</span><span class="text-right">{{ scaleMaxLabel || '最高' }}</span></div>
      </div>
    </div>

    <div v-if="type === 'SHORT_ANSWER'" class="border-t border-[#f0e6d2] pt-5">
      <span class="mb-2 block text-sm font-bold">作答提示（選填）</span>
      <textarea v-model.trim="prompt" maxlength="200" rows="2" placeholder="例如：用一句話描述你最理想的生活城市" class="field-input w-full" />
      <p class="mt-2 text-xs leading-5 text-[#77716a]">回答會公開顯示並統計回覆數，最多 500 字。</p>
    </div>

    <div v-if="type === 'SPECTRUM'" class="border-t border-[#f0e6d2] pt-5">
      <span class="mb-2 block text-sm font-bold">光譜軸向</span>
      <div class="rounded-2xl bg-[#f8ecd6] p-4">
        <input type="range" min="0" max="100" value="50" class="w-full accent-[#b0761f]" disabled />
        <div class="mt-1 flex justify-between text-xs font-bold text-[#8f5d14]"><span>0</span><span>50</span><span>100</span></div>
        <p class="mt-3 text-xs leading-5 text-[#77716a]">成員用 0~100 滑桿表態，即時看中間值風向。無需設定選項。</p>
      </div>
    </div>

    <p v-if="formError" class="rounded-xl border-l-4 border-[#d84a36] bg-[#fbe9e5] p-3 text-xs font-bold text-[#a63222]">{{ formError }}</p>
  </div>
</template>

<script setup lang="ts">
import {
  BUILDER_RULES,
  BUILDER_TYPES,
  isImageBuilder,
  builderHeading,
  builderPlaceholder,
  seedRows,
  nextRowId,
  normalizeLikertPoints,
  LIKERT_POINTS_MIN,
  LIKERT_POINTS_MAX,
  createScratchCardDraft,
  type BuilderRow,
  type BuilderType,
  type ScratchCardDraft,
} from '~/utils/questionBuilder';

const props = withDefaults(defineProps<{ showTypeSelect?: boolean; showTitleInput?: boolean }>(), { showTypeSelect: true, showTitleInput: false });

const type = defineModel<BuilderType>('type', { required: true });
const rows = defineModel<BuilderRow[]>('rows', { required: true });
const prompt = defineModel<string>('prompt', { default: '' });
const questionTitle = defineModel<string>('questionTitle', { default: '' });
const scaleMinLabel = defineModel<string>('scaleMinLabel', { default: '' });
const scaleMaxLabel = defineModel<string>('scaleMaxLabel', { default: '' });
const points = defineModel<number>('points', { default: 5 });
const maxSelections = defineModel<number>('maxSelections', { default: 1 });
const scratchCard = defineModel<ScratchCardDraft>('scratchCard', { default: createScratchCardDraft });

const fieldErrors = reactive<Record<string, string>>({});
const formError = ref('');
const { src: lightboxSrc } = useLightbox();
const rowsEl = ref<HTMLElement | null>(null);

const currentBuilder = computed(() => BUILDER_RULES[type.value]);
const usesRows = computed(() => currentBuilder.value.needs !== 'NONE');
const minRows = computed(() => currentBuilder.value.min);
const maxRows = computed(() => currentBuilder.value.max);
const rowLimitLabel = computed(() => `${minRows.value}~${maxRows.value}`);
const rowHeading = computed(() => builderHeading(type.value));
const isImageType = computed(() => isImageBuilder(type.value));
const rowPlaceholder = computed(() => builderPlaceholder(type.value));
const filledLabels = computed(() => rows.value.map((row) => row.label.trim()).filter(Boolean));
const filledCount = computed(() => (isImageType.value ? rows.value.filter((row) => row.image).length : filledLabels.value.length));
const isLikert = computed(() => type.value === 'LIKERT');
const isScratch = computed(() => type.value === 'SCRATCH');
const scratchImageWarning = computed(() => {
  if (!isScratch.value || scratchCard.value.showText || rows.value.length < 2) return '';
  if (scratchCard.value.revealMode === 'SHARED') return '已隱藏結果文字，但所有結果使用同一張揭曉圖，玩家將無法分辨抽到哪個結果。';
  const images = rows.value.map((row) => row.image).filter((image): image is string => !!image);
  if (images.length !== rows.value.length || new Set(images).size !== images.length) return '已隱藏結果文字，請為每個結果設定不重複的揭曉圖片，否則玩家可能無法分辨結果。';
  return '';
});
const likertPointOptions = computed(() => Array.from({ length: LIKERT_POINTS_MAX - LIKERT_POINTS_MIN + 1 }, (_, index) => LIKERT_POINTS_MIN + index));
const likertPoints = computed(() => normalizeLikertPoints(points.value));

function onBuilderTypeChange() {
  rows.value = seedRows(type.value);
  if (type.value === 'MULTI_SELECT') maxSelections.value = Math.min(Math.max(maxSelections.value, 1), rows.value.length);
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key];
  formError.value = '';
}

function removeRow(index: number) {
  rows.value.splice(index, 1);
  if (type.value === 'MULTI_SELECT') maxSelections.value = Math.min(maxSelections.value, rows.value.length);
}

function reorderRows(from: number, to: number) {
  const [moved] = rows.value.splice(from, 1);
  if (!moved) return;
  rows.value.splice(to, 0, moved);
  for (const key of Object.keys(fieldErrors)) {
    if (/^(option|match|weight)-\d+$/.test(key)) delete fieldErrors[key];
  }
}

useDragSort(rowsEl, reorderRows);

function validate(): { firstField: string | null; formError: string } {
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key];
  formError.value = '';
  let valid = true;
  if (props.showTitleInput && questionTitle.value.trim().length < 2) {
    fieldErrors['question-title'] = '題目至少需要 2 個字';
    valid = false;
  }
  if (isLikert.value) {
    if (!Number.isInteger(points.value) || points.value < LIKERT_POINTS_MIN || points.value > LIKERT_POINTS_MAX) {
      fieldErrors['scale-points'] = `量表點數需為 ${LIKERT_POINTS_MIN}～${LIKERT_POINTS_MAX} 的整數`;
      valid = false;
    }
    if (!scaleMinLabel.value.trim()) {
      fieldErrors['scale-min-label'] = '請填寫最低分代表的文字';
      valid = false;
    }
    if (!scaleMaxLabel.value.trim()) {
      fieldErrors['scale-max-label'] = '請填寫最高分代表的文字';
      valid = false;
    }
    if (scaleMinLabel.value.trim() && scaleMinLabel.value.trim() === scaleMaxLabel.value.trim()) {
      fieldErrors['scale-max-label'] = '量表兩端文字不可相同';
      valid = false;
    }
  }
  if (usesRows.value) {
    rows.value.forEach((row, index) => {
      if (!isImageType.value && !row.label.trim()) {
        fieldErrors[`option-${index}`] = '請填寫此欄';
        valid = false;
      }
      if (type.value === 'MATCHING' && !row.match.trim()) {
        fieldErrors[`match-${index}`] = '請填寫右側配對';
        valid = false;
      }
      if (isImageType.value && !row.image) {
        fieldErrors[`option-${index}`] = '請為此選項上傳圖片';
        valid = false;
      }
    });
    const count = filledCount.value;
    if (count < minRows.value || count > maxRows.value) {
      formError.value = `${currentBuilder.value.label}需要 ${rowLimitLabel.value} 個項目（目前 ${count} 個）。`;
      valid = false;
    }
    if (!isImageType.value && filledLabels.value.length && new Set(filledLabels.value).size !== filledLabels.value.length) {
      formError.value = '項目內容不可重複。';
      valid = false;
    }
    if (type.value === 'MATCHING') {
      const matches = rows.value.map((row) => row.match.trim()).filter(Boolean);
      if (matches.length !== rows.value.length) {
        formError.value = '每一列都需填寫右側配對。';
        valid = false;
      } else if (new Set(matches).size !== matches.length) {
        formError.value = '右側配對不可重複。';
        valid = false;
      }
    }
    if (type.value === 'SPIN_WHEEL') {
      const filledWeights = rows.value.filter((row) => row.weight.trim());
      if (filledWeights.length) {
        const badRow = rows.value.findIndex((row) => {
          const value = Number(row.weight.trim());
          return !row.weight.trim() || !Number.isInteger(value) || value < 1;
        });
        if (badRow >= 0) {
          fieldErrors[`weight-${badRow}`] = '權重需為正整數';
          valid = false;
        }
      }
    }
    if (isScratch.value) {
      rows.value.forEach((row, index) => {
        if (!row.weight.trim()) return;
        const value = Number(row.weight.trim());
        if (!Number.isInteger(value) || value < 1) {
          fieldErrors[`weight-${index}`] = '權重需為正整數';
          valid = false;
        }
      });
    }
    if (type.value === 'MULTI_SELECT' && (!Number.isInteger(maxSelections.value) || maxSelections.value < 1 || maxSelections.value > rows.value.length)) {
      fieldErrors['max-selections'] = '最多可選數必須介於 1 與選項數之間';
      formError.value = fieldErrors['max-selections'];
      valid = false;
    }
  }
  return { firstField: valid ? null : Object.keys(fieldErrors)[0] ?? null, formError: formError.value };
}

function reset() {
  fieldErrors && Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key]);
  formError.value = '';
}

defineExpose({ validate, reset });
</script>

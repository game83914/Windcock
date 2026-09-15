<template>
  <div class="mx-auto max-w-6xl pb-12">
    <UiImageLightbox v-model:src="lightboxSrc" />
    <div class="mb-8 border-b border-[#ded7cb] pb-6">
      <p class="eyebrow-modern text-[#b0761f]">UGC 微投票 · 立即開票</p>
      <h1 class="mt-1 text-3xl font-black tracking-[-0.04em] sm:text-4xl">發起今天快問</h1>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-[#6d6861]">資深會員可發起輕量微投票，立即開票、即時看風向。選項題、光譜題到連連看、刮刮樂、轉盤、搖獎，今天就想知道答案的生活問題都能玩。</p>
    </div>

    <div v-if="savedTopic" class="surface-card p-8 text-center sm:p-12">
      <p class="eyebrow-modern text-[#b0761f]">快問已開票</p>
      <h2 class="mt-3 text-2xl font-black">你的快問上線了</h2>
      <p class="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#6d6861]">投票時間 {{ savedTopic.voteDurationHours }} 小時，結束後會依集票情況結算。現在就可以到詳情頁玩第一票。</p>
      <div class="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <UiButton :to="`/topic/${savedTopic.id}`" variant="quick">前往快問詳情</UiButton>
        <UiButton :to="'/me/quick'" variant="outline">查看我的快問</UiButton>
      </div>
    </div>

    <div v-else-if="loading" class="h-96 animate-pulse rounded-2xl bg-[#e5e0d6]" />

    <div v-else-if="!canCreateQuick" class="surface-card p-6 sm:p-8">
      <p class="eyebrow-modern text-[#b0761f]">資深會員限定</p>
      <h2 class="mt-2 text-xl font-black">成為資深會員後即可發起快問</h2>
      <p class="mt-3 text-sm leading-6 text-[#6d6861]">帳號需滿 30 天，並在至少 10 個不同議題完成投票。目前為 {{ eligibility?.accountAgeDays ?? 0 }} 天、{{ eligibility?.distinctTopicsVoted ?? 0 }} 個議題。</p>
      <UiButton :to="'/'" variant="primary" class="mt-5">先來探索快問</UiButton>
    </div>

    <div v-else class="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <form class="space-y-6" novalidate @submit.prevent="submit">
        <section class="surface-card p-5 sm:p-7">
          <p class="eyebrow-modern text-[#b0761f]">01 / 投票問題</p>
          <label class="mt-6 block">
            <span class="mb-2 flex justify-between text-sm font-bold"><span>快問標題</span><span class="font-normal text-[#8b857d]">{{ title.length }} / 100</span></span>
            <input v-model.trim="title" data-field="title" maxlength="100" minlength="5" placeholder="例如：你今天中午打算吃什麼？" class="field-input" :class="{ 'field-input-error': fieldErrors.title }" />
            <p v-if="fieldErrors.title" class="mt-2 text-xs font-bold text-[#a63222]">{{ fieldErrors.title }}</p>
          </label>
        </section>

        <section class="surface-card p-5 sm:p-7">
          <p class="eyebrow-modern text-[#b0761f]">02 / 投票設定</p>
          <div class="mt-6 grid gap-2 sm:grid-cols-2">
            <button v-for="item in builderTypes" :key="item.value" type="button" class="focus-ring rounded-2xl border-2 p-4 text-left transition" :class="builderType === item.value ? 'border-[#b0761f] bg-[#f8ecd6]' : 'border-[#ded7cb] bg-white hover:border-[#b0761f]'" @click="setBuilderType(item.value)">
              <strong class="block text-sm">{{ item.label }}</strong>
              <span class="mt-1 block text-xs leading-5 text-[#77716a]">{{ item.description }}</span>
            </button>
          </div>

          <div v-if="usesRows" class="mt-6 border-t border-[#f0e6d2] pt-5">
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold">{{ rowHeading }}</span>
              <span class="text-xs font-bold text-[#8f5d14]">{{ filledLabels.length }} / {{ rowLimitLabel }}</span>
            </div>
            <div class="mt-3 space-y-3">
              <div v-for="(row, index) in rows" :key="index" class="flex items-center gap-3">
                <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f0e6d2] text-xs font-black text-[#8f5d14]">{{ index + 1 }}</span>
                <input v-model.trim="rows[index].label" :data-field="`option-${index}`" maxlength="50" :placeholder="rowPlaceholder" class="field-input" :class="{ 'field-input-error': fieldErrors[`option-${index}`] }" />
                <input v-if="builderType === 'MATCHING'" v-model.trim="rows[index].match" :data-field="`match-${index}`" maxlength="50" placeholder="右側配對" class="field-input" :class="{ 'field-input-error': fieldErrors[`match-${index}`] }" />
                <input v-if="builderType === 'SPIN_WHEEL'" v-model.trim="rows[index].weight" :data-field="`weight-${index}`" maxlength="4" inputmode="numeric" placeholder="權重" class="field-input w-20" :class="{ 'field-input-error': fieldErrors[`weight-${index}`] }" />
                <TopicsOptionImageInput v-if="builderType === 'OPTION'" v-model="rows[index].image" @preview="lightboxSrc = $event" />
                <button v-if="rows.length > minRows" type="button" class="focus-ring rounded-full px-2 text-xl text-[#8b857d]" aria-label="刪除項目" @click="rows.splice(index, 1)">&times;</button>
              </div>
            </div>
            <button v-if="rows.length < maxRows" type="button" class="focus-ring mt-3 rounded-full text-xs font-bold text-[#b0761f] hover:underline" @click="rows.push({ label: '', match: '', weight: '', image: null })">＋ 新增{{ builderType === 'MATCHING' ? '配對' : '項目' }}</button>
            <p v-if="builderType === 'SPIN_WHEEL'" class="mt-2 text-xs leading-5 text-[#77716a]">權重為選填的轉盤機率（正整數）：數字愈大愈容易被轉到；留空則每格機率相同。</p>
          </div>

          <div v-if="builderType === 'SHORT_ANSWER'" class="mt-6 border-t border-[#f0e6d2] pt-5">
            <span class="mb-2 block text-sm font-bold">作答提示（選填）</span>
            <textarea v-model.trim="prompt" maxlength="200" rows="2" placeholder="例如：用一句話描述你最理想的生活城市" class="field-input w-full" />
            <p class="mt-2 text-xs leading-5 text-[#77716a]">回答會公開顯示並統計回覆數，最多 500 字。</p>
          </div>

          <div v-if="builderType === 'SPECTRUM'" class="mt-6 border-t border-[#f0e6d2] pt-5">
            <span class="mb-2 block text-sm font-bold">光譜軸向</span>
            <div class="rounded-2xl bg-[#f8ecd6] p-4">
              <input type="range" min="0" max="100" value="50" class="w-full accent-[#b0761f]" disabled />
              <div class="mt-1 flex justify-between text-xs font-bold text-[#8f5d14]"><span>0</span><span>50</span><span>100</span></div>
              <p class="mt-3 text-xs leading-5 text-[#77716a]">成員用 0~100 滑桿表態，即時看中間值風向。無需設定選項。</p>
            </div>
          </div>

          <div class="mt-6 border-t border-[#f0e6d2] pt-5">
            <span class="mb-2 block text-sm font-bold">投票時間</span>
            <div class="flex flex-wrap gap-2">
              <button v-for="item in durationOptions" :key="item.value" type="button" class="focus-ring rounded-full border px-4 py-2.5 text-sm font-bold transition" :class="voteDurationHours === item.value ? 'border-[#b0761f] bg-[#b0761f] text-white' : 'border-[#cfc8bc] bg-white hover:border-[#b0761f]'" @click="voteDurationHours = item.value">{{ item.label }}</button>
            </div>
          </div>
        </section>

        <label class="flex cursor-pointer items-start gap-3 surface-quick p-5 text-sm leading-6">
          <input v-model="agreed" type="checkbox" class="mt-1 h-4 w-4 accent-[#b0761f]" />
          <span>我確認內容為善意生活觀察，未涉及誹謗、個人資料、違法內容或未經證實的指控，並同意平台即時公開開票。</span>
        </label>

        <p v-if="formError" class="rounded-2xl border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm text-[#a63222]">{{ formError }}</p>

        <div class="flex flex-col items-center gap-2">
          <UiButton type="submit" variant="quick" block size="lg" :disabled="submitting || !agreed">
            {{ submitting ? '開票中…' : '發起快問並開票' }}
          </UiButton>
          <p class="text-xs text-[#77716a]">資深會員每天最多發起 3 則快問。</p>
        </div>
      </form>

      <aside class="lg:sticky lg:top-28 lg:self-start">
        <p class="eyebrow-modern mb-3 text-[#77716a]">快問預覽</p>
        <div class="surface-quick p-6">
          <div class="flex items-center justify-between text-xs">
            <span class="rounded-full bg-[#b0761f] px-2.5 py-0.5 text-[10px] font-black text-white">{{ currentBuilder?.label }}</span>
            <span class="font-bold text-[#b0761f]">快問</span>
          </div>
          <h2 class="mt-6 text-2xl font-black leading-snug">{{ title || '你的快問會顯示在這裡' }}</h2>

          <div v-if="builderType === 'SPECTRUM'" class="mt-6 border-t border-[#f0e6d2] pt-4">
            <div class="flex items-end justify-between"><span class="text-sm font-bold text-[#6d6861]">你的選擇</span><strong class="text-2xl font-black text-[#b0761f]">50<small class="ml-1 text-xs text-[#77716a]">/ 100</small></strong></div>
            <input type="range" min="0" max="100" value="50" class="mt-4 w-full accent-[#b0761f]" disabled />
          </div>

          <div v-else-if="builderType === 'SHORT_ANSWER'" class="mt-6 border-t border-[#f0e6d2] pt-4">
            <p v-if="prompt" class="text-sm font-bold text-[#6d6861]">{{ prompt }}</p>
            <div class="mt-3 rounded-2xl border border-dashed border-[#c9a15e] bg-white p-3 text-sm text-[#8b857d]">輸入你的回答…</div>
            <p class="mt-2 text-xs text-[#8f5d14]">回答公開顯示・{{ totalVotesLabel }}</p>
          </div>

          <div v-else class="mt-6 space-y-2 border-t border-[#f0e6d2] pt-4">
            <div v-if="builderType === 'MATCHING'" v-for="(row, index) in filledRows" :key="index" class="flex items-center gap-2 text-sm">
              <span class="flex-1 rounded-lg border border-[#e0c9a0] bg-[#fffaf0] px-3 py-2 font-bold">{{ row.label || '⋯' }}</span>
              <span class="text-[#b0761f]">⇄</span>
              <span class="flex-1 rounded-lg border border-[#e0c9a0] bg-[#fffaf0] px-3 py-2 font-bold">{{ row.match || '⋯' }}</span>
            </div>
            <div v-for="(row, index) in filledRows" :key="index" class="flex items-center gap-3 text-sm">
              <span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f0e6d2] text-[10px] font-black text-[#8f5d14]">{{ index + 1 }}</span>
              <span class="font-medium">{{ row.label || '⋯' }}</span>
              <span v-if="builderType === 'SPIN_WHEEL' && row.weight" class="ml-auto rounded-full bg-[#f8ecd6] px-2 py-0.5 text-[10px] font-black text-[#8f5d14]">x{{ row.weight }}</span>
            </div>
          </div>

          <p class="mt-7 border-t border-[#f0e6d2] pt-4 text-xs text-[#8f5d14]">立即開票 · {{ durationLabel }} · 投完即見分佈</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Topic } from '~/types/topic';
import type { QuickTopicType } from '~/types/topic';
import { errorMessage } from '~/composables/useApi';
import type { CapabilitySummary } from '~/stores/auth';

definePageMeta({ middleware: 'auth' });

type BuilderType = 'OPTION' | 'SPECTRUM' | 'SHORT_ANSWER' | 'MATCHING' | 'PUZZLE' | 'SCRATCH' | 'SPIN_WHEEL' | 'LOTTERY';
interface BuilderRow { label: string; match: string; weight: string; image: string | null }

const route = useRoute();
const api = useApi();
const auth = useAuthStore();
useSeoMeta({ title: '發起快問｜輿論測風向' });

const BUILDER_RULES: Record<BuilderType, { label: string; description: string; min: number; max: number; needs: 'LIST' | 'MATCH' | 'WEIGHT' | 'NONE' }> = {
  OPTION: { label: '選項題', description: '二選一或 2~10 個選項，一鍵看分佈', min: 2, max: 10, needs: 'LIST' },
  SPECTRUM: { label: '光譜題', description: '0~100 滑桿測立場，即時看風向', min: 0, max: 0, needs: 'NONE' },
  SHORT_ANSWER: { label: '簡答題', description: '收集文字回應，公開顯示解讀民意', min: 0, max: 0, needs: 'NONE' },
  MATCHING: { label: '連連看', description: '左右配對，配對完成即選定', min: 2, max: 6, needs: 'MATCH' },
  PUZZLE: { label: '拼圖題', description: '重排拼字，拼完揭曉你的選擇', min: 2, max: 4, needs: 'LIST' },
  SCRATCH: { label: '刮刮樂', description: '刮開卡片揭曉你的選擇', min: 1, max: 9, needs: 'LIST' },
  SPIN_WHEEL: { label: '轉盤抽獎', description: '轉動轉盤，指到的即你的選擇', min: 2, max: 8, needs: 'WEIGHT' },
  LOTTERY: { label: '日式搖獎', description: '搖箱抽球，抽中的即你的選擇', min: 2, max: 10, needs: 'LIST' },
};
const DEFAULT_COUNT: Record<BuilderType, number> = { OPTION: 2, SPECTRUM: 0, SHORT_ANSWER: 0, MATCHING: 3, PUZZLE: 3, SCRATCH: 4, SPIN_WHEEL: 4, LOTTERY: 5 };
const builderTypes = Object.entries(BUILDER_RULES).map(([value, rule]) => ({ value: value as BuilderType, label: rule.label, description: rule.description }));
const durationOptions = [
  { value: 6, label: '6 小時' },
  { value: 12, label: '12 小時' },
  { value: 24, label: '24 小時' },
  { value: 48, label: '2 天' },
];

const title = ref('');
const builderType = ref<BuilderType>('OPTION');
const rows = ref<BuilderRow[]>(seedRows('OPTION'));
const prompt = ref('');
const voteDurationHours = ref(24);
const agreed = ref(false);
const loading = ref(true);
const submitting = ref(false);
const formError = ref('');
const fieldErrors = reactive<Record<string, string>>({});
const savedTopic = ref<Topic | null>(null);
const lightboxSrc = ref<string | null>(null);
const eligibility = computed(() => auth.capabilitySummary?.seniorEligibility);
const canCreateQuick = computed(() => auth.isAuthed && (auth.canAuthorTopics || auth.capabilitySummary?.membershipTier === 'SENIOR'));
const durationLabel = computed(() => durationOptions.find((item) => item.value === voteDurationHours.value)?.label ?? `${voteDurationHours.value} 小時`);
const currentBuilder = computed(() => BUILDER_RULES[builderType.value]);
const usesRows = computed(() => currentBuilder.value.needs !== 'NONE');
const minRows = computed(() => currentBuilder.value.min);
const maxRows = computed(() => currentBuilder.value.max);
const rowLimitLabel = computed(() => `${minRows.value}~${maxRows.value}`);
const rowHeading = computed(() => ({
  OPTION: '選項',
  SPECTRUM: '光譜軸向',
  SHORT_ANSWER: '作答提示',
  MATCHING: '配對內容',
  PUZZLE: '拼圖提示',
  SCRATCH: '卡片內容',
  SPIN_WHEEL: '轉盤選項',
  LOTTERY: '搖獎球選項',
}[builderType.value] ?? '項目'));
const rowPlaceholder = computed(() => builderType.value === 'MATCHING' ? '左側項目' : builderType.value === 'PUZZLE' ? '拼圖提示（如「支持」）' : '選項內容');
const filledLabels = computed(() => rows.value.map((row) => row.label.trim()).filter(Boolean));
const filledRows = computed(() => rows.value.filter((row) => row.label.trim()));
const totalVotesLabel = '投完即見';

function seedRows(type: BuilderType): BuilderRow[] {
  return Array.from({ length: DEFAULT_COUNT[type] }, () => ({ label: '', match: '', weight: '', image: null }));
}

function setBuilderType(type: BuilderType) {
  if (type === builderType.value) return;
  builderType.value = type;
  rows.value = seedRows(type);
}

function backendTopicType(): QuickTopicType {
  if (builderType.value === 'OPTION') return filledLabels.value.length === 2 ? 'BINARY' : 'MULTIPLE';
  return builderType.value;
}

function validateForm() {
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key];
  formError.value = '';
  let valid = true;
  if (title.value.length < 5) {
    fieldErrors.title = '快問標題至少需要 5 個字';
    valid = false;
  }
  if (usesRows.value) {
    rows.value.forEach((row, index) => {
      if (!row.label.trim()) {
        fieldErrors[`option-${index}`] = '請填寫此欄';
        valid = false;
      }
      if (builderType.value === 'MATCHING' && !row.match.trim()) {
        fieldErrors[`match-${index}`] = '請填寫右側配對';
        valid = false;
      }
    });
    const labels = filledLabels.value;
    if (labels.length < minRows.value || labels.length > maxRows.value) {
      formError.value = `${currentBuilder.value.label}需要 ${rowLimitLabel.value} 個項目（目前 ${labels.length} 個）。`;
      valid = false;
    }
    if (labels.length && new Set(labels).size !== labels.length) {
      formError.value = '項目內容不可重複。';
      valid = false;
    }
    if (builderType.value === 'MATCHING') {
      const matches = rows.value.map((row) => row.match.trim()).filter(Boolean);
      if (matches.length !== rows.value.length) {
        formError.value = '每一列都需填寫右側配對。';
        valid = false;
      } else if (new Set(matches).size !== matches.length) {
        formError.value = '右側配對不可重複。';
        valid = false;
      }
    }
    if (builderType.value === 'SPIN_WHEEL') {
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
  }
  return valid ? null : Object.keys(fieldErrors)[0] || null;
}

async function submit() {
  formError.value = '';
  const firstInvalidField = validateForm();
  if (firstInvalidField || formError.value) {
    if (firstInvalidField) {
      await nextTick();
      document.querySelector<HTMLElement>(`[data-field="${firstInvalidField}"]`)?.focus();
    }
    return;
  }
  submitting.value = true;
  try {
    const payload: Record<string, unknown> = {
      title: title.value,
      topicType: backendTopicType(),
      voteDurationHours: voteDurationHours.value,
    };
    if (usesRows.value) payload.options = rows.value.map((row) => row.label.trim());
    if (builderType.value === 'OPTION') {
      const images = rows.value.map((row) => row.image || null);
      payload.optionImages = images;
    }
    if (builderType.value === 'MATCHING') payload.matches = rows.value.map((row) => row.match.trim());
    if (builderType.value === 'SPIN_WHEEL') {
      const weights = rows.value.map((row) => Number(row.weight.trim()));
      if (weights.every(Number.isInteger)) payload.weights = weights;
    }
    if (builderType.value === 'SHORT_ANSWER') payload.prompt = prompt.value.trim() || undefined;
    savedTopic.value = await api.post<Topic>('/topics/quick', payload);
  } catch (error) {
    formError.value = errorMessage(error);
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  try {
    const summary = await api.get<CapabilitySummary>('/me/capabilities');
    auth.setCapabilities(summary);
  } catch (error) {
    formError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
});
</script>
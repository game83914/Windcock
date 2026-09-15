<template>
  <div class="mx-auto max-w-6xl pb-12">
    <div class="mb-8 border-b border-[#ded7cb] pb-6">
      <p class="eyebrow-modern text-[#d84a36]">{{ editingId ? '內容複核' : auth.canAuthorTopics ? '議題小組工具' : '會員發起' }}</p>
      <h1 class="mt-1 text-3xl font-black tracking-[-0.04em] sm:text-4xl">{{ editingId ? '編輯議題' : auth.canAuthorTopics ? '建立正式議題' : '提出議題提案' }}</h1>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-[#6d6861]">{{ auth.canAuthorTopics ? '議題小組可整理內容並直接公開；所有發布都會留下操作紀錄。' : '資深會員或合作組織可提出構想，由議題小組整理成正式議題。' }}</p>
    </div>

    <div v-if="savedTopic" class="surface-card p-8 text-center sm:p-12">
      <h2 class="mt-3 text-2xl font-black">{{ editingId ? '修改已儲存' : auth.canAuthorTopics ? '議題已公開' : '議題提案已送出' }}</h2>
      <p class="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#6d6861]">{{ auth.canAuthorTopics ? '議題已進入公開列表並開始計算投票期限。' : '議題小組會查看內容，需要補充時可在提案紀錄追蹤。' }}</p>
      <UiButton :to="'/me/topics'" class="mt-7">查看我的議題</UiButton>
    </div>

    <div v-else-if="loading" class="h-96 animate-pulse rounded-2xl bg-[#e5e0d6]" />

    <div v-else-if="!canSubmit" class="surface-card p-6 sm:p-8">
      <p class="eyebrow-modern text-[#d84a36]">新進會員</p>
      <h2 class="mt-2 text-xl font-black">達成資深會員資格後即可提出議題</h2>
      <p class="mt-3 text-sm leading-6 text-[#6d6861]">帳號需滿 30 天，並在至少 10 個不同議題完成投票。目前為 {{ eligibility?.accountAgeDays ?? 0 }} 天、{{ eligibility?.distinctTopicsVoted ?? 0 }} 個議題。</p>
      <UiButton :to="'/'" class="mt-5">探索可投票議題</UiButton>
    </div>

    <div v-else class="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <form class="space-y-6" novalidate @submit.prevent="submit">
        <TopicJsonImporter
          v-if="auth.canAuthorTopics && !editingId"
          :categories="categories"
          @applied="onApplyImport"
        />
        <section v-if="!auth.canAuthorTopics && partnerOrganizations.length" class="surface-card p-5 sm:p-7">
          <p class="eyebrow-modern text-[#77716a]">提案身份</p>
          <select v-model="selectedOrganizationId" class="field-input mt-3 !py-2.5">
            <option value="" :disabled="auth.capabilitySummary?.membershipTier !== 'SENIOR'">以資深會員身份提案</option>
            <option v-for="organization in partnerOrganizations" :key="organization.id" :value="organization.id">代表 {{ organization.name }}</option>
          </select>
        </section>
        <section class="surface-card p-5 sm:p-7">
          <p class="eyebrow-modern text-[#77716a]">01 / 投票問題</p>
          <div class="mt-6 space-y-5">
            <label class="block">
              <span class="mb-2 flex justify-between text-sm font-bold"><span>議題標題</span><span class="font-normal text-[#8b857d]">{{ title.length }} / 100</span></span>
              <input v-model.trim="title" :data-field="'title'" maxlength="100" placeholder="例如：你支持台灣企業試辦週休三日嗎？" class="field-input" :class="{ 'field-input-error': fieldErrors.title }" />
              <p v-if="fieldErrors.title" class="mt-2 text-xs font-bold text-[#a63222]">{{ fieldErrors.title }}</p>
            </label>
            <label class="block">
              <span class="mb-2 flex justify-between text-sm font-bold"><span>一句話說明 <small class="font-normal text-[#8b857d]">（選填）</small></span><span class="font-normal text-[#8b857d]">{{ description.length }} / 2000</span></span>
              <textarea v-model.trim="description" :data-field="'description'" maxlength="2000" rows="3" placeholder="若題目本身已足夠清楚，可以留空。" class="field-input resize-y leading-6" :class="{ 'field-input-error': fieldErrors.description }" />
              <p v-if="fieldErrors.description" class="mt-2 text-xs font-bold text-[#a63222]">{{ fieldErrors.description }}</p>
            </label>
          </div>
        </section>

        <section class="surface-card p-5 sm:p-7">
          <p class="eyebrow-modern text-[#77716a]">02 / 投票設定</p>
          <div class="mt-6">
            <span class="mb-2 block text-sm font-bold">議題分類</span>
            <div class="flex flex-wrap gap-2">
              <button v-for="item in categories" :key="item.key" type="button" class="focus-ring flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition" :class="category === item.key ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#cfc8bc] bg-white hover:border-[#171717]'" @click="category = item.key"><span class="inline-block h-2 w-2 rounded-full" :style="{ backgroundColor: getCategoryMeta(item.key).color }" />{{ getCategoryMeta(item.key).label }}</button>
            </div>
          </div>
          <div class="mt-6 grid gap-3 sm:grid-cols-3">
            <button v-for="item in topicTypes" :key="item.value" type="button" class="focus-ring rounded-2xl border-2 p-4 text-left transition" :class="topicType === item.value ? 'border-[#d84a36] bg-[#fbe9e5]' : 'border-[#ded7cb] bg-white hover:border-[#d84a36]'" @click="topicType = item.value">
              <strong class="block text-sm">{{ item.label }}</strong>
              <span class="mt-1 block text-xs leading-5 text-[#77716a]">{{ item.description }}</span>
            </button>
          </div>
          <div v-if="topicType !== 'SPECTRUM'" class="mt-6 border-t border-[#f0e6d2] pt-5">
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold">投票選項</span>
              <button v-if="topicType === 'MULTIPLE' && options.length < 6" type="button" class="focus-ring rounded-full text-xs font-bold text-[#d84a36] hover:underline" @click="options.push('')">＋ 新增選項</button>
            </div>
            <div class="mt-3 space-y-3">
              <div v-for="(_, index) in options" :key="index" class="flex items-center gap-3">
                <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f8e3de] text-xs font-black text-[#a63222]">{{ index + 1 }}</span>
                <input v-model.trim="options[index]" :data-field="`option-${index}`" maxlength="50" :placeholder="`選項 ${index + 1}`" class="field-input" :class="{ 'field-input-error': fieldErrors[`option-${index}`] }" />
                <button v-if="topicType === 'MULTIPLE' && options.length > 2" type="button" class="focus-ring rounded-full px-2 text-xl text-[#8b857d]" aria-label="刪除選項" @click="options.splice(index, 1)">&times;</button>
              </div>
            </div>
          </div>
          <div class="mt-6 border-t border-[#f0e6d2] pt-5">
            <span class="mb-2 block text-sm font-bold">核准後開放投票</span>
            <div class="flex flex-wrap gap-2">
              <button v-for="days in durations" :key="days" type="button" class="focus-ring rounded-full border px-4 py-2.5 text-sm font-bold transition" :class="voteDurationDays === days ? 'border-[#3157d5] bg-[#3157d5] text-white' : 'border-[#cfc8bc] bg-white hover:border-[#3157d5]'" @click="voteDurationDays = days">{{ days }} 天</button>
            </div>
          </div>
        </section>

        <section class="surface-card p-5 sm:p-7">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="eyebrow-modern text-[#77716a]">03 / 補充內容 <span class="normal-case tracking-normal">（選填）</span></p>
              <h2 class="mt-2 text-lg font-black">需要時才新增模組</h2>
              <p class="mt-1 text-xs leading-5 text-[#77716a]">簡單議題可以直接略過；所有補充內容都會納入複核。</p>
            </div>
            <span class="shrink-0 text-xs text-[#8b857d]">{{ blocks.length }} / 8</span>
          </div>
          <details v-if="blocks.length < 8" ref="blockMenu" class="relative mt-5">
            <summary class="focus-ring flex min-h-11 w-full cursor-pointer list-none items-center justify-between rounded-xl border-2 border-[#d84a36] bg-white px-4 py-3 text-sm font-black marker:hidden sm:w-72">
              <span>＋ 新增補充內容</span>
              <span aria-hidden="true">⌄</span>
            </summary>
            <div class="absolute left-0 z-20 mt-1 w-full rounded-2xl border border-[#ded7cb] bg-white p-2 shadow-[0_12px_32px_rgba(23,23,23,0.14)] sm:w-80">
              <div v-for="group in blockGroups" :key="group.label" class="py-1">
                <p class="px-3 py-1 text-[10px] font-black tracking-[0.14em] text-[#8b857d]">{{ group.label }}</p>
                <button v-for="item in group.items" :key="item.type" type="button" class="focus-ring flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#f1eee7]" @click="addBlock(item.type)">
                  <strong class="min-w-20 text-sm">{{ item.label }}</strong>
                  <span class="text-xs leading-5 text-[#77716a]">{{ item.short }}</span>
                </button>
              </div>
            </div>
          </details>

          <div v-if="blocks.length" class="mt-5 space-y-3">
            <article v-for="(item, index) in blocks" :key="item.key" class="rounded-2xl border border-[#ded7cb] bg-white">
              <header class="flex items-center gap-3 px-4 py-3">
                <span class="grid h-7 w-7 place-items-center rounded-full text-xs font-black text-white" :style="{ backgroundColor: blockMeta(item.type).color }">{{ index + 1 }}</span>
                <button type="button" class="focus-ring min-w-0 flex-1 rounded-lg text-left" @click="item.expanded = !item.expanded">
                  <strong class="block text-sm">{{ blockMeta(item.type).label }}</strong>
                  <span class="block truncate text-xs text-[#77716a]">{{ item.title || '尚未填寫標題' }}</span>
                </button>
                <button type="button" class="focus-ring rounded-full text-xs text-[#77716a]" :aria-label="item.expanded ? '收合' : '展開'" @click="item.expanded = !item.expanded">{{ item.expanded ? '收合' : '編輯' }}</button>
                <button type="button" class="focus-ring rounded-full px-1.5 text-lg text-[#a63222]" aria-label="移除模組" @click="blocks.splice(index, 1)">&times;</button>
              </header>
              <div v-if="item.expanded" class="space-y-4 border-t border-[#f0e6d2] bg-[#faf8f3] p-4">
                <label class="block">
                  <span class="mb-2 block text-xs font-bold">{{ blockMeta(item.type).titleLabel }}</span>
                  <input v-model.trim="item.title" :data-field="`block-${index}-title`" maxlength="120" :placeholder="blockMeta(item.type).titlePlaceholder" class="field-input" :class="{ 'field-input-error': fieldErrors[`block-${index}-title`] }" />
                  <p v-if="fieldErrors[`block-${index}-title`]" class="mt-2 text-xs font-bold text-[#a63222]">{{ fieldErrors[`block-${index}-title`] }}</p>
                </label>
                <label class="block">
                  <span class="mb-2 block text-xs font-bold">{{ blockMeta(item.type).contentLabel }}</span>
                  <textarea v-model.trim="item.content" :data-field="`block-${index}-content`" maxlength="2000" rows="4" :placeholder="blockMeta(item.type).contentPlaceholder" class="field-input resize-y leading-6" :class="{ 'field-input-error': fieldErrors[`block-${index}-content`] }" />
                  <p v-if="fieldErrors[`block-${index}-content`]" class="mt-2 text-xs font-bold text-[#a63222]">{{ fieldErrors[`block-${index}-content`] }}</p>
                </label>
                <div class="grid gap-4 sm:grid-cols-2">
                  <label class="block">
                    <span class="mb-2 block text-xs font-bold">資料來源名稱</span>
                    <input v-model.trim="item.sourceLabel" maxlength="100" placeholder="例如：中央選舉委員會" class="field-input" />
                  </label>
                  <label v-if="item.type === 'CASE'" class="block">
                    <span class="mb-2 block text-xs font-bold">案例日期</span>
                    <input v-model="item.occurredAt" type="date" class="field-input" />
                  </label>
                </div>
                <label class="block">
                  <span class="mb-2 block text-xs font-bold">來源網址 {{ item.type === 'SOURCE' ? '（必填）' : '（選填）' }}</span>
                  <input v-model.trim="item.sourceUrl" type="url" :data-field="`block-${index}-source-url`" maxlength="500" placeholder="https://" class="field-input" :class="{ 'field-input-error': fieldErrors[`block-${index}-source-url`] }" />
                  <p v-if="fieldErrors[`block-${index}-source-url`]" class="mt-2 text-xs font-bold text-[#a63222]">{{ fieldErrors[`block-${index}-source-url`] }}</p>
                </label>
                <div class="flex justify-end gap-3 text-xs font-bold">
                  <button type="button" :disabled="index === 0" class="focus-ring rounded-full disabled:opacity-30" @click="moveBlock(index, -1)">向上</button>
                  <button type="button" :disabled="index === blocks.length - 1" class="focus-ring rounded-full disabled:opacity-30" @click="moveBlock(index, 1)">向下</button>
                </div>
              </div>
            </article>
          </div>
        </section>

        <label class="flex cursor-pointer items-start gap-3 surface-card p-5 text-sm leading-6">
          <input v-model="agreed" type="checkbox" class="mt-1 h-4 w-4 accent-[#d84a36]" />
          <span>我確認內容為善意公共討論，未涉及誹謗、個人資料、違法內容或未經證實的指控，並同意平台在核准後公開。</span>
        </label>

        <p v-if="formError" class="rounded-2xl border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm text-[#a63222]">{{ formError }}</p>
        <AiAuthoringWizard
          target="TOPIC"
          :form-context="{ title, description, category, topicType, options, voteDurationDays }"
          :has-existing-content="Boolean(title || description || blocks.length)"
          @apply="applyAiTopicDraft"
        />
        <template v-if="importMode">
          <div v-if="importedStances.length" class="surface-card p-4">
            <p class="eyebrow-modern text-[#77716a]">立場樹（由 JSON 帶入，建立時一併送出）</p>
            <ul class="mt-3 space-y-2">
              <li v-for="(stance, index) in importedStances" :key="index" class="text-sm">
                <span class="font-bold">{{ stance.title }}</span>
                <p v-if="stance.rationale" class="mt-0.5 text-xs leading-5 text-[#77716a]">{{ stance.rationale }}</p>
                <ul v-if="stance.children?.length" class="mt-2 space-y-2 border-l-2 border-[#f0e6d2] pl-4">
                  <li v-for="(child, childIndex) in stance.children" :key="childIndex" class="text-sm">
                    <span class="font-bold">{{ child.title }}</span>
                    <p v-if="child.rationale" class="mt-0.5 text-xs leading-5 text-[#77716a]">{{ child.rationale }}</p>
                  </li>
                </ul>
              </li>
            </ul>
            <p class="mt-3 text-xs text-[#8b857d]">立場直接沿用上方 JSON 內容；如需調整請回到生成器重新匯入。</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <UiButton type="button" variant="data" block size="lg" :disabled="submitting || !agreed" @click="submitImport(false)">
              {{ submitting ? '儲存中…' : '建立草稿（含立場）' }}
            </UiButton>
            <UiButton type="button" variant="action" block size="lg" :disabled="submitting || !agreed" @click="submitImport(true)">
              {{ submitting ? '儲存中…' : '建立並公開（含立場）' }}
            </UiButton>
          </div>
          <p class="text-center text-xs text-[#77716a]">建立草稿後可再由「直接公開」發布；建立並公開會立刻開票。</p>
        </template>
        <UiButton v-else type="submit" variant="action" block size="lg" :disabled="submitting || !agreed">
          {{ submitting ? '儲存中…' : editingId ? '儲存內容' : auth.canAuthorTopics ? '直接公開議題' : '送出議題提案' }}
        </UiButton>
      </form>

      <aside class="lg:sticky lg:top-28 lg:self-start">
        <p class="eyebrow-modern mb-3 text-[#77716a]">議題預覽</p>
        <div class="overflow-hidden rounded-2xl border-t-4 bg-[#171717] p-6 text-white" :style="{ borderColor: getCategoryMeta(category).color }">
          <div class="flex items-center justify-between text-xs"><span class="font-bold">{{ getCategoryMeta(category).label }}</span><span class="text-white/45">待複核 · 尚未開票</span></div>
          <h2 class="mt-6 text-2xl font-black leading-snug">{{ title || '你的議題標題會顯示在這裡' }}</h2>
          <p v-if="description" class="mt-3 text-sm leading-6 text-white/55">{{ description }}</p>
          <div v-if="blocks.length" class="mt-6 flex flex-wrap gap-2 border-t border-white/15 pt-4">
            <span v-for="item in blocks" :key="item.key" class="rounded-full border border-white/20 px-2.5 py-1 text-[10px] text-white/65">{{ blockMeta(item.type).label }}</span>
          </div>
          <p class="mt-7 border-t border-white/15 pt-4 text-xs text-white/45">核准後開放 {{ voteDurationDays }} 天 · 會員發起</p>
        </div>
        <div class="mt-4 surface-card p-5 text-xs leading-6 text-[#6d6861]">待複核期間只有你與管理員看得到，也可以繼續修改。核准開票後，內容即不可直接覆蓋。</div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Category, Topic, TopicContentBlockType, TopicImportPayload, TopicImportStance } from '~/types/topic';
import { errorMessage } from '~/composables/useApi';
import { applyCategoryRules, getCategoryMeta } from '~/utils/topic';
import type { StanceAuthoringForm, TopicAuthoringForm } from '~/types/authoring';
import type { CapabilitySummary } from '~/stores/auth';

definePageMeta({ middleware: 'auth' });

type TopicType = 'BINARY' | 'MULTIPLE' | 'SPECTRUM';
interface DraftBlock {
  key: number;
  type: TopicContentBlockType;
  title: string;
  content: string;
  sourceLabel: string;
  sourceUrl: string;
  occurredAt: string;
  expanded: boolean;
}

interface BlockDefinition {
  type: TopicContentBlockType;
  label: string;
  short: string;
  color: string;
  titleLabel: string;
  titlePlaceholder: string;
  contentLabel: string;
  contentPlaceholder: string;
}

interface BlockGroup {
  label: string;
  items: BlockDefinition[];
}

const route = useRoute();
const api = useApi();
const auth = useAuthStore();
const editingId = computed(() => typeof route.query.edit === 'string' ? route.query.edit : '');
useSeoMeta({ title: computed(() => editingId.value ? '編輯議題｜輿論測風向' : '發起新議題｜輿論測風向') });

const categories = ref<Array<{ key: string }>>([]);
const durations = [3, 7, 14, 30];
const topicTypes: { value: TopicType; label: string; description: string }[] = [
  { value: 'BINARY', label: '二元題', description: '兩個明確選項' },
  { value: 'MULTIPLE', label: '多選題', description: '2 到 6 個方向' },
  { value: 'SPECTRUM', label: '光譜題', description: '以 0 到 100 表態' },
];
const blockGroups: BlockGroup[] = [
  {
    label: '文字與資料',
    items: [
      { type: 'BACKGROUND', label: '背景說明', short: '補充前因後果', color: '#6d6861', titleLabel: '背景標題', titlePlaceholder: '這項議題的背景', contentLabel: '背景內容', contentPlaceholder: '提供理解議題所需的基本脈絡。' },
      { type: 'CASE', label: '具體案例', short: '已發生的情境', color: '#3157d5', titleLabel: '案例標題', titlePlaceholder: '某地區或組織的實際案例', contentLabel: '事實摘要', contentPlaceholder: '描述案例背景、做法與已知結果，不加入立場判斷。' },
      { type: 'DATA', label: '數據資料', short: '調查或統計', color: '#3f7a58', titleLabel: '數據標題', titlePlaceholder: '調查或統計資料名稱', contentLabel: '數據解讀', contentPlaceholder: '列出數值、調查範圍與必要限制。' },
      { type: 'PERSPECTIVES', label: '多方觀點', short: '並列不同立場', color: '#8f4f78', titleLabel: '觀點主題', titlePlaceholder: '各方主要關切', contentLabel: '觀點整理', contentPlaceholder: '並列至少兩種立場及其理由，避免只呈現單一方向。' },
    ],
  },
  {
    label: '引用',
    items: [
      { type: 'SOURCE', label: '來源連結', short: '報告或延伸閱讀', color: '#9a5b12', titleLabel: '來源標題', titlePlaceholder: '報告或公開資料名稱', contentLabel: '來源摘要', contentPlaceholder: '簡述這份資料能協助理解什麼。' },
    ],
  },
];
const blockDefinitions: BlockDefinition[] = blockGroups.flatMap((group) => group.items);

const title = ref('');
const description = ref('');
const category = ref('');
const topicType = ref<TopicType>('BINARY');
const options = ref(['支持', '反對']);
const blocks = ref<DraftBlock[]>([]);
const voteDurationDays = ref(7);
const agreed = ref(false);
const loading = ref(true);
const submitting = ref(false);
const formError = ref('');
const fieldErrors = reactive<Record<string, string>>({});
const savedTopic = ref<Topic | null>(null);
const selectedOrganizationId = ref('');
const blockMenu = ref<HTMLDetailsElement | null>(null);
const importedStances = ref<TopicImportStance[]>([]);
const appliedImport = ref(false);
const eligibility = computed(() => auth.capabilitySummary?.seniorEligibility);
const partnerOrganizations = computed(() => auth.capabilitySummary?.partnerOrganizations ?? []);
const canSubmit = computed(() => auth.canAuthorTopics || auth.canSubmitTopicApplication);
const importMode = computed(() => Boolean(appliedImport.value && !editingId.value && auth.canAuthorTopics));
let nextBlockKey = 1;

watch(topicType, (type, previous) => {
  if (type === 'SPECTRUM') options.value = [];
  else if (type === 'BINARY') options.value = ['支持', '反對'];
  else if (previous !== 'MULTIPLE') options.value = ['選項一', '選項二', '其他'];
});

function blockMeta(type: TopicContentBlockType) {
  return blockDefinitions.find((item) => item.type === type)!;
}

function addBlock(type: TopicContentBlockType) {
  if (blocks.value.length >= 8) return;
  blocks.value.push({ key: nextBlockKey++, type, title: '', content: '', sourceLabel: '', sourceUrl: '', occurredAt: '', expanded: true });
  blockMenu.value?.removeAttribute('open');
}

function moveBlock(index: number, direction: number) {
  const destination = index + direction;
  if (destination < 0 || destination >= blocks.value.length) return;
  const [item] = blocks.value.splice(index, 1);
  blocks.value.splice(destination, 0, item);
}

async function onApplyImport(payload: TopicImportPayload) {
  title.value = payload.title;
  description.value = payload.description ?? '';
  category.value = payload.category;
  topicType.value = payload.topicType;
  await nextTick();
  options.value = [...(payload.options ?? [])];
  voteDurationDays.value = payload.voteDurationDays;
  blocks.value = (payload.blocks ?? []).map((item) => ({
    key: nextBlockKey++,
    type: item.type,
    title: item.title,
    content: item.content,
    sourceLabel: item.sourceLabel ?? '',
    sourceUrl: item.sourceUrl ?? '',
    occurredAt: item.occurredAt?.slice(0, 10) ?? '',
    expanded: false,
  }));
  importedStances.value = payload.stances ?? [];
  appliedImport.value = true;
  formError.value = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function applyAiTopicDraft(form: TopicAuthoringForm | StanceAuthoringForm) {
  if (!('description' in form)) return;
  title.value = form.title;
  description.value = form.description;
  category.value = form.category;
  topicType.value = form.topicType;
  await nextTick();
  options.value = [...form.options];
  voteDurationDays.value = form.voteDurationDays;
  blocks.value = form.blocks.map((item) => ({
    key: nextBlockKey++, type: item.type, title: item.title, content: item.content,
    sourceLabel: '', sourceUrl: '', occurredAt: '', expanded: false,
  }));
}

function validateForm() {
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key];
  if (title.value.length < 10) fieldErrors.title = '議題標題至少需要 10 個字';
  if (description.value && description.value.length < 20) fieldErrors.description = '若填寫說明，至少需要 20 個字；也可以留空';
  if (topicType.value !== 'SPECTRUM') {
    options.value.forEach((option, index) => {
      if (!option.trim()) fieldErrors[`option-${index}`] = `請填寫選項 ${index + 1}`;
    });
    if (new Set(options.value.map((item) => item.trim())).size !== options.value.length) formError.value = '投票選項不可重複。';
  }
  blocks.value.forEach((item, index) => {
    if (item.title.length < 3) fieldErrors[`block-${index}-title`] = '模組標題至少需要 3 個字';
    if (item.content.length < 10) fieldErrors[`block-${index}-content`] = '模組內容至少需要 10 個字';
    if (item.type === 'SOURCE' && !item.sourceUrl) fieldErrors[`block-${index}-source-url`] = '來源連結模組必須提供網址';
    if (item.sourceUrl) {
      try {
        const url = new URL(item.sourceUrl);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch {
        fieldErrors[`block-${index}-source-url`] = '請輸入以 http:// 或 https:// 開頭的完整網址';
      }
    }
  });
  return Object.keys(fieldErrors)[0];
}

function payload() {
  return {
    title: title.value,
    description: description.value || undefined,
    category: category.value,
    topicType: topicType.value,
    options: topicType.value === 'SPECTRUM' ? undefined : options.value,
    voteDurationDays: voteDurationDays.value,
    blocks: blocks.value.map(({ key, expanded, ...item }) => ({
      ...item,
      sourceLabel: item.sourceLabel || undefined,
      sourceUrl: item.sourceUrl || undefined,
      occurredAt: item.type === 'CASE' && item.occurredAt ? item.occurredAt : undefined,
    })),
  };
}

async function rejectInvalidForm(): Promise<boolean> {
  formError.value = '';
  const firstInvalidField = validateForm();
  if (firstInvalidField || formError.value) {
    if (!formError.value) formError.value = '尚有欄位未符合格式，請修正紅色提示後再送出。';
    if (firstInvalidField) {
      const blockIndex = /^block-(\d+)/.exec(firstInvalidField)?.[1];
      if (blockIndex) blocks.value[Number(blockIndex)].expanded = true;
      await nextTick();
      document.querySelector<HTMLElement>(`[data-field="${firstInvalidField}"]`)?.focus();
    }
    return true;
  }
  return false;
}

async function submit() {
  if (await rejectInvalidForm()) return;
  submitting.value = true;
  try {
    savedTopic.value = editingId.value
      ? await api.put<Topic>(`/topics/${editingId.value}`, payload())
      : auth.canAuthorTopics
        ? await api.post<Topic>('/editorial/topics', { ...payload(), publish: true })
        : await api.post<Topic>('/topic-applications', {
            ...payload(),
            applicantType: selectedOrganizationId.value ? 'ORGANIZATION' : 'MEMBER',
            organizationId: selectedOrganizationId.value || undefined,
          });
  } catch (error) {
    formError.value = errorMessage(error);
  } finally {
    submitting.value = false;
  }
}

async function submitImport(publish: boolean) {
  if (await rejectInvalidForm()) return;
  submitting.value = true;
  try {
    savedTopic.value = await api.post<Topic>('/editorial/topics/import', { ...payload(), stances: importedStances.value, publish });
  } catch (error) {
    formError.value = errorMessage(error);
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  try {
    const [summary, categoryItems] = await Promise.all([
      api.get<CapabilitySummary>('/me/capabilities'),
      api.get<Category[]>('/categories'),
    ]);
    auth.setCapabilities(summary);
    categories.value = categoryItems.filter((item) => item.isActive && item.key !== 'quick');
    applyCategoryRules(categoryItems);
    if (!category.value && categories.value[0]) category.value = categories.value[0].key;
    if (summary.membershipTier !== 'SENIOR' && summary.partnerOrganizations.length) {
      selectedOrganizationId.value = summary.partnerOrganizations[0].id;
    }
  } catch (error) {
    formError.value = errorMessage(error);
  }
  const sourceId = editingId.value;
  if (!sourceId) {
    loading.value = false;
    return;
  }
  try {
    const topic = await api.get<Topic>(`/topics/me/${sourceId}/edit`);
    title.value = topic.title;
    description.value = topic.description || '';
    category.value = topic.category;
    topicType.value = topic.topicType;
    await nextTick();
    options.value = topic.options.map((item) => item.label);
    voteDurationDays.value = topic.voteDurationDays;
    blocks.value = topic.blocks.map((item) => ({
      key: nextBlockKey++,
      type: item.type,
      title: item.title,
      content: item.content,
      sourceLabel: item.sourceLabel || '',
      sourceUrl: item.sourceUrl || '',
      occurredAt: item.occurredAt?.slice(0, 10) || '',
      expanded: false,
    }));
  } catch (error) {
    formError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
});
</script>

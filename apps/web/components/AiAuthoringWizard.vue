<template>
  <section class="border-2 border-[#3157d5] bg-[#eef1ff] p-4 sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="eyebrow text-[#3157d5]">AI 表達助手</p>
        <h3 class="mt-1 font-black">{{ target === 'STANCE' ? '整理目前填寫的內容' : '先釐清，再選擇草稿' }}</h3>
        <p class="mt-1 text-xs leading-5 text-[#5f5a53]">{{ target === 'STANCE' ? 'AI 會讀取上方的立場內容與理由，產生可選版本；不會自動修改或送出。' : '內容會傳送至設定的 AI 服務。草稿只會填入表單，不會自動送出。' }}</p>
      </div>
      <button v-if="!expanded && target === 'STANCE'" type="button" class="focus-ring min-h-10 bg-[#3157d5] px-4 text-xs font-black text-white disabled:opacity-40" :disabled="busy || !canGenerateStance" @click="generateStanceDrafts">{{ busy ? '整理中…' : 'AI 幫我整理' }}</button>
      <button v-else-if="!expanded" type="button" class="focus-ring min-h-10 bg-[#3157d5] px-4 text-xs font-black text-white" @click="expanded = true">開始整理</button>
      <button v-else-if="target === 'STANCE'" type="button" class="focus-ring min-h-10 px-2 text-xs font-black text-[#3157d5] disabled:opacity-40" :disabled="busy || !canGenerateStance" @click="generateStanceDrafts">重新整理</button>
      <button v-else type="button" class="focus-ring min-h-10 px-2 text-xs font-black text-[#6d6861]" @click="reset">重新開始</button>
    </div>

    <div v-if="expanded" class="mt-4 border-t border-[#b8c3ef] pt-4">
      <div v-if="target === 'STANCE'">
        <p v-if="busy" role="status" class="py-4 text-sm font-bold text-[#3157d5]">正在依照你已填寫的內容整理版本…</p>
        <div v-else-if="drafts.length" class="space-y-3">
          <p class="text-sm font-black">比較整理後的版本，選擇一份套用；原欄位在你確認前不會改變。</p>
          <article v-for="draft in drafts" :key="draft.id" class="border border-[#9eacd9] bg-white p-4">
            <p class="text-[11px] font-black tracking-wide text-[#3157d5]">{{ draft.label }}</p>
            <h4 class="mt-1 font-black leading-6">{{ draft.form.title }}</h4>
            <p class="mt-2 text-xs leading-5 text-[#6d6861]">{{ draftSummary(draft) }}</p>
            <button type="button" class="focus-ring mt-3 min-h-10 border border-[#3157d5] px-4 text-xs font-black text-[#3157d5]" @click="applyDraft(draft)">套用這個版本</button>
          </article>
        </div>
      </div>

      <div v-else-if="step === 'IDEA'">
        <label class="block text-xs font-black" :for="`${uid}-brief`">用自己的話描述你想表達什麼</label>
        <textarea :id="`${uid}-brief`" v-model="brief" maxlength="2000" rows="4" class="focus-ring mt-2 w-full border border-[#9eacd9] bg-white p-3 text-sm leading-6" placeholder="至少 10 個字；不需要先整理成完整標題。" />
        <div class="mt-3 flex items-center justify-between gap-3">
          <span class="text-[11px] text-[#77716a]">{{ brief.trim().length }} / 2000</span>
          <button type="button" class="focus-ring min-h-11 bg-[#3157d5] px-5 text-sm font-black text-white disabled:opacity-40" :disabled="busy || brief.trim().length < 10" @click="startInterview">{{ busy ? '整理問題中…' : '產生澄清問題' }}</button>
        </div>
      </div>

      <div v-else-if="step === 'QUESTIONS'" class="space-y-4">
        <p class="text-sm font-black">回答 {{ questions.length }} 個問題，AI 會據此整理不同版本。</p>
        <label v-for="(question, index) in questions" :key="question.id" class="block">
          <span class="text-xs font-black">{{ index + 1 }}. {{ question.prompt }}</span>
          <textarea v-model="answers[question.id]" :maxlength="question.maxLength" rows="3" class="focus-ring mt-2 w-full border border-[#9eacd9] bg-white p-3 text-sm leading-6" />
        </label>
        <div class="flex justify-end">
          <button type="button" class="focus-ring min-h-11 bg-[#3157d5] px-5 text-sm font-black text-white disabled:opacity-40" :disabled="busy || !allAnswered" @click="generateDrafts">{{ busy ? '產生草稿中…' : '產生多個草稿' }}</button>
        </div>
      </div>

      <div v-else class="space-y-3">
        <p class="text-sm font-black">選擇最接近你的版本，套用後仍可自由修改。</p>
        <article v-for="draft in drafts" :key="draft.id" class="border border-[#9eacd9] bg-white p-4">
          <p class="text-[11px] font-black tracking-wide text-[#3157d5]">{{ draft.label }}</p>
          <h4 class="mt-1 font-black leading-6">{{ draft.form.title }}</h4>
          <p class="mt-2 line-clamp-3 text-xs leading-5 text-[#6d6861]">{{ draftSummary(draft) }}</p>
          <button type="button" class="focus-ring mt-3 min-h-10 border border-[#3157d5] px-4 text-xs font-black text-[#3157d5]" @click="applyDraft(draft)">套用這份草稿</button>
        </article>
      </div>

      <p v-if="error" role="alert" class="mt-4 border-l-4 border-[#d84a36] bg-[#fbe9e5] p-3 text-xs font-bold text-[#a63222]">{{ error }}</p>
      <p v-if="applied" role="status" class="mt-4 border-l-4 border-[#3f7a58] bg-[#e5f1e9] p-3 text-xs font-bold text-[#2f6547]">草稿已套用，請檢查並修改後再送出。</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { AuthoringDraft, AuthoringDraftsResponse, AuthoringQuestion, AuthoringSessionResponse, AuthoringTarget, StanceAuthoringForm, TopicAuthoringForm } from '~/types/authoring';

const props = withDefaults(defineProps<{ target: AuthoringTarget; formContext: Record<string, unknown>; topicId?: string; parentId?: string; hasExistingContent?: boolean }>(), { topicId: undefined, parentId: undefined, hasExistingContent: false });
const emit = defineEmits<{ apply: [form: TopicAuthoringForm | StanceAuthoringForm] }>();
const api = useApi();
const uid = useId();
const expanded = ref(false);
const step = ref<'IDEA' | 'QUESTIONS' | 'DRAFTS'>('IDEA');
const brief = ref('');
const sessionId = ref('');
const questions = ref<AuthoringQuestion[]>([]);
const answers = reactive<Record<string, string>>({});
const drafts = ref<AuthoringDraft[]>([]);
const busy = ref(false);
const error = ref('');
const applied = ref(false);
const allAnswered = computed(() => questions.value.every((question) => (answers[question.id] || '').trim().length > 0));
const canGenerateStance = computed(() => {
  const title = typeof props.formContext.title === 'string' ? props.formContext.title.trim() : '';
  const rationale = typeof props.formContext.rationale === 'string' ? props.formContext.rationale.trim() : '';
  return `${title}${rationale}`.length >= 2;
});

async function generateStanceDrafts() {
  busy.value = true; error.value = ''; applied.value = false; expanded.value = true;
  try {
    const result = await api.post<{ target: 'STANCE'; drafts: AuthoringDraft[] }>('/authoring/stance-drafts', {
      topicId: props.topicId,
      parentId: props.parentId,
      title: typeof props.formContext.title === 'string' ? props.formContext.title : undefined,
      rationale: typeof props.formContext.rationale === 'string' ? props.formContext.rationale : undefined,
    }, { timeout: 35000 });
    drafts.value = result.drafts;
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    busy.value = false;
  }
}

async function startInterview() {
  busy.value = true; error.value = ''; applied.value = false;
  try {
    const result = await api.post<AuthoringSessionResponse>('/authoring/sessions', {
      target: props.target, brief: brief.value.trim(), topicId: props.topicId, parentId: props.parentId, form: props.formContext,
    }, { timeout: 35000 });
    sessionId.value = result.sessionId;
    questions.value = result.questions;
    for (const key of Object.keys(answers)) delete answers[key];
    for (const question of result.questions) answers[question.id] = '';
    step.value = 'QUESTIONS';
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    busy.value = false;
  }
}

async function generateDrafts() {
  busy.value = true; error.value = '';
  try {
    const result = await api.post<AuthoringDraftsResponse>(`/authoring/sessions/${sessionId.value}/drafts`, {
      answers: questions.value.map((question) => ({ questionId: question.id, value: answers[question.id].trim() })),
    }, { timeout: 35000 });
    drafts.value = result.drafts;
    step.value = 'DRAFTS';
  } catch (cause) {
    error.value = errorMessage(cause);
  } finally {
    busy.value = false;
  }
}

function applyDraft(draft: AuthoringDraft) {
  if (props.hasExistingContent && !window.confirm('套用草稿會取代目前已填寫的主要欄位，是否繼續？')) return;
  emit('apply', draft.form);
  applied.value = true;
}

function draftSummary(draft: AuthoringDraft) {
  return 'description' in draft.form ? draft.form.description : draft.form.rationale || '可直接作為立場標題使用。';
}

function reset() {
  step.value = 'IDEA'; sessionId.value = ''; questions.value = []; drafts.value = []; error.value = ''; applied.value = false;
  for (const key of Object.keys(answers)) delete answers[key];
}
</script>

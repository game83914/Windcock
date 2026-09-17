<template>
  <div class="mx-auto max-w-6xl pb-12">
    <div class="mb-8 border-b border-[#ded7cb] pb-6">
      <h1 class="mt-1 text-3xl font-black tracking-[-0.04em] sm:text-4xl">發起問卷</h1>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-[#6d6861]">一頁多題，組合選項、圖片、光譜、簡答等各種題型。</p>
    </div>

    <div v-if="savedTopic" class="surface-card p-8 text-center sm:p-12">
      <p class="eyebrow-modern text-[#b0761f]">問卷已上線</p>
      <h2 class="mt-3 text-2xl font-black">你的問卷可以開始作答了</h2>
      <p class="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#6d6861]">共 {{ savedTopic.questionCount ?? questions.length }} 題，開放 {{ savedTopic.voteDurationHours }} 小時。作答完成可獲得一次投票獎勵。</p>
      <div class="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <UiButton v-if="savedTopic.sharePath" variant="primary" @click="copySharePath(savedTopic.sharePath)">{{ copied ? '已複製連結' : '複製私密連結' }}</UiButton>
        <UiButton :to="`/topic/${savedTopic.id}`" variant="quick">前往問卷詳情</UiButton>
        <UiButton :to="'/me/surveys'" variant="outline">查看我的問卷</UiButton>
      </div>
    </div>

    <div v-else-if="loading" class="h-96 animate-pulse rounded-2xl bg-[#e5e0d6]" />

    <div v-else-if="!canCreateQuick" class="surface-card p-6 sm:p-8">
      <p class="eyebrow-modern text-[#b0761f]">資深會員限定</p>
      <h2 class="mt-2 text-xl font-black">成為資深會員後即可發起問卷</h2>
      <p class="mt-3 text-sm leading-6 text-[#6d6861]">帳號需滿 30 天，並在至少 10 個不同議題完成投票。目前為 {{ eligibility?.accountAgeDays ?? 0 }} 天、{{ eligibility?.distinctTopicsVoted ?? 0 }} 個議題。</p>
      <UiButton :to="'/'" variant="primary" class="mt-5">先來探索問卷</UiButton>
    </div>

    <div v-else class="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <form class="space-y-6" novalidate @submit.prevent="submit">
        <section class="surface-card p-5 sm:p-7">
          <label class="block">
            <span class="mb-2 flex justify-between text-sm font-bold"><span>問卷標題</span><span class="font-normal text-[#8b857d]">{{ title.length }} / 100</span></span>
            <input v-model.trim="title" data-field="title" maxlength="100" minlength="5" placeholder="例如：週末出遊偏好大調查" class="field-input" :class="{ 'field-input-error': fieldErrors.title }" />
            <p v-if="fieldErrors.title" class="mt-2 text-xs font-bold text-[#a63222]">{{ fieldErrors.title }}</p>
          </label>
        </section>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm font-black">問卷題目 <span class="text-[#8f5d14]">{{ questions.length }} / {{ maxQuestions }}</span></p>
          <div class="flex items-center gap-3 text-xs font-bold">
            <button type="button" class="focus-ring rounded-full text-[#8f5d14] hover:underline disabled:cursor-not-allowed disabled:opacity-40" :disabled="allQuestionsCollapsed" @click="setAllQuestionsExpanded(false)">全部收合</button>
            <button type="button" class="focus-ring rounded-full text-[#8f5d14] hover:underline disabled:cursor-not-allowed disabled:opacity-40" :disabled="allQuestionsExpanded" @click="setAllQuestionsExpanded(true)">全部展開</button>
          </div>
        </div>

        <div ref="questionsEl" class="space-y-3">
          <article v-for="(question, index) in questions" :key="question.id" :data-question-id="question.id" class="surface-card overflow-hidden">
            <header class="flex items-center gap-3 px-4 py-3 sm:px-5">
              <span data-question-handle class="grid h-9 w-9 shrink-0 cursor-grab place-items-center rounded-full bg-[#f0e6d2] text-xs font-black text-[#8f5d14] active:cursor-grabbing" title="拖曳以排序" aria-label="拖曳以排序">{{ index + 1 }}</span>
              <button type="button" class="focus-ring min-w-0 flex-1 rounded-lg text-left" :aria-expanded="question.expanded" :aria-controls="`survey-question-${question.id}`" @click="question.expanded = !question.expanded">
                <strong class="block truncate text-sm">{{ question.questionTitle || `第 ${index + 1} 題尚未命名` }}</strong>
                <span class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#77716a]">
                  <span class="font-bold text-[#8f5d14]">{{ BUILDER_RULES[question.type].label }}</span>
                  <span>{{ questionSummary(question) }}</span>
                </span>
              </button>
              <button type="button" class="focus-ring shrink-0 rounded-full px-2 py-1 text-xs font-bold text-[#77716a] hover:bg-[#ebe6dc]" :aria-expanded="question.expanded" :aria-controls="`survey-question-${question.id}`" @click="question.expanded = !question.expanded">{{ question.expanded ? '收合' : '編輯' }}</button>
              <button v-if="questions.length > 2" type="button" class="focus-ring shrink-0 rounded-full px-2 py-1 text-xs font-bold text-[#a63222] hover:bg-[#fbe9e5]" aria-label="刪除題目" @click="removeQuestion(index)">刪除</button>
            </header>
            <div v-show="question.expanded" :id="`survey-question-${question.id}`" class="border-t border-[#f0e6d2] bg-[#fffdf8] p-5 sm:p-6">
              <TopicsTopicQuestionBuilder
                :ref="(el: any) => setBuilderRef(question.id, el)"
                :show-title-input="true"
                v-model:type="question.type"
                v-model:rows="question.rows"
                v-model:prompt="question.prompt"
                v-model:question-title="question.questionTitle"
                v-model:scale-min-label="question.scaleMinLabel"
                v-model:scale-max-label="question.scaleMaxLabel"
                v-model:max-selections="question.maxSelections"
              />
            </div>
          </article>
        </div>

        <button v-if="questions.length < maxQuestions" type="button" class="focus-ring w-full rounded-2xl border-2 border-dashed border-[#e0c9a0] bg-[#fffaf0] py-3 text-sm font-black text-[#b0761f] hover:bg-[#fff0d7]" @click="addQuestion">＋ 新增題目（{{ questions.length }} / {{ maxQuestions }}）</button>

        <section class="surface-card p-5 sm:p-7">
          <details class="group">
            <summary class="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-1 py-1 text-sm font-bold text-[#8f5d14] marker:hidden">
              <span>進階設定</span>
              <span class="flex min-w-0 items-center gap-2 text-xs font-bold text-[#8f5d14]">
                <span class="truncate">{{ advancedSummary }}</span>
                <span class="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
              </span>
            </summary>
            <div class="mt-4 grid gap-5 sm:grid-cols-3">
              <label class="block">
                <span class="mb-2 block text-sm font-bold">投票時間</span>
                <select v-model="voteDurationHours" class="field-input w-full font-bold"><option v-for="item in durationOptions" :key="item.value" :value="item.value">{{ item.label }}</option></select>
              </label>
              <label class="block">
                <span class="mb-2 block text-sm font-bold">曝光方式</span>
                <select v-model="visibility" class="field-input w-full font-bold"><option v-for="item in visibilityOptions" :key="item.value" :value="item.value">{{ item.label }}</option></select>
              </label>
              <label class="block">
                <span class="mb-2 block text-sm font-bold">查看與參與資格</span>
                <select v-model="audience" class="field-input w-full font-bold"><option v-for="item in audienceOptions" :key="item.value" :value="item.value">{{ item.label }}</option></select>
              </label>
              <p class="text-xs leading-5 text-[#77716a] sm:col-span-3">{{ settingHint }}</p>
            </div>
          </details>
        </section>

        <p v-if="formError" class="rounded-2xl border-l-4 border-[#d84a36] bg-[#fbe9e5] p-4 text-sm text-[#a63222]">{{ formError }}</p>

        <div class="flex flex-col items-center gap-2">
          <UiButton type="submit" variant="quick" block size="lg" :disabled="submitting">
            {{ submitting ? '發布中…' : '發起問卷並上線' }}
          </UiButton>
        </div>
      </form>

      <aside class="lg:sticky lg:top-28 lg:self-start">
        <p class="eyebrow-modern mb-3 text-[#77716a]">問卷預覽</p>
        <div class="surface-quick p-6">
          <div class="flex items-center justify-between text-xs">
            <span class="rounded-full bg-[#b0761f] px-2.5 py-0.5 text-[10px] font-black text-white">問卷</span>
            <span class="font-bold text-[#b0761f]">{{ questions.length }} 題</span>
          </div>
          <h2 class="mt-6 text-2xl font-black leading-snug">{{ title || '你的問卷會顯示在這裡' }}</h2>
          <ol class="mt-5 space-y-3 border-t border-[#f0e6d2] pt-4">
            <li v-for="(question, index) in questions" :key="question.id" class="flex gap-3 text-sm">
              <span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f0e6d2] text-[10px] font-black text-[#8f5d14]">{{ index + 1 }}</span>
              <span class="min-w-0">
                <span class="block truncate font-bold">{{ question.questionTitle || '未命名題目' }}</span>
                 <span class="text-xs text-[#8f5d14]">{{ BUILDER_RULES[question.type].label }}</span>
                 <span v-if="question.type === 'LIKERT_5' || question.type === 'LIKERT_7'" class="block truncate text-[11px] text-[#77716a]">{{ question.scaleMinLabel || '最低' }} ～ {{ question.scaleMaxLabel || '最高' }}</span>
                 <span v-else-if="question.type === 'MULTI_SELECT'" class="block text-[11px] text-[#77716a]">最多選 {{ question.maxSelections }} 項</span>
              </span>
            </li>
          </ol>
          <p class="mt-7 border-t border-[#f0e6d2] pt-4 text-xs text-[#8f5d14]">立即上線 · {{ durationLabel }} · 完成全部題目領獎勵</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Topic, TopicAudience, TopicVisibility } from '~/types/topic';
import { errorMessage } from '~/composables/useApi';
import type { CapabilitySummary } from '~/stores/auth';
import { BUILDER_RULES, questionPayload, seedRows, type BuilderRow, type BuilderType } from '~/utils/questionBuilder';

definePageMeta({ middleware: 'auth' });

interface SurveyQuestionDraft {
  id: string;
  questionTitle: string;
  type: BuilderType;
  rows: BuilderRow[];
  prompt: string;
  scaleMinLabel: string;
  scaleMaxLabel: string;
  maxSelections: number;
  expanded: boolean;
}

interface SurveyTopic extends Topic {
  questionCount?: number;
}

const api = useApi();
const auth = useAuthStore();
useSeoMeta({ title: '發起問卷｜輿論測風向' });

const maxQuestions = 20;
let questionSeq = 0;
function newQuestion(): SurveyQuestionDraft {
  return { id: `q-${questionSeq++}`, questionTitle: '', type: 'OPTION', rows: seedRows('OPTION'), prompt: '', scaleMinLabel: '', scaleMaxLabel: '', maxSelections: 1, expanded: true };
}

const durationOptions = [
  { value: 6, label: '6 小時' },
  { value: 12, label: '12 小時' },
  { value: 24, label: '24 小時' },
  { value: 48, label: '2 天' },
];

const title = ref('');
const questions = ref<SurveyQuestionDraft[]>([newQuestion(), newQuestion()]);
const voteDurationHours = ref(24);
const visibility = ref<TopicVisibility>('PUBLIC');
const audience = ref<TopicAudience>('MEMBER_ONLY');
const copied = ref(false);
const loading = ref(true);
const submitting = ref(false);
const formError = ref('');
const fieldErrors = reactive<Record<string, string>>({});
const savedTopic = ref<SurveyTopic | null>(null);
const questionsEl = ref<HTMLElement | null>(null);
const builderRefs: Record<string, { validate: () => { firstField: string | null; formError: string } } | undefined> = {};
const firstInvalidQuestion = ref<{ id: string; field: string } | null>(null);
const eligibility = computed(() => auth.capabilitySummary?.seniorEligibility);
const canCreateQuick = computed(() => auth.isAuthed && (auth.canAuthorTopics || auth.capabilitySummary?.membershipTier === 'SENIOR'));
const allQuestionsExpanded = computed(() => questions.value.every((question) => question.expanded));
const allQuestionsCollapsed = computed(() => questions.value.every((question) => !question.expanded));
const durationLabel = computed(() => durationOptions.find((item) => item.value === voteDurationHours.value)?.label ?? `${voteDurationHours.value} 小時`);
const settingHint = computed(() => {
  const visibilityHint = visibilityOptions.find((item) => item.value === visibility.value)?.description ?? '';
  const audienceHint = audienceOptions.find((item) => item.value === audience.value)?.description ?? '';
  return [visibilityHint, audienceHint].filter(Boolean).join('　');
});
const advancedSummary = computed(() => {
  const visibilityLabel = visibilityOptions.find((item) => item.value === visibility.value)?.label ?? '';
  const audienceLabel = audienceOptions.find((item) => item.value === audience.value)?.label ?? '';
  return [durationLabel.value, visibilityLabel, audienceLabel].filter(Boolean).join('・');
});
const visibilityOptions = [
  { value: 'PUBLIC' as const, label: '公開刊登', description: '會出現在首頁、搜尋與你的公開頁面。' },
  { value: 'PRIVATE_LINK' as const, label: '私密連結', description: '不公開刊登，登入且取得連結的人才能查看。' },
];
const audienceOptions = [
  { value: 'MEMBER_ONLY' as const, label: '所有會員', description: '取得查看權限的登入會員都能參與。' },
  { value: 'FOLLOWERS_ONLY' as const, label: '僅限追蹤者', description: '只有目前追蹤你頻道的會員能查看與互動。' },
];

function setBuilderRef(id: string, el: unknown) {
  if (el) builderRefs[id] = el as { validate: () => { firstField: string | null; formError: string } };
  else delete builderRefs[id];
}

function setAllQuestionsExpanded(expanded: boolean) {
  questions.value.forEach((question) => { question.expanded = expanded; });
}

function questionSummary(question: SurveyQuestionDraft) {
  if (question.type === 'SPECTRUM') return '0～100 光譜，無需設定選項';
  if (question.type === 'SHORT_ANSWER') return question.prompt.trim() ? '已設定作答提示' : '文字回答';
  if (question.type === 'STAR_RATING') return '1～5 星評分';
  if (question.type === 'LIKERT_5' || question.type === 'LIKERT_7') return `${question.type === 'LIKERT_7' ? 7 : 5} 點：${question.scaleMinLabel || '最低'} ～ ${question.scaleMaxLabel || '最高'}`;
  const completed = question.type === 'IMAGE_OPTION' || question.type === 'IMAGE_RANK'
    ? question.rows.filter((row) => row.image).length
    : question.rows.filter((row) => row.label.trim()).length;
  const unit = question.type === 'MATCHING' ? '組配對' : question.type === 'IMAGE_OPTION' || question.type === 'IMAGE_RANK' ? '張圖片' : '個項目';
  if (completed) return question.type === 'MULTI_SELECT' ? `已填 ${completed} / ${question.rows.length} 個選項，最多選 ${question.maxSelections} 項` : `已填 ${completed} / ${question.rows.length} ${unit}`;
  if (question.type === 'IMAGE_OPTION' || question.type === 'IMAGE_RANK') return '尚未上傳圖片';
  if (question.type === 'MATCHING') return '尚未填寫配對';
  return '尚未填寫項目';
}

function addQuestion() {
  if (questions.value.length >= maxQuestions) return;
  questions.value.push(newQuestion());
}

function removeQuestion(index: number) {
  if (questions.value.length <= 2) return;
  const [removed] = questions.value.splice(index, 1);
  if (removed) delete builderRefs[removed.id];
}

function reorderQuestions(from: number, to: number) {
  const [moved] = questions.value.splice(from, 1);
  if (!moved) return;
  questions.value.splice(to, 0, moved);
}

useDragSort(questionsEl, reorderQuestions, '[data-question-handle]');

async function copySharePath(path: string) {
  await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
  copied.value = true;
}

function validateForm() {
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key];
  formError.value = '';
  firstInvalidQuestion.value = null;
  let valid = true;
  if (title.value.length < 5) {
    fieldErrors.title = '標題至少需要 5 個字';
    valid = false;
  }
  questions.value.forEach((question, index) => {
    const result = builderRefs[question.id]?.validate() ?? { firstField: null, formError: '' };
    if (result.firstField || result.formError) {
      question.expanded = true;
      firstInvalidQuestion.value ??= { id: question.id, field: result.firstField ?? 'question-title' };
      if (!fieldErrors.title) formError.value = formError.value || `第 ${index + 1} 題尚未完成：${result.formError || '請檢查題目設定'}`;
      valid = false;
    }
  });
  return valid;
}

async function submit() {
  formError.value = '';
  if (!validateForm()) {
    await nextTick();
    if (fieldErrors.title) {
      document.querySelector<HTMLElement>('[data-field="title"]')?.focus();
    } else if (firstInvalidQuestion.value) {
      const { id, field } = firstInvalidQuestion.value;
      document.querySelector<HTMLElement>(`[data-question-id="${id}"]`)?.querySelector<HTMLElement>(`[data-field="${field}"]`)?.focus();
    }
    return;
  }
  submitting.value = true;
  try {
    const payload = {
      title: title.value,
      voteDurationHours: voteDurationHours.value,
      visibility: visibility.value,
      audience: audience.value,
      questions: questions.value.map((question) => ({
        title: question.questionTitle.trim(),
        ...questionPayload({
          type: question.type,
          rows: question.rows,
          prompt: question.prompt,
          scaleMinLabel: question.scaleMinLabel,
          scaleMaxLabel: question.scaleMaxLabel,
          maxSelections: question.maxSelections,
        }),
      })),
    };
    savedTopic.value = await api.post<SurveyTopic>('/topics/surveys', payload);
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

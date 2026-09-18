<template>
  <div class="mx-auto max-w-6xl pb-12">
    <div class="mb-8 border-b border-[#ded7cb] pb-6">
      <h1 class="mt-1 text-3xl font-black tracking-[-0.04em] sm:text-4xl">發起回合制</h1>
      <p class="mt-2 max-w-2xl text-sm leading-6 text-[#6d6861]">多輪快問：每輪投票後由作者發布回饋，再開啟下一回合題目。</p>
    </div>

    <div v-if="savedTopic" class="surface-card p-8 text-center sm:p-12">
      <p class="eyebrow-modern text-[#b0761f]">回合制已上線</p>
      <h2 class="mt-3 text-2xl font-black">第 1 輪可以開始投票了</h2>
      <p class="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#6d6861]">共 {{ savedTopic.totalRounds ?? totalRounds }} 輪，每輪開放 {{ savedTopic.voteDurationHours }} 小時。投票完成可獲得一次投票獎勵。</p>
      <div class="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <UiButton v-if="savedTopic.sharePath" variant="primary" @click="copySharePath(savedTopic.sharePath)">{{ copied ? '已複製連結' : '複製私密連結' }}</UiButton>
        <UiButton :to="`/topic/${savedTopic.id}`" variant="quick">前往回合制詳情</UiButton>
        <UiButton :to="'/me/surveys'" variant="outline">查看我的問卷</UiButton>
      </div>
    </div>

    <div v-else-if="loading" class="h-96 animate-pulse rounded-2xl bg-[#e5e0d6]" />

    <div v-else-if="!canCreateQuick" class="surface-card p-6 sm:p-8">
      <p class="eyebrow-modern text-[#b0761f]">資深會員限定</p>
      <h2 class="mt-2 text-xl font-black">成為資深會員後即可發起回合制</h2>
      <p class="mt-3 text-sm leading-6 text-[#6d6861]">帳號需滿 30 天，並在至少 10 個不同議題完成投票。目前為 {{ eligibility?.accountAgeDays ?? 0 }} 天、{{ eligibility?.distinctTopicsVoted ?? 0 }} 個議題。</p>
      <UiButton :to="'/'" variant="primary" class="mt-5">先來探索議題</UiButton>
    </div>

    <div v-else class="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <form class="space-y-6" novalidate @submit.prevent="submit">
        <section class="surface-card p-5 sm:p-7">
          <label class="block">
            <span class="mb-2 flex justify-between text-sm font-bold"><span>回合制標題</span><span class="font-normal text-[#8b857d]">{{ title.length }} / 100</span></span>
            <input v-model.trim="title" data-field="title" maxlength="100" minlength="5" placeholder="例如：連續三週追蹤：你支持哪種能源配比？" class="field-input" :class="{ 'field-input-error': fieldErrors.title }" />
            <p v-if="fieldErrors.title" class="mt-2 text-xs font-bold text-[#a63222]">{{ fieldErrors.title }}</p>
          </label>

          <label class="mt-6 block">
            <span class="mb-2 block text-sm font-bold">總回合數</span>
            <select v-model.number="totalRounds" data-field="total-rounds" class="field-input w-full font-bold sm:w-48">
              <option v-for="n in 9" :key="n + 1" :value="n + 1">{{ n + 1 }} 回合</option>
            </select>
            <p class="mt-2 text-xs leading-5 text-[#77716a]">共 2～10 回合，每輪結束後由你發布回饋並開啟下一題。</p>
          </label>
        </section>

        <section class="surface-card p-5 sm:p-7">
          <p class="eyebrow-modern text-[#b0761f]">第 1 回合題目</p>
          <div class="mt-4">
            <TopicsTopicQuestionBuilder
              ref="builderRef"
              :show-title-input="true"
              v-model:type="builderType"
              v-model:rows="rows"
              v-model:prompt="prompt"
              v-model:question-title="roundTitle"
              v-model:scale-min-label="scaleMinLabel"
              v-model:scale-max-label="scaleMaxLabel"
              v-model:points="points"
              v-model:max-selections="maxSelections"
              v-model:scratch-card="scratchCard"
            />
          </div>
        </section>

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
            {{ submitting ? '發布中…' : '發起回合制並上線' }}
          </UiButton>
        </div>
      </form>

      <aside class="lg:sticky lg:top-28 lg:self-start">
        <p class="eyebrow-modern mb-3 text-[#77716a]">回合制預覽</p>
        <div class="surface-quick p-6">
          <div class="flex items-center justify-between text-xs">
            <span class="rounded-full bg-[#b0761f] px-2.5 py-0.5 text-[10px] font-black text-white">回合制</span>
            <span class="font-bold text-[#b0761f]">共 {{ totalRounds }} 回合</span>
          </div>
          <h2 class="mt-6 text-2xl font-black leading-snug">{{ title || '你的回合制會顯示在這裡' }}</h2>
          <div class="mt-5 border-t border-[#f0e6d2] pt-4 text-sm">
            <p class="font-bold">第 1 輪：{{ roundTitle || '尚未命名' }}</p>
            <p class="mt-1 text-xs text-[#8f5d14]">{{ BUILDER_RULES[builderType].label }}</p>
          </div>
          <p class="mt-7 border-t border-[#f0e6d2] pt-4 text-xs text-[#8f5d14]">立即上線 · {{ durationLabel }} · 每輪投完領獎勵</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Topic, TopicAudience, TopicVisibility } from '~/types/topic';
import { errorMessage } from '~/composables/useApi';
import type { CapabilitySummary } from '~/stores/auth';
import { BUILDER_RULES, createScratchCardDraft, questionPayload, seedRows, type BuilderRow, type BuilderType } from '~/utils/questionBuilder';

definePageMeta({ middleware: 'auth' });

const api = useApi();
const auth = useAuthStore();
useSeoMeta({ title: '發起回合制｜輿論測風向' });

const durationOptions = [
  { value: 6, label: '6 小時' },
  { value: 12, label: '12 小時' },
  { value: 24, label: '24 小時' },
  { value: 48, label: '2 天' },
];
const visibilityOptions = [
  { value: 'PUBLIC' as const, label: '公開刊登', description: '會出現在首頁、搜尋與你的公開頁面。' },
  { value: 'PRIVATE_LINK' as const, label: '私密連結', description: '不公開刊登，登入且取得連結的人才能查看。' },
];
const audienceOptions = [
  { value: 'MEMBER_ONLY' as const, label: '所有會員', description: '取得查看權限的登入會員都能參與。' },
  { value: 'FOLLOWERS_ONLY' as const, label: '僅限追蹤者', description: '只有目前追蹤你頻道的會員能查看與互動。' },
];

const title = ref('');
const totalRounds = ref(3);
const builderType = ref<BuilderType>('OPTION');
const rows = ref<BuilderRow[]>(seedRows('OPTION'));
const prompt = ref('');
const roundTitle = ref('');
const scaleMinLabel = ref('');
const scaleMaxLabel = ref('');
const points = ref(5);
const maxSelections = ref(1);
const scratchCard = ref(createScratchCardDraft());
const voteDurationHours = ref(24);
const visibility = ref<TopicVisibility>('PUBLIC');
const audience = ref<TopicAudience>('MEMBER_ONLY');
const copied = ref(false);
const loading = ref(true);
const submitting = ref(false);
const formError = ref('');
const fieldErrors = reactive<Record<string, string>>({});
const savedTopic = ref<Topic | null>(null);
const builderRef = ref<{ validate: () => { firstField: string | null; formError: string } } | null>(null);
const eligibility = computed(() => auth.capabilitySummary?.seniorEligibility);
const canCreateQuick = computed(() => auth.isAuthed && (auth.canAuthorTopics || auth.capabilitySummary?.membershipTier === 'SENIOR'));
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

async function copySharePath(path: string) {
  await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
  copied.value = true;
}

function validateForm() {
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key];
  formError.value = '';
  let valid = true;
  let builderFirstField: string | null = null;
  if (title.value.length < 5) {
    fieldErrors.title = '標題至少需要 5 個字';
    valid = false;
  }
  const builderResult = builderRef.value?.validate() ?? { firstField: null, formError: '' };
  if (builderResult.firstField) {
    builderFirstField = builderResult.firstField;
    valid = false;
  }
  if (builderResult.formError) {
    formError.value = builderResult.formError;
    valid = false;
  }
  if (!Number.isInteger(totalRounds.value) || totalRounds.value < 2 || totalRounds.value > 10) {
    formError.value = formError.value || '總回合數需介於 2～10。';
    valid = false;
  }
  return valid ? null : Object.keys(fieldErrors)[0] || builderFirstField;
}

async function submit() {
  formError.value = '';
  const firstInvalidField = validateForm();
  if (firstInvalidField || formError.value) {
    if (firstInvalidField) {
      await nextTick();
      const selector = firstInvalidField === 'title' ? '[data-field="title"]' : `[data-field="${firstInvalidField}"]`;
      document.querySelector<HTMLElement>(selector)?.focus();
    }
    return;
  }
  submitting.value = true;
  try {
    const payload: Record<string, unknown> = {
      title: title.value,
      totalRounds: totalRounds.value,
      voteDurationHours: voteDurationHours.value,
      visibility: visibility.value,
      audience: audience.value,
      question: {
        title: roundTitle.value.trim(),
        ...questionPayload({
          type: builderType.value,
          rows: rows.value,
          prompt: prompt.value,
          points: points.value,
          scaleMinLabel: scaleMinLabel.value,
          scaleMaxLabel: scaleMaxLabel.value,
          maxSelections: maxSelections.value,
          scratchCard: scratchCard.value,
        }),
      },
    };
    savedTopic.value = await api.post<Topic>('/topics/staged', payload);
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

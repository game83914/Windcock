<template>
  <section class="mt-6 overflow-hidden rounded-2xl border border-[#e0c9a0] bg-[#fffaf0]">
    <header class="border-b border-[#f0e6d2] px-5 py-4">
      <p class="eyebrow-modern text-[#b0761f]">作者面板</p>
      <h3 class="mt-1 text-lg font-black">{{ isFinal ? '發布最終回饋並結算' : `發布回饋並開啟第 ${nextRoundNumber} 輪` }}</h3>
    </header>
    <div class="space-y-5 p-5 sm:p-6">
      <label class="block">
        <span class="mb-2 flex justify-between text-sm font-bold"><span>本輪回饋（{{ feedback.length }} / 2000）</span></span>
        <textarea v-model.trim="feedback" data-field="staged-feedback" maxlength="2000" rows="4" placeholder="例如：上一輪多數人選擇 A，原因是⋯⋯下一輪我們追問⋯⋯" class="field-input w-full" :class="{ 'field-input-error': fieldErrors.feedback }" />
        <p v-if="fieldErrors.feedback" class="mt-2 text-xs font-bold text-[#a63222]">{{ fieldErrors.feedback }}</p>
      </label>

      <div v-if="!isFinal" class="border-t border-[#f0e6d2] pt-5">
        <p class="mb-3 text-sm font-black">第 {{ nextRoundNumber }} 回合題目</p>
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

      <p v-if="formError" class="rounded-xl border-l-4 border-[#d84a36] bg-[#fbe9e5] p-3 text-xs font-bold text-[#a63222]">{{ formError }}</p>

      <UiButton variant="quick" block :disabled="submitting" @click="submit">
        {{ submitting ? '發布中…' : isFinal ? '發布最終回饋並結算' : '發布回饋與下一回合' }}
      </UiButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Topic } from '~/types/topic';
import { errorMessage } from '~/composables/useApi';
import { createScratchCardDraft, questionPayload, seedRows, type BuilderRow, type BuilderType } from '~/utils/questionBuilder';

const props = defineProps<{ topicId: string; topic: Topic }>();
const emit = defineEmits<{ refreshed: [] }>();

const api = useApi();
const { success: toastSuccess, error: toastError } = useToast();

const feedback = ref('');
const builderType = ref<BuilderType>('OPTION');
const rows = ref<BuilderRow[]>(seedRows('OPTION'));
const prompt = ref('');
const roundTitle = ref('');
const scaleMinLabel = ref('');
const scaleMaxLabel = ref('');
const points = ref(5);
const maxSelections = ref(1);
const scratchCard = ref(createScratchCardDraft());
const submitting = ref(false);
const formError = ref('');
const fieldErrors = reactive<Record<string, string>>({});
const builderRef = ref<{ validate: () => { firstField: string | null; formError: string } } | null>(null);

const totalRounds = computed(() => props.topic.totalRounds ?? props.topic.rounds?.length ?? 0);
const currentRound = computed(() => props.topic.currentRound ?? props.topic.rounds?.length ?? 0);
const nextRoundNumber = computed(() => currentRound.value + 1);
const isFinal = computed(() => totalRounds.value > 0 && currentRound.value >= totalRounds.value);

function validateForm() {
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key];
  formError.value = '';
  let valid = true;
  let builderFirstField: string | null = null;
  if (feedback.value.length < 1 || feedback.value.length > 2000) {
    fieldErrors.feedback = '回饋需為 1～2000 字';
    valid = false;
  }
  if (!isFinal.value) {
    const builderResult = builderRef.value?.validate() ?? { firstField: null, formError: '' };
    if (builderResult.firstField) {
      builderFirstField = builderResult.firstField;
      valid = false;
    }
    if (builderResult.formError) {
      formError.value = builderResult.formError;
      valid = false;
    }
  }
  return valid ? null : Object.keys(fieldErrors)[0] || builderFirstField;
}

async function submit() {
  formError.value = '';
  const firstInvalidField = validateForm();
  if (firstInvalidField || formError.value) {
    await nextTick();
    if (firstInvalidField) document.querySelector<HTMLElement>(`[data-field="${firstInvalidField}"]`)?.focus();
    return;
  }
  submitting.value = true;
  try {
    if (isFinal.value) {
      await api.post(`/topics/${props.topicId}/finish`, { feedback: feedback.value });
      toastSuccess('已發布最終回饋並結算');
    } else {
      await api.post(`/topics/${props.topicId}/rounds`, {
        feedback: feedback.value,
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
      });
      toastSuccess(`第 ${nextRoundNumber.value} 輪已發布`);
    }
    feedback.value = '';
    emit('refreshed');
  } catch (error) {
    const message = errorMessage(error);
    formError.value = message;
    toastError(message);
  } finally {
    submitting.value = false;
  }
}
</script>

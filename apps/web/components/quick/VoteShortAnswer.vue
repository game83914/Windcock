<template>
  <div>
    <template v-if="!showResults && isVotingOpen">
      <label for="short-answer" class="block text-sm font-bold text-[#6d6861]">你的回答（公開顯示並統計）</label>
      <textarea id="short-answer" v-model="shortAnswerText" maxlength="500" rows="4" :disabled="isInteractionLocked" placeholder="說說你的看法…" class="mt-3 block w-full resize-y rounded-xl border border-[#ded7cb] bg-white p-4 text-sm focus:border-[#3157d5] focus:outline-none" :class="{ 'cursor-not-allowed opacity-60': isInteractionLocked }" />
      <div class="mt-1 text-right text-xs tabular-nums text-[#8b857d]">{{ shortAnswerText.length }} / 500</div>
      <UiButton v-if="!isInteractionLocked" variant="data" block class="mt-4" :disabled="voting || !shortAnswerText.trim()" @click="submitShortAnswer">
        {{ voting ? '送出中…' : '送出回答' }}
      </UiButton>
    </template>

    <template v-else-if="isVotingOpen && showResults">
      <div v-if="!hideStats" class="max-h-72 space-y-2.5 overflow-y-auto pr-1">
        <ul v-if="topic.responses?.length" class="space-y-2.5">
          <li v-for="(response, index) in topic.responses" :key="index" class="rounded-xl border border-[#ded7cb] bg-white p-4">
            <p class="whitespace-pre-wrap text-sm leading-6">{{ response.answerText }}</p>
            <p class="mt-2 text-xs text-[#8b857d]">{{ response.nickname }} · {{ formatDateTime(response.createdAt) }}</p>
          </li>
        </ul>
        <p v-else class="text-sm text-[#8b857d]">還沒有公開回答，成為第一個作答的人。</p>
      </div>
      <div v-if="!isSubQuestion" class="mt-4 rounded-xl bg-[#fffaf0] p-4">
        <span class="mb-2 block text-sm font-bold text-[#6d6861]">你的回答</span>
        <p class="whitespace-pre-wrap rounded-xl border border-[#ded7cb] bg-white p-4 text-sm leading-6">{{ shortAnswerText || '—' }}</p>
        <UiButton variant="outline" block class="mt-3" :disabled="voting" @click="withdrawShortAnswer">{{ voting ? '重置中…' : '重置' }}</UiButton>
      </div>
    </template>

    <template v-else>
      <p v-if="!hideStats" class="mb-3 text-sm font-bold text-[#6d6861]">共 {{ topic.responses?.length ?? 0 }} 則回答，以下公開顯示：</p>
      <div v-if="!hideStats" class="max-h-80 space-y-2.5 overflow-y-auto pr-1">
        <ul v-if="topic.responses?.length" class="space-y-2.5">
          <li v-for="(response, index) in topic.responses" :key="index" class="rounded-xl border border-[#ded7cb] bg-white p-4">
            <p class="whitespace-pre-wrap text-sm leading-6">{{ response.answerText }}</p>
            <p class="mt-2 text-xs text-[#8b857d]">{{ response.nickname }} · {{ formatDateTime(response.createdAt) }}</p>
          </li>
        </ul>
        <p v-else class="text-sm text-[#8b857d]">還沒有公開回答。</p>
      </div>
      <p v-else class="rounded-xl border border-[#e0c9a0] bg-[#fffaf0] p-4 text-sm font-bold text-[#8f5d14]">已截止，點進詳情頁查看回答。</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Topic } from '~/types/topic';
import { formatDateTime } from '~/utils/format';

const props = withDefaults(defineProps<{ topic: Topic; hideStats?: boolean }>(), { hideStats: false });
const emit = defineEmits<{ refreshed: [] }>();

const api = useApi();
const auth = useAuthStore();
const { error: toastError } = useToast();

const { isVotingOpen, showResults } = useVotingGate(() => props.topic);
const isInteractionLocked = computed(() => !auth.isAuthed);
const isSubQuestion = computed(() => props.topic.parentTopicId != null);
function emitRefreshed() { emit('refreshed'); }

const voting = ref(false);
const shortAnswerText = ref('');

// 送出後保留輸入匡與內容：以我的回答回填（已有手動輸入時不覆蓋）
watch(() => props.topic.myVote?.answerText, (value) => {
  if (value != null && !shortAnswerText.value) shortAnswerText.value = value;
}, { immediate: true });

async function submitShortAnswer() {
  const text = shortAnswerText.value.trim();
  if (voting.value || !text) return;
  voting.value = true;
  try {
    const res = await api.post<{ newBalance: string }>(`/topics/${props.topic.id}/vote`, { answerText: text });
    auth.updatePoints(res.newBalance);
    emitRefreshed();
  } catch (e) {
    toastError(errorMessage(e));
  } finally {
    voting.value = false;
  }
}

async function withdrawShortAnswer() {
  if (voting.value) return;
  voting.value = true;
  try {
    const res = await api.delete<{ success: boolean; newBalance: string }>(`/topics/${props.topic.id}/vote`);
    if (res.newBalance != null) auth.updatePoints(res.newBalance);
    shortAnswerText.value = '';
    emitRefreshed();
  } catch (e) {
    toastError(errorMessage(e));
  } finally {
    voting.value = false;
  }
}
</script>

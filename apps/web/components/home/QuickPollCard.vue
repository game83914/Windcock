<template>
  <article class="flex h-full flex-col rounded-2xl border border-[#e0c9a0] bg-white p-4 shadow-[0_6px_20px_rgba(23,23,23,0.06)] transition hover:-translate-y-0.5 hover:border-[#b0761f] hover:shadow-[0_12px_28px_rgba(23,23,23,0.10)]">
    <div class="flex items-center justify-between gap-2">
      <span class="inline-flex items-center gap-1 rounded-full bg-[#fff0d7] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-[#8f5d14]">快問</span>
      <span class="text-xs font-bold text-[#77716a]">{{ deadlineLabel(poll.voteEndAt, deadlineNow) }}</span>
    </div>

    <NuxtLink :to="`/topic/${poll.id}`" class="focus-ring mt-3 text-[15px] font-black leading-snug text-[#171717] transition hover:text-[#b0761f]">
      {{ poll.title }}
    </NuxtLink>

    <div v-if="isOpen && !auth.isAuthed" class="mt-4">
      <div class="space-y-2">
        <button
          v-for="o in poll.options"
          :key="o.id"
          type="button"
          class="focus-ring flex w-full items-center justify-between rounded-lg border border-[#e0c9a0] bg-[#fffaf0] px-3 py-2.5 text-sm font-bold text-[#6b5323] transition hover:border-[#b0761f]"
          @click="showLoginHint = true"
        >
          <span>{{ o.label }}</span>
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <div v-if="showLoginHint" class="mt-3 rounded-xl border border-[#b7c6ee] bg-[#e7ecff] p-3">
        <p class="text-xs font-bold text-[#2746b4]">登入後即可一鍵投票，還能獲得點數。</p>
        <UiButton :to="`/login?redirect=${encodeURIComponent('/')}`" variant="data" size="sm" class="mt-2">門號登入投票</UiButton>
      </div>
    </div>

    <div v-else-if="isOpen && !auth.canVote" class="mt-4 rounded-xl border border-[#e6cf9e] bg-[#fff8ec] px-3 py-2 text-xs font-bold text-[#8f5d14]">此身份僅供查閱，不能投票。</div>

    <div v-else class="mt-4 space-y-2">
      <button
        v-for="o in poll.options"
        :key="o.id"
        type="button"
        class="focus-ring block w-full overflow-hidden rounded-lg border text-left transition disabled:cursor-not-allowed"
        :class="isOpen && myVoteOptionId === o.id ? 'border-[#b0761f] bg-[#fff8ec]' : 'border-[#e0c9a0] bg-white hover:border-[#b0761f]'"
        :disabled="voting || !isOpen"
        @click="onTap(o)"
      >
        <span class="flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-bold" :class="myVoteOptionId === o.id ? 'text-[#8f5d14]' : 'text-[#171717]'">
          <span class="flex items-center gap-2"><span v-if="myVoteOptionId === o.id" aria-hidden="true">✓</span>{{ o.label }}</span>
          <span class="flex items-center gap-2 text-xs tabular-nums">
            <span v-if="voting && votingTargetId === o.id" class="size-3.5 animate-spin rounded-full border-2 border-[#b0761f] border-t-transparent" aria-hidden="true" />
            <template v-else>
              <span class="text-[#8f5d14]">{{ optionPercentage(o, poll) }}%</span>
              <span v-if="poll.hasVoted" class="text-[#77716a]">· {{ formatCompactNumber(o.voteCount) }} 票</span>
            </template>
          </span>
        </span>
        <span v-if="poll.hasVoted" class="block h-1 bg-[#f0e6d2]"><span class="block h-full bg-[#b0761f] transition-[width] duration-500" :style="{ width: `${optionPercentage(o, poll)}%` }" /></span>
      </button>
    </div>

    <div class="mt-auto flex items-center justify-between gap-2 border-t border-[#f0e6d2] pt-3 text-xs text-[#77716a]">
      <span>{{ formatCompactNumber(poll.totalVotes) }} 人已投</span>
      <NuxtLink :to="`/topic/${poll.id}`" class="focus-ring font-bold text-[#b0761f] hover:underline">詳細結果 ↗</NuxtLink>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Topic, TopicOption } from '~/types/topic';
import { deadlineLabel, formatCompactNumber, optionPercentage } from '~/utils/topic';

const props = defineProps<{ topic: Topic }>();

const api = useApi();
const auth = useAuthStore();
const { success: toastSuccess, error: toastError } = useToast();
const deadlineNow = useState<number>('topic-deadline-now', () => Date.now());

const poll = ref<Topic>(props.topic);
const voting = ref(false);
const votingTargetId = ref<string | null>(null);
const showLoginHint = ref(false);

const isOpen = computed(() => poll.value.status === 'OPEN' && !!poll.value.voteEndAt && new Date(poll.value.voteEndAt).getTime() > Date.now());
const myVoteOptionId = computed(() => poll.value.options.find((option) => option.label === poll.value.myVote?.choice)?.id ?? null);

watch(() => props.topic, (topic) => { poll.value = topic; });

async function onTap(option: TopicOption) {
  if (voting.value || !isOpen.value || option.id === myVoteOptionId.value) return;
  if (poll.value.hasVoted) await changeVote(option);
  else await submitVote(option);
}

async function submitVote(option: TopicOption) {
  voting.value = true;
  votingTargetId.value = option.id;
  try {
    const res = await api.post<{ newBalance: string }>(`/topics/${poll.value.id}/vote`, { optionId: option.id });
    auth.updatePoints(res.newBalance);
    votingTargetId.value = null;
    toastSuccess('已投票，快問結果即時更新');
    poll.value = await api.get<Topic>(`/topics/${poll.value.id}`);
  } catch (e) {
    votingTargetId.value = null;
    toastError(errorMessage(e));
  } finally {
    voting.value = false;
  }
}

async function changeVote(option: TopicOption) {
  voting.value = true;
  votingTargetId.value = option.id;
  try {
    const res = await api.patch<{ newBalance: string }>(`/topics/${poll.value.id}/vote`, { optionId: option.id });
    auth.updatePoints(res.newBalance);
    votingTargetId.value = null;
    toastSuccess(`已更改為「${option.label}」`);
    poll.value = await api.get<Topic>(`/topics/${poll.value.id}`);
  } catch (e) {
    votingTargetId.value = null;
    toastError(errorMessage(e));
  } finally {
    voting.value = false;
  }
}
</script>
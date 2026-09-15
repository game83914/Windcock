<template>
  <article role="link" tabindex="0" class="group flex h-full cursor-pointer flex-col rounded-2xl border border-[#e0c9a0] bg-white p-4 shadow-[0_6px_20px_rgba(23,23,23,0.06)] transition hover:-translate-y-0.5 hover:border-[#b0761f] hover:shadow-[0_12px_28px_rgba(23,23,23,0.10)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b0761f]" @click="goTopic" @keydown.enter="goTopic">
    <div class="flex items-center justify-between gap-2">
      <span class="inline-flex items-center gap-1 rounded-full bg-[#fff0d7] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-[#8f5d14]">快問</span>
      <span class="text-xs font-bold text-[#77716a]">{{ deadlineLabel(poll.voteEndAt, deadlineNow) }}</span>
    </div>

    <NuxtLink :to="`/topic/${poll.id}`" class="focus-ring mt-3 text-[15px] font-black leading-snug text-[#171717] transition hover:text-[#b0761f]" @click.stop>
      {{ poll.title }}
    </NuxtLink>

    <div v-if="isOptionPick && isOpen && !auth.isAuthed" class="mt-4">
      <div class="space-y-2">
        <button
          v-for="o in visibleOptions"
          :key="o.id"
          type="button"
          class="focus-ring flex w-full items-center justify-between rounded-lg border border-[#e0c9a0] bg-[#fffaf0] px-3 py-2.5 text-sm font-bold text-[#6b5323] transition hover:border-[#b0761f]"
          @click.stop="goLogin"
        >
          <span class="flex items-center gap-2"><img v-if="o.data?.imageUrl" :src="o.data.imageUrl" alt="選項圖片" class="h-5 w-5 shrink-0 rounded border border-[#ded7cb] object-cover" />{{ o.label }}</span>
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <button v-if="optionsCollapsed" type="button" class="focus-ring mt-2 w-full rounded-lg border border-dashed border-[#e0c9a0] px-3 py-2 text-xs font-bold text-[#8f5d14] hover:border-[#b0761f]" @click.stop="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${poll.options.length}）` }}</button>
    </div>

    <div v-else-if="isOptionPick && isOpen && auth.isAuthed && !auth.canVote" class="mt-4 rounded-xl border border-[#e6cf9e] bg-[#fff8ec] px-3 py-2 text-xs font-bold text-[#8f5d14]">{{ VOTE_IDENTITY_NOTICE }}</div>

    <div v-else-if="isOptionPick && isOpen" class="mt-4 space-y-2">
      <button
        v-for="o in visibleOptions"
        :key="o.id"
        type="button"
        class="focus-ring block w-full overflow-hidden rounded-lg border text-left transition disabled:cursor-not-allowed"
        :class="myVoteOptionId === o.id ? 'border-[#b0761f] bg-[#fff8ec]' : 'border-[#e0c9a0] bg-white hover:border-[#b0761f]'"
        :disabled="voting"
        @click.stop="onTap(o)"
      >
        <span class="flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-bold" :class="myVoteOptionId === o.id ? 'text-[#8f5d14]' : 'text-[#171717]'">
          <span class="flex items-center gap-2"><img v-if="o.data?.imageUrl" :src="o.data.imageUrl" alt="選項圖片" class="h-5 w-5 shrink-0 rounded border border-[#ded7cb] object-cover" /><span v-if="myVoteOptionId === o.id" aria-hidden="true">✓</span>{{ o.label }}</span>
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
      <button v-if="optionsCollapsed" type="button" class="focus-ring w-full rounded-lg border border-dashed border-[#e0c9a0] px-3 py-2 text-xs font-bold text-[#8f5d14] transition hover:border-[#b0761f]" @click.stop="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${poll.options.length}）` }}</button>
    </div>

    <div v-else-if="isOptionPick" class="mt-4 space-y-2">
      <button
        v-for="o in visibleOptions"
        :key="o.id"
        type="button"
        class="focus-ring block w-full overflow-hidden rounded-lg border border-[#e0c9a0] text-left"
        :class="myVoteOptionId === o.id ? 'bg-[#fff8ec]' : 'bg-white'"
        @click.stop="goTopic"
      >
        <span class="flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-bold" :class="myVoteOptionId === o.id ? 'text-[#8f5d14]' : 'text-[#171717]'">
          <span class="flex items-center gap-2"><img v-if="o.data?.imageUrl" :src="o.data.imageUrl" alt="選項圖片" class="h-5 w-5 shrink-0 rounded border border-[#ded7cb] object-cover" /><span v-if="myVoteOptionId === o.id" aria-hidden="true">✓</span>{{ o.label }}</span>
          <span class="shrink-0 text-xs font-black tabular-nums text-[#77716a]">{{ optionPercentage(o, poll) }}%</span>
        </span>
        <span class="block h-1 bg-[#f0e6d2]"><span class="block h-full bg-[#b0761f]" :style="{ width: `${optionPercentage(o, poll)}%` }" /></span>
      </button>
      <button v-if="optionsCollapsed" type="button" class="focus-ring w-full rounded-lg border border-dashed border-[#e0c9a0] px-3 py-2 text-xs font-bold text-[#8f5d14] transition hover:border-[#b0761f]" @click.stop="toggleOptions">{{ showAllOptions ? '收合選項' : `＋ 顯示全部（${poll.options.length}）` }}</button>
    </div>

    <div v-else class="mt-4">
      <button
        type="button"
        class="focus-ring flex w-full items-center justify-between rounded-xl border border-[#e0c9a0] bg-[#fffaf0] px-3 py-2.5 text-sm font-bold text-[#6b5323] transition hover:border-[#b0761f]"
        @click.stop="auth.isAuthed ? (expanded = !expanded) : goLogin()"
      >
        <span>{{ expanded ? '收合' : `${topicTypeLabel(poll.topicType)} — 進去玩一票` }}</span>
        <span aria-hidden="true">{{ expanded ? '收合' : '►' }}</span>
      </button>
      <div v-if="expanded" class="mt-3 rounded-xl border border-[#e0c9a0] bg-[#fffaf0] p-4" @click.stop>
        <QuickVotePanel :topic="poll" @refreshed="onRefreshed" />
      </div>
    </div>

    <div class="mt-auto border-t border-[#f0e6d2] pt-3 text-xs text-[#77716a]">
      <span>{{ formatCompactNumber(poll.totalVotes) }} 人已投</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Topic, TopicOption } from '~/types/topic';
import { deadlineLabel, formatCompactNumber, isOptionPickType, optionPercentage, topicTypeLabel } from '~/utils/topic';
import { OPTION_COLLAPSE_LIMIT, VOTE_IDENTITY_NOTICE } from '~/utils/topic';

const props = defineProps<{ topic: Topic }>();

const api = useApi();
const auth = useAuthStore();
const router = useRouter();
const { success: toastSuccess, error: toastError } = useToast();
const deadlineNow = useState<number>('topic-deadline-now', () => Date.now());

const poll = ref<Topic>(props.topic);
const voting = ref(false);
const votingTargetId = ref<string | null>(null);
const expanded = ref(false);
const showAllOptions = ref(false);

const isOpen = computed(() => poll.value.status === 'OPEN' && !!poll.value.voteEndAt && new Date(poll.value.voteEndAt).getTime() > Date.now());
const isOptionPick = computed(() => isOptionPickType(poll.value.topicType) && poll.value.topicType !== 'SHORT_ANSWER');
const myVoteOptionId = computed(() => poll.value.options.find((option) => option.label === poll.value.myVote?.choice)?.id ?? null);
const optionsCollapsed = computed(() => !showAllOptions.value && poll.value.options.length > OPTION_COLLAPSE_LIMIT);
const visibleOptions = computed(() => optionsCollapsed.value ? poll.value.options.slice(0, OPTION_COLLAPSE_LIMIT) : poll.value.options);

function toggleOptions() {
  showAllOptions.value = !showAllOptions.value;
}

watch(() => props.topic, (topic) => { poll.value = topic; });

function goTopic() {
  if (voting.value || expanded.value) return;
  router.push(`/topic/${poll.value.id}`);
}

function goLogin() {
  router.push('/login');
}

async function onTap(option: TopicOption) {
  if (voting.value || !isOpen.value || option.id === myVoteOptionId.value) return;
  if (poll.value.hasVoted) await changeVote(option);
  else await submitVote(option);
}

async function refreshPoll() {
  poll.value = await api.get<Topic>(`/topics/${poll.value.id}`);
}

async function onRefreshed() {
  await refreshPoll();
}

async function submitVote(option: TopicOption) {
  voting.value = true;
  votingTargetId.value = option.id;
  try {
    const res = await api.post<{ newBalance: string }>(`/topics/${poll.value.id}/vote`, { optionId: option.id });
    auth.updatePoints(res.newBalance);
    votingTargetId.value = null;
    toastSuccess('已投票，快問結果即時更新');
    await refreshPoll();
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
    await refreshPoll();
  } catch (e) {
    votingTargetId.value = null;
    toastError(errorMessage(e));
  } finally {
    voting.value = false;
  }
}
</script>
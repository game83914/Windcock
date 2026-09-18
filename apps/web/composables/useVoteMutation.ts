import type { Topic } from '~/types/topic';

interface VoteResponse {
  newBalance: string;
  rewardPoints: number;
}

interface WithdrawResponse {
  success: boolean;
  newBalance?: string;
}

function isConflict(e: unknown) {
  return (e as { data?: { statusCode?: number } })?.data?.statusCode === 409;
}

export function useVoteMutation(topic: MaybeRefOrGetter<Topic>, onRefreshed: () => void) {
  const api = useApi();
  const auth = useAuthStore();
  const { error: toastError } = useToast();

  const voting = ref(false);
  const votingTargetId = ref<string | null>(null);

  const myVoteOptionId = computed(() => toValue(topic).myVote?.optionId ?? null);

  async function submitQuickVote(optionId: string) {
    const current = toValue(topic);
    if (voting.value || !auth.isAuthed || optionId === myVoteOptionId.value) return;
    voting.value = true;
    votingTargetId.value = optionId;
    try {
      const res = await api.post<VoteResponse>(`/topics/${current.id}/vote`, { optionId });
      auth.updatePoints(res.newBalance);
      votingTargetId.value = null;
      onRefreshed();
    } catch (e) {
      votingTargetId.value = null;
      if (isConflict(e)) {
        voting.value = false;
        await changeQuickVote(optionId);
        return;
      }
      toastError(errorMessage(e));
    } finally {
      voting.value = false;
    }
  }

  async function changeQuickVote(optionId: string) {
    const current = toValue(topic);
    if (voting.value || optionId === myVoteOptionId.value) return;
    voting.value = true;
    votingTargetId.value = optionId;
    try {
      const res = await api.patch<VoteResponse>(`/topics/${current.id}/vote`, { optionId });
      auth.updatePoints(res.newBalance);
      votingTargetId.value = null;
      onRefreshed();
    } catch (e) {
      votingTargetId.value = null;
      toastError(errorMessage(e));
    } finally {
      voting.value = false;
    }
  }

  async function submitMultiSelectVote(optionIds: string[]) {
    const current = toValue(topic);
    if (voting.value || !auth.isAuthed) return;
    voting.value = true;
    const hasVoted = current.hasVoted;
    try {
      const request = hasVoted ? api.patch.bind(api) : api.post.bind(api);
      const res = await request<VoteResponse>(`/topics/${current.id}/vote`, { optionIds });
      auth.updatePoints(res.newBalance);
      onRefreshed();
    } catch (e) {
      if (!hasVoted && isConflict(e)) {
        try {
          const res = await api.patch<VoteResponse>(`/topics/${current.id}/vote`, { optionIds });
          auth.updatePoints(res.newBalance);
          onRefreshed();
        } catch (e2) {
          toastError(errorMessage(e2));
        }
      } else {
        toastError(errorMessage(e));
      }
    } finally {
      voting.value = false;
    }
  }

  async function withdrawVote() {
    const current = toValue(topic);
    if (voting.value || !auth.isAuthed) return false;
    voting.value = true;
    try {
      const res = await api.delete<WithdrawResponse>(`/topics/${current.id}/vote`);
      if (res.newBalance != null) auth.updatePoints(res.newBalance);
      onRefreshed();
      return true;
    } catch (e) {
      toastError(errorMessage(e));
      return false;
    } finally {
      voting.value = false;
    }
  }

  async function withdrawRank() {
    const current = toValue(topic);
    if (voting.value || !auth.isAuthed) return false;
    voting.value = true;
    try {
      const res = await api.delete<WithdrawResponse>(`/topics/${current.id}/rank`);
      if (res.newBalance != null) auth.updatePoints(res.newBalance);
      onRefreshed();
      return true;
    } catch (e) {
      toastError(errorMessage(e));
      return false;
    } finally {
      voting.value = false;
    }
  }

  return { voting, votingTargetId, submitQuickVote, changeQuickVote, submitMultiSelectVote, withdrawVote, withdrawRank };
}

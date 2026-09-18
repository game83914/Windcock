import type { Topic } from '~/types/topic';

export function useVotingGate(topic: MaybeRefOrGetter<Topic | null | undefined>) {
  const auth = useAuthStore();

  const isVotingOpen = computed(() => {
    const current = toValue(topic);
    return current?.status === 'OPEN' && !!current?.voteEndAt && new Date(current.voteEndAt).getTime() > Date.now();
  });

  const participationReady = computed(() => !auth.isAuthed || Boolean(auth.capabilitySummary?.participation));

  const showResults = computed(() => {
    const current = toValue(topic);
    return !!current && (current.hasVoted || !isVotingOpen.value || (auth.isAuthed && participationReady.value && !auth.canVote));
  });

  const isLocked = computed(() => toValue(topic)?.status === 'LOCKED');

  return { isVotingOpen, participationReady, showResults, isLocked };
}

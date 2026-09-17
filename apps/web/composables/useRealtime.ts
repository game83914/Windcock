import { io, type Socket } from 'socket.io-client';

interface VoteUpdate {
  topicId: string;
  totalVotes: string;
  options: { optionId: string; voteCount: string }[];
  at?: string;
}

export interface CommentActivity {
  id: string;
  topicId: string;
  topicTitle: string;
  author: string;
  content: string;
  createdAt: string;
}

export function useRealtime() {
  const config = useRuntimeConfig();
  const auth = useAuthStore();
  const rawWsBase = config.public.wsBase as string;
  const wsBase = import.meta.client && rawWsBase.includes('localhost')
    ? rawWsBase.replace('//localhost:', `//${window.location.hostname}:`)
    : rawWsBase;
  const socket: Socket | null = import.meta.client
    ? io(wsBase, { auth: { token: auth.token } })
    : null;

  function joinTopic(topicId: string) {
    socket?.emit('topic:join', { topicId });
  }

  function leaveTopic(topicId: string) {
    socket?.emit('topic:leave', { topicId });
  }

  function onVoteUpdate(cb: (update: VoteUpdate) => void) {
    socket?.on('vote:update', cb);
  }

  function onCommentActivity(cb: (activity: CommentActivity) => void) {
    socket?.on('comment:activity', cb);
  }

  function cleanup() {
    socket?.disconnect();
  }

  return { joinTopic, leaveTopic, onVoteUpdate, onCommentActivity, cleanup, socket };
}

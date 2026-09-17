import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

export interface OptionVoteCount {
  optionId: string;
  voteCount: string;
}

export interface CommentActivity {
  id: string;
  topicId: string;
  topicTitle: string;
  author: string;
  content: string;
  createdAt: string;
}

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  async broadcastTopicVotes(topicId: bigint, options: OptionVoteCount[], authoritativeTotal?: bigint) {
    const totalVotes = authoritativeTotal ?? options.reduce((sum, o) => sum + BigInt(o.voteCount), BigInt(0));
    this.gateway.server
      .to(`topic:${topicId}`)
      .emit('vote:update', {
        topicId: topicId.toString(),
        totalVotes: totalVotes.toString(),
        options,
        at: new Date().toISOString(),
      });
  }

  async broadcastTopicCounters(topicId: bigint, counters: { totalVotes: bigint; voterCount: bigint }) {
    this.gateway.server.to(`topic:${topicId}`).emit('vote:snapshot', {
      topicId: topicId.toString(),
      ...counters,
      at: new Date().toISOString(),
    });
  }

  broadcastCommentActivity(activity: CommentActivity) {
    this.gateway.server.emit('comment:activity', activity);
  }

  evictTopic(topicId: bigint, exceptUserId?: bigint) {
    return this.gateway.evictTopic(topicId, exceptUserId);
  }

  evictUserFromTopics(userId: bigint, topicIds: bigint[]) {
    return this.gateway.evictUserFromTopics(userId, topicIds);
  }
}

export interface TopicOption {
  id: string;
  label: string;
  voteCount: string;
  data?: { match?: string; weight?: number; imageUrl?: string } | null;
}

export type QuickTopicType = 'BINARY' | 'MULTIPLE' | 'IMAGE_MULTIPLE' | 'SPECTRUM' | 'SHORT_ANSWER' | 'MATCHING' | 'PUZZLE' | 'SCRATCH' | 'SPIN_WHEEL' | 'LOTTERY';

export interface TopicShortAnswer {
  id: string;
  nickname: string;
  avatarUrl?: string | null;
  answerText: string;
  createdAt: string;
}

export type TopicContentBlockType = 'BACKGROUND' | 'CASE' | 'DATA' | 'SOURCE' | 'PERSPECTIVES';

export interface TopicContentBlock {
  id: string;
  type: TopicContentBlockType;
  title: string;
  content: string;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  occurredAt?: string | null;
}

export interface Topic {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  kind?: 'FORMAL' | 'QUICK';
  featuredOrder?: number | null;
  topicType: QuickTopicType;
  status: string;
  moderationStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  moderationNote?: string | null;
  creator: {
    nickname: string;
    avatarUrl?: string | null;
    type: 'MEMBER' | 'OFFICIAL';
  };
  proposedBy: Array<{ type: 'MEMBER' | 'ORGANIZATION'; label: string }>;
  createdAt: string;
  updatedAt?: string;
  voteEndAt?: string | null;
  voteDurationDays: number;
  voteDurationHours?: number | null;
  minVotes?: number | null;
  totalVotes: string;
  voterCount: string;
  spectrumMedian?: string | null;
  spectrumStddev?: string | null;
  hasVoted: boolean;
  myVote?: { choice: string; spectrumValue: number | null } | null;
  responses?: TopicShortAnswer[];
  blocks: TopicContentBlock[];
  options: TopicOption[];
}

export interface Category {
  key: string;
  label: string;
  eyebrow: string;
  color: string;
  soft: string;
  sortOrder: number;
  isActive: boolean;
}

export interface UserNotification {
  id: string;
  type: 'TOPIC_REVISION_APPROVED';
  title: string;
  message: string;
  topicId?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface TopicListResponse {
  items: Topic[];
  categoryCounts: Record<string, number>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface TopicImportStance {
  title: string;
  rationale?: string;
  children?: TopicImportStance[];
}

export interface TopicImportPayload {
  title: string;
  description?: string;
  category: string;
  topicType: 'BINARY' | 'MULTIPLE' | 'SPECTRUM';
  options?: string[];
  voteDurationDays: 3 | 7 | 14 | 30;
  blocks?: Array<{
    type: TopicContentBlockType;
    title: string;
    content: string;
    sourceLabel?: string;
    sourceUrl?: string;
    occurredAt?: string;
  }>;
  stances?: TopicImportStance[];
}

export type StanceSignal = 'AGREE' | 'DISAGREE';

export interface StanceCamp {
  optionId: string;
  label: string;
  count: number;
  style?: string;
}

export interface StanceNode {
  id: string;
  parentId: string | null;
  title: string;
  rationale: string | null;
  depth: number;
  status: 'ACTIVE' | 'TAKEN_DOWN';
  creator: { nickname: string; avatarUrl: string | null };
  proposedBy: Array<{ type: 'MEMBER'; label: string }>;
  agreed: number;
  disagreed: number;
  discussionCount: number;
  mySignals: StanceSignal[];
  camps: StanceCamp[] | null;
  unvotedAgree: number;
  commonGround: boolean;
  createdAt: string;
  children: StanceNode[];
}

export interface StanceTreeResponse {
  topicId: string;
  topicType: 'BINARY' | 'MULTIPLE' | 'SPECTRUM';
  maxDepth: number;
  camps: StanceCamp[] | null;
  commonGroundCount: number;
  count: number;
  roots: StanceNode[];
}

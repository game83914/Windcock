export interface MemberDashboard {
  member: {
    nickname: string;
    avatarUrl: string | null;
    maskedPhone: string | null;
    points: string;
    role: 'USER' | 'ADMIN';
    isPhoneVerified: boolean;
    createdAt: string;
  };
  counts: {
    votes: number;
    topics: number;
    pendingTopics: number;
    unreadNotifications: number;
    collectedMemes: number;
    createdMemes: number;
    pendingMemes: number;
  };
  profile: {
    status: 'NOT_STARTED' | 'PENDING_GUARDIAN' | 'ACTIVE' | 'INACTIVE';
    completionPercent: number;
  };
  recentVotes: MemberVoteSummary[];
  recentTopics: Array<{
    id: string;
    title: string;
    status: string;
    moderationStatus: string;
    updatedAt: string;
  }>;
}

export interface MemberVoteSummary {
  id: string;
  topicId: string;
  topicTitle: string;
  topicStatus: string;
  selection?: string | null;
  votedAt: string;
}

export interface MemberVote extends MemberVoteSummary {
  category: string;
  moderationStatus: string;
  spectrumValue?: number | null;
  rewardPoints: string;
}

export interface MemberVotesResponse {
  items: MemberVote[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface ChannelProfile {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  channelBio: string | null;
  followerCount: number;
  followingCount: number;
  isFollowing?: boolean;
  isSelf?: boolean;
}

export interface ChannelConnection {
  user: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
  createdAt: string;
}

export interface ChannelConnectionsResponse {
  items: ChannelConnection[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

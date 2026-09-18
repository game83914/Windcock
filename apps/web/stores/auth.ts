import { defineStore } from 'pinia';

export type UserRole = 'USER' | 'ADMIN';
export type MembershipTier = 'NEW' | 'SENIOR';

export interface CapabilitySummary {
  membershipTier: MembershipTier;
  seniorEligibility: { eligible: boolean; accountAgeDays: number; distinctTopicsVoted: number; requiredAccountAgeDays: number; requiredDistinctTopicsVoted: number };
  capabilities: string[];
  assignments: Array<{ role: string; scope: 'GLOBAL' | 'ORGANIZATION' | 'TOPIC'; organizationId: string | null; topicId: string | null; expiresAt: string | null }>;
  partnerOrganizations: Array<{ id: string; name: string; role: string }>;
  participation: {
    mode: 'ADMIN' | 'STAFF' | 'PARTNER' | 'MEMBER';
    canVote: boolean;
    canSignal: boolean;
    canDiscuss: boolean;
    canReport: boolean;
    canSubmitTopicApplication: boolean;
    canSubmitStanceApplication: boolean;
  };
  canViewAnalytics: boolean;
}

export interface SessionUser {
  id: string;
  nickname: string;
  email: string;
  avatarUrl: string | null;
  points: string;
  role: UserRole;
  status: string;
  isPhoneVerified: boolean;
}

interface AuthState {
  token: string | null;
  id: string | null;
  nickname: string | null;
  email: string | null;
  avatarUrl: string | null;
  points: string | null;
  role: UserRole | null;
  status: string | null;
  isPhoneVerified: boolean;
  restored: boolean;
  capabilitySummary: CapabilitySummary | null;
  assumptionProfile: { key: string; label: string } | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: null,
    id: null,
    nickname: null,
    email: null,
    avatarUrl: null,
    points: null,
    role: null,
    status: null,
    isPhoneVerified: false,
    restored: false,
    capabilitySummary: null,
    assumptionProfile: null,
  }),
  getters: {
    isAuthed: (state) => !!state.token,
    canModerate: (state) => state.capabilitySummary?.capabilities.includes('ADMIN') ?? state.role === 'ADMIN',
    canAuthorTopics: (state) => state.capabilitySummary?.capabilities.includes('FORMAL_TOPIC_AUTHOR') ?? state.role === 'ADMIN',
    canSubmitTopicApplication: (state) => state.capabilitySummary?.participation?.canSubmitTopicApplication ?? false,
    canReadEditorialApplications: (state) => state.capabilitySummary?.capabilities.includes('TOPIC_APPLICATION_READ') ?? state.role === 'ADMIN',
    canEditEditorialApplications: (state) => state.capabilitySummary?.capabilities.includes('TOPIC_DRAFT') ?? state.role === 'ADMIN',
    canPublishEditorialApplications: (state) => state.capabilitySummary?.capabilities.includes('TOPIC_PUBLISH') ?? state.role === 'ADMIN',
    canVote: (state) => state.capabilitySummary?.participation?.canVote ?? state.role === 'ADMIN',
    canSignal: (state) => state.capabilitySummary?.participation?.canSignal ?? state.role === 'ADMIN',
    canDiscuss: (state) => state.capabilitySummary?.participation?.canDiscuss ?? state.role === 'ADMIN',
    canReport: (state) => state.capabilitySummary?.participation?.canReport ?? state.role === 'ADMIN',
    canViewAnalytics: (state) => state.capabilitySummary?.canViewAnalytics ?? state.role === 'ADMIN',
    canManageCategories: (state) => state.capabilitySummary?.capabilities.includes('CATEGORY_MANAGE') ?? state.role === 'ADMIN',
    canFeatureTopics: (state) => state.capabilitySummary?.capabilities.includes('TOPIC_FEATURE') ?? state.role === 'ADMIN',
  },
  actions: {
    restore() {
      if (!process.client || this.restored) return;
      this.token = localStorage.getItem('wc_token');
      this.id = localStorage.getItem('wc_id');
      this.nickname = localStorage.getItem('wc_nickname');
      this.email = localStorage.getItem('wc_email');
      this.avatarUrl = localStorage.getItem('wc_avatar_url');
      this.points = localStorage.getItem('wc_points');
      this.role = localStorage.getItem('wc_role') as UserRole | null;
      this.status = localStorage.getItem('wc_status');
      this.isPhoneVerified = localStorage.getItem('wc_verified') === 'true';
      const assumed = sessionStorage.getItem('wc_assumption');
      if (assumed) {
        try {
          const parsed = JSON.parse(assumed) as { token: string; user: SessionUser; profile: { key: string; label: string }; capabilities: CapabilitySummary };
          this.token = parsed.token;
          this.setUser(parsed.user, false);
          this.capabilitySummary = parsed.capabilities;
          this.assumptionProfile = parsed.profile;
        } catch {
          sessionStorage.removeItem('wc_assumption');
        }
      }
      this.restored = true;
    },
    setSession(token: string, user: SessionUser) {
      this.assumptionProfile = null;
      this.capabilitySummary = null;
      if (process.client) sessionStorage.removeItem('wc_assumption');
      this.token = token;
      this.setUser(user);
      if (process.client) localStorage.setItem('wc_token', token);
    },
    setUser(user: SessionUser, persist = true) {
      this.id = user.id;
      this.nickname = user.nickname;
      this.email = user.email;
      this.avatarUrl = user.avatarUrl;
      this.points = user.points;
      this.role = user.role;
      this.status = user.status;
      this.isPhoneVerified = user.isPhoneVerified;
      if (process.client && persist) {
        localStorage.setItem('wc_id', user.id);
        localStorage.setItem('wc_nickname', user.nickname);
        if (user.email) localStorage.setItem('wc_email', user.email);
        else localStorage.removeItem('wc_email');
        if (user.avatarUrl) localStorage.setItem('wc_avatar_url', user.avatarUrl);
        else localStorage.removeItem('wc_avatar_url');
        localStorage.setItem('wc_points', user.points);
        localStorage.setItem('wc_role', user.role);
        localStorage.setItem('wc_status', user.status);
        localStorage.setItem('wc_verified', String(user.isPhoneVerified));
      }
    },
    updatePoints(points: string) {
      this.points = points;
      if (process.client) localStorage.setItem('wc_points', points);
    },
    setCapabilities(summary: CapabilitySummary) {
      this.capabilitySummary = summary;
    },
    beginAssumption(token: string, user: SessionUser, profile: { key: string; label: string }, capabilities: CapabilitySummary) {
      this.token = token;
      this.setUser(user, false);
      this.capabilitySummary = capabilities;
      this.assumptionProfile = profile;
      if (process.client) sessionStorage.setItem('wc_assumption', JSON.stringify({ token, user, profile, capabilities }));
    },
    endAssumption() {
      if (!process.client) return;
      sessionStorage.removeItem('wc_assumption');
      this.$reset();
      this.restore();
    },
    clear() {
      this.$reset();
      this.restored = true;
      if (process.client) {
        sessionStorage.removeItem('wc_assumption');
        ['wc_token', 'wc_id', 'wc_nickname', 'wc_email', 'wc_avatar_url', 'wc_points', 'wc_role', 'wc_status', 'wc_verified']
          .forEach((key) => localStorage.removeItem(key));
      }
    },
  },
});

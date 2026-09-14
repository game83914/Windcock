export interface StanceApplication {
  id: string;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  title: string;
  rationale: string | null;
  note: string | null;
  reviewNote: string | null;
  topicId: string;
  parentStanceId: string | null;
  revisionNumber: number;
  createdAt: string;
  updatedAt: string;
  results: Array<{ stanceId: string; createdAt: string; stance: { id: string; title: string } }>;
  topic: { id: string; title: string };
  parentStance: { id: string; title: string } | null;
  submitter?: { id: string; nickname: string };
  reviewedAt?: string | null;
  target: {
    kind: 'TOPIC' | 'STANCE';
    topic: { id: string; title: string; status: string; voteEndAt: string | null };
    parent: { id: string; title: string; status: string; depth: number } | null;
    path: Array<{ id: string; title: string }>;
    canEdit: boolean;
    canResubmit: boolean;
    blockedReason: string | null;
  };
}

export interface StanceApplicationRevision {
  id: string;
  applicationId: string;
  revisionNumber: number;
  status: StanceApplication['status'];
  title: string;
  rationale: string | null;
  note: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

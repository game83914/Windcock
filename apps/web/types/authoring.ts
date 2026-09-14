export type AuthoringTarget = 'TOPIC' | 'STANCE';

export interface AuthoringQuestion {
  id: string;
  prompt: string;
  required: true;
  maxLength: number;
}

export interface TopicAuthoringForm {
  title: string;
  description: string;
  category: string;
  topicType: 'BINARY' | 'MULTIPLE' | 'SPECTRUM';
  options: string[];
  voteDurationDays: 3 | 7 | 14 | 30;
  blocks: Array<{ type: 'BACKGROUND' | 'CASE' | 'DATA' | 'PERSPECTIVES'; title: string; content: string }>;
}

export interface StanceAuthoringForm {
  title: string;
  rationale: string;
}

export interface AuthoringDraft<T = TopicAuthoringForm | StanceAuthoringForm> {
  id: string;
  label: string;
  form: T;
}

export interface AuthoringSessionResponse {
  sessionId: string;
  target: AuthoringTarget;
  questions: AuthoringQuestion[];
  expiresAt: string;
}

export interface AuthoringDraftsResponse {
  sessionId: string;
  target: AuthoringTarget;
  drafts: AuthoringDraft[];
}

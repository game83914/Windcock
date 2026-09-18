import {
  BUILDER_RULES,
  createScratchCardDraft,
  nextRowId,
  type BuilderRow,
  type BuilderType,
} from './questionBuilder';
import type { TopicAudience, TopicVisibility } from '~/types/topic';

export const DRAFT_PAYLOAD_VERSION = 1;

export interface QuickFormState {
  title: string;
  builderType: BuilderType;
  rows: BuilderRow[];
  prompt: string;
  points: number;
  scaleMinLabel: string;
  scaleMaxLabel: string;
  maxSelections: number;
  scratchCard: { coverImageUrl: string | null; revealMode: 'SHARED' | 'PER_RESULT'; sharedRevealImageUrl: string | null; showText: boolean };
  voteDurationHours: number;
  visibility: TopicVisibility;
  audience: TopicAudience;
}

export interface SurveyQuestionState {
  questionTitle: string;
  type: BuilderType;
  rows: BuilderRow[];
  prompt: string;
  points: number;
  scaleMinLabel: string;
  scaleMaxLabel: string;
  maxSelections: number;
  scratchCard: QuickFormState['scratchCard'];
}

export interface SurveyFormState {
  title: string;
  questions: SurveyQuestionState[];
  voteDurationHours: number;
  visibility: TopicVisibility;
  audience: TopicAudience;
}

const BUILDER_TYPES = Object.keys(BUILDER_RULES) as BuilderType[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function asInt(value: unknown, fallback: number): number {
  return Number.isInteger(value) ? (value as number) : fallback;
}

function asVisibility(value: unknown): TopicVisibility {
  return value === 'PRIVATE_LINK' ? 'PRIVATE_LINK' : 'PUBLIC';
}

function asAudience(value: unknown): TopicAudience {
  return value === 'FOLLOWERS_ONLY' ? 'FOLLOWERS_ONLY' : 'MEMBER_ONLY';
}

function applyRows(input: unknown): BuilderRow[] | null {
  if (!Array.isArray(input)) return null;
  const rows: BuilderRow[] = [];
  for (const item of input) {
    if (!isRecord(item)) return null;
    rows.push({
      id: nextRowId(),
      label: asString(item.label),
      match: asString(item.match),
      weight: asString(item.weight),
      image: asStringOrNull(item.image),
    });
  }
  return rows;
}

function applyScratchCard(input: unknown): QuickFormState['scratchCard'] {
  const fallback = createScratchCardDraft();
  if (!isRecord(input)) return fallback;
  return {
    coverImageUrl: asStringOrNull(input.coverImageUrl),
    revealMode: input.revealMode === 'PER_RESULT' ? 'PER_RESULT' : 'SHARED',
    sharedRevealImageUrl: asStringOrNull(input.sharedRevealImageUrl),
    showText: typeof input.showText === 'boolean' ? input.showText : true,
  };
}

function unwrapPayload(payload: unknown, form: 'quick' | 'survey'): Record<string, unknown> | null {
  if (!isRecord(payload)) return null;
  if (payload.version !== DRAFT_PAYLOAD_VERSION || payload.form !== form) return null;
  if (!isRecord(payload.data)) return null;
  return payload.data;
}

export function serializeQuickForm(state: QuickFormState): Record<string, unknown> {
  return {
    version: DRAFT_PAYLOAD_VERSION,
    form: 'quick',
    data: {
      title: state.title,
      builderType: state.builderType,
      rows: state.rows.map((row) => ({ label: row.label, match: row.match, weight: row.weight, image: row.image })),
      prompt: state.prompt,
      points: state.points,
      scaleMinLabel: state.scaleMinLabel,
      scaleMaxLabel: state.scaleMaxLabel,
      maxSelections: state.maxSelections,
      scratchCard: { ...state.scratchCard },
      voteDurationHours: state.voteDurationHours,
      visibility: state.visibility,
      audience: state.audience,
    },
  };
}

/** 還原快問草稿；結構不符回傳 null（由呼叫端提示）。圖片 URL 會保留。 */
export function applyQuickPayload(payload: unknown): QuickFormState | null {
  const data = unwrapPayload(payload, 'quick');
  if (!data || typeof data.builderType !== 'string' || !(BUILDER_TYPES as string[]).includes(data.builderType)) return null;
  const builderType = data.builderType as BuilderType;
  const rows = applyRows(data.rows);
  if (!rows || (BUILDER_RULES[builderType].needs !== 'NONE' && rows.length === 0)) return null;
  return {
    title: asString(data.title),
    builderType,
    rows,
    prompt: asString(data.prompt),
    points: asInt(data.points, 5),
    scaleMinLabel: asString(data.scaleMinLabel),
    scaleMaxLabel: asString(data.scaleMaxLabel),
    maxSelections: Math.max(1, asInt(data.maxSelections, 1)),
    scratchCard: applyScratchCard(data.scratchCard),
    voteDurationHours: asInt(data.voteDurationHours, 24),
    visibility: asVisibility(data.visibility),
    audience: asAudience(data.audience),
  };
}

export function serializeSurveyForm(state: SurveyFormState): Record<string, unknown> {
  return {
    version: DRAFT_PAYLOAD_VERSION,
    form: 'survey',
    data: {
      title: state.title,
      questions: state.questions.map((question) => ({
        questionTitle: question.questionTitle,
        type: question.type,
        rows: question.rows.map((row) => ({ label: row.label, match: row.match, weight: row.weight, image: row.image })),
        prompt: question.prompt,
        points: question.points,
        scaleMinLabel: question.scaleMinLabel,
        scaleMaxLabel: question.scaleMaxLabel,
        maxSelections: question.maxSelections,
        scratchCard: { ...question.scratchCard },
      })),
      voteDurationHours: state.voteDurationHours,
      visibility: state.visibility,
      audience: state.audience,
    },
  };
}

/** 還原問卷草稿；結構不符回傳 null。 */
export function applySurveyPayload(payload: unknown): SurveyFormState | null {
  const data = unwrapPayload(payload, 'survey');
  if (!data || !Array.isArray(data.questions) || data.questions.length === 0 || data.questions.length > 20) return null;
  const questions: SurveyQuestionState[] = [];
  for (const item of data.questions) {
    if (!isRecord(item) || typeof item.type !== 'string' || !(BUILDER_TYPES as string[]).includes(item.type)) return null;
    const type = item.type as BuilderType;
    const rows = applyRows(item.rows);
    if (!rows || (BUILDER_RULES[type].needs !== 'NONE' && rows.length === 0)) return null;
    questions.push({
      questionTitle: asString(item.questionTitle),
      type,
      rows,
      prompt: asString(item.prompt),
      points: asInt(item.points, 5),
      scaleMinLabel: asString(item.scaleMinLabel),
      scaleMaxLabel: asString(item.scaleMaxLabel),
      maxSelections: Math.max(1, asInt(item.maxSelections, 1)),
      scratchCard: applyScratchCard(item.scratchCard),
    });
  }
  return {
    title: asString(data.title),
    questions,
    voteDurationHours: asInt(data.voteDurationHours, 24),
    visibility: asVisibility(data.visibility),
    audience: asAudience(data.audience),
  };
}

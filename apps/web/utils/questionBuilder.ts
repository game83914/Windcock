import type { QuickTopicType } from '~/types/topic';

export type BuilderType =
  | 'OPTION'
  | 'IMAGE_OPTION'
  | 'IMAGE_RANK'
  | 'SPECTRUM'
  | 'SHORT_ANSWER'
  | 'MATCHING'
  | 'PUZZLE'
  | 'SCRATCH'
  | 'SPIN_WHEEL'
  | 'LOTTERY'
  | 'STAR_RATING'
  | 'LIKERT'
  | 'MULTI_SELECT';

export interface BuilderRow {
  id: string;
  label: string;
  match: string;
  weight: string;
  image: string | null;
}

export type ScratchRevealMode = 'SHARED' | 'PER_RESULT';

export interface ScratchCardDraft {
  coverImageUrl: string | null;
  revealMode: ScratchRevealMode;
  sharedRevealImageUrl: string | null;
  showText: boolean;
}

export interface QuestionDraft {
  type: BuilderType;
  rows: BuilderRow[];
  prompt: string;
  points?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  maxSelections?: number;
  scratchCard?: ScratchCardDraft;
}

export const LIKERT_POINTS_MIN = 3;
export const LIKERT_POINTS_MAX = 10;
export const LIKERT_POINTS_DEFAULT = 5;

export function normalizeLikertPoints(points?: number): number {
  const value = Number(points);
  if (Number.isInteger(value) && value >= LIKERT_POINTS_MIN && value <= LIKERT_POINTS_MAX) return value;
  return LIKERT_POINTS_DEFAULT;
}

export const BUILDER_RULES: Record<BuilderType, { label: string; description: string; min: number; max: number; needs: 'LIST' | 'MATCH' | 'WEIGHT' | 'NONE' }> = {
  OPTION: { label: '單選題', description: '二選一或 2~10 個選項，每人選一項', min: 2, max: 10, needs: 'LIST' },
  IMAGE_OPTION: { label: '圖片選項題', description: '上傳圖片為選項，點圖即投', min: 2, max: 10, needs: 'LIST' },
  IMAGE_RANK: { label: '二選一排名賽', description: '4~50 張圖片，逐對二選一排出完整名次', min: 4, max: 50, needs: 'LIST' },
  SPECTRUM: { label: '光譜題', description: '0~100 滑桿測立場，即時看風向', min: 0, max: 0, needs: 'NONE' },
  SHORT_ANSWER: { label: '簡答題', description: '收集文字回應，公開顯示解讀民意', min: 0, max: 0, needs: 'NONE' },
  MATCHING: { label: '連連看', description: '左右配對，配對完成即選定', min: 2, max: 6, needs: 'MATCH' },
  PUZZLE: { label: '拼圖題', description: '重排拼字，拼完揭曉你的選擇', min: 2, max: 4, needs: 'LIST' },
  SCRATCH: { label: '刮刮樂', description: '一張卡片隨機揭曉 2～9 種結果', min: 2, max: 9, needs: 'LIST' },
  SPIN_WHEEL: { label: '轉盤抽獎', description: '轉動轉盤，指到的即你的選擇', min: 2, max: 8, needs: 'WEIGHT' },
  LOTTERY: { label: '日式搖獎', description: '搖箱抽球，抽中的即你的選擇', min: 2, max: 10, needs: 'LIST' },
  STAR_RATING: { label: '五星評分', description: '以 1~5 顆星快速評分', min: 0, max: 0, needs: 'NONE' },
  LIKERT: { label: '量表題', description: '自訂點數（3~10）與兩端文字的量表', min: 0, max: 0, needs: 'NONE' },
  MULTI_SELECT: { label: '複選題', description: '2~10 個選項，可設定最多選幾項', min: 2, max: 10, needs: 'LIST' },
};

export const DEFAULT_COUNT: Record<BuilderType, number> = {
  OPTION: 2,
  IMAGE_OPTION: 2,
  IMAGE_RANK: 8,
  SPECTRUM: 0,
  SHORT_ANSWER: 0,
  MATCHING: 3,
  PUZZLE: 3,
  SCRATCH: 4,
  SPIN_WHEEL: 4,
  LOTTERY: 5,
  STAR_RATING: 0,
  LIKERT: 0,
  MULTI_SELECT: 3,
};

export const BUILDER_TYPES = Object.entries(BUILDER_RULES).map(([value, rule]) => ({
  value: value as BuilderType,
  label: rule.label,
  description: rule.description,
}));

let rowSeq = 0;
export const nextRowId = () => `row-${rowSeq++}`;

export function createScratchCardDraft(): ScratchCardDraft {
  return { coverImageUrl: null, revealMode: 'SHARED', sharedRevealImageUrl: null, showText: true };
}

export function seedRows(type: BuilderType): BuilderRow[] {
  return Array.from({ length: DEFAULT_COUNT[type] }, () => ({ id: nextRowId(), label: '', match: '', weight: '', image: null }));
}

export function isImageBuilder(type: BuilderType): boolean {
  return type === 'IMAGE_OPTION' || type === 'IMAGE_RANK';
}

export function builderHeading(type: BuilderType): string {
  return {
    OPTION: '選項',
    IMAGE_OPTION: '圖片選項',
    IMAGE_RANK: '排名賽圖片',
    SPECTRUM: '光譜軸向',
    SHORT_ANSWER: '作答提示',
    MATCHING: '配對內容',
    PUZZLE: '拼圖提示',
    SCRATCH: '卡片內容',
    SPIN_WHEEL: '轉盤選項',
    LOTTERY: '搖獎球選項',
    STAR_RATING: '五星評分',
    LIKERT: '量表題',
    MULTI_SELECT: '複選選項',
  }[type] ?? '項目';
}

export function builderPlaceholder(type: BuilderType): string {
  if (isImageBuilder(type)) return '圖片說明（選填）';
  if (type === 'MATCHING') return '左側項目';
  if (type === 'PUZZLE') return '拼圖提示（如「支持」）';
  return '選項內容';
}

export function backendTopicType(type: BuilderType, filledLabels: string[]): QuickTopicType {
  if (type === 'OPTION') return filledLabels.length === 2 ? 'BINARY' : 'MULTIPLE';
  if (type === 'IMAGE_OPTION') return 'IMAGE_MULTIPLE';
  return type;
}

export function questionPayload(question: QuestionDraft): Record<string, unknown> {
  const rule = BUILDER_RULES[question.type];
  const isImage = isImageBuilder(question.type);
  const filledLabels = question.rows.map((row) => row.label.trim()).filter(Boolean);
  const payload: Record<string, unknown> = {
    topicType: backendTopicType(question.type, filledLabels),
  };
  if (rule.needs !== 'NONE' && question.type !== 'SCRATCH') payload.options = question.rows.map((row) => row.label.trim());
  if (isImage) payload.optionImages = question.rows.map((row) => row.image || null);
  if (question.type === 'MATCHING') payload.matches = question.rows.map((row) => row.match.trim());
  if (question.type === 'SPIN_WHEEL') {
    const weights = question.rows.map((row) => Number(row.weight.trim()));
    if (weights.every(Number.isInteger)) payload.weights = weights;
  }
  if (question.type === 'SHORT_ANSWER') payload.prompt = question.prompt.trim() || undefined;
  if (question.type === 'LIKERT') {
    payload.scalePoints = normalizeLikertPoints(question.points);
    payload.scaleMinLabel = question.scaleMinLabel?.trim();
    payload.scaleMaxLabel = question.scaleMaxLabel?.trim();
  }
  if (question.type === 'MULTI_SELECT') payload.maxSelections = question.maxSelections;
  if (question.type === 'SCRATCH') {
    const scratchCard = question.scratchCard ?? createScratchCardDraft();
    payload.scratchCard = {
      ...(scratchCard.coverImageUrl ? { coverImageUrl: scratchCard.coverImageUrl } : {}),
      revealMode: scratchCard.revealMode,
      ...(scratchCard.revealMode === 'SHARED' && scratchCard.sharedRevealImageUrl ? { sharedRevealImageUrl: scratchCard.sharedRevealImageUrl } : {}),
      showText: scratchCard.showText,
      results: question.rows.map((row) => {
        const weight = Number(row.weight.trim());
        return {
          label: row.label.trim(),
          ...(scratchCard.revealMode === 'PER_RESULT' && row.image ? { revealImageUrl: row.image } : {}),
          ...(row.weight.trim() && Number.isInteger(weight) && weight > 0 ? { weight } : {}),
        };
      }),
    };
  }
  return payload;
}

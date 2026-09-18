import {
  BUILDER_RULES,
  DEFAULT_COUNT,
  LIKERT_POINTS_MAX,
  LIKERT_POINTS_MIN,
  createScratchCardDraft,
  type BuilderType,
  type ScratchCardDraft,
  type ScratchRevealMode,
} from './questionBuilder';

export interface QuickImportRow {
  label: string;
  match: string;
  weight: string;
}

export interface QuickImportDraft {
  title: string | null;
  type: BuilderType;
  rows: QuickImportRow[];
  prompt: string;
  points: number;
  scaleMinLabel: string;
  scaleMaxLabel: string;
  maxSelections: number;
  scratchCard: ScratchCardDraft;
}

export type QuickImportResult = { ok: true; draft: QuickImportDraft } | { ok: false; error: string };

const BUILDER_TYPES = Object.keys(BUILDER_RULES) as BuilderType[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimmedOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isPositiveIntString(value: string): boolean {
  const num = Number(value);
  return value !== '' && Number.isInteger(num) && num > 0;
}

function sampleLabels(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);
}

/** 依目前題型產生可下載的 JSON 範例檔內容（圖片欄位不支援，僅留文字欄位）。 */
export function buildQuickImportExample(type: BuilderType): Record<string, unknown> {
  const count = DEFAULT_COUNT[type];
  const example: Record<string, unknown> = { title: '你今天中午想吃什麼？', type };
  switch (type) {
    case 'MATCHING':
      example.rows = sampleLabels('項目', count).map((label, index) => ({ label, match: `配對${index + 1}` }));
      break;
    case 'SPIN_WHEEL':
    case 'SCRATCH':
      example.rows = sampleLabels('結果', count).map((label) => ({ label, weight: '1' }));
      break;
    case 'SHORT_ANSWER':
      example.prompt = '請寫下你的回答…';
      break;
    case 'LIKERT':
      example.points = 5;
      example.scaleMinLabel = '非常不同意';
      example.scaleMaxLabel = '非常同意';
      break;
    case 'MULTI_SELECT':
      example.rows = sampleLabels('選項', count).map((label) => ({ label }));
      example.maxSelections = 2;
      break;
    case 'SPECTRUM':
    case 'STAR_RATING':
      break;
    default:
      example.rows = sampleLabels('選項', count).map((label) => ({ label }));
      break;
  }
  if (type === 'SCRATCH') {
    example.scratchCard = { revealMode: 'SHARED', showText: true };
  }
  return example;
}

function fail(error: string): QuickImportResult {
  return { ok: false, error };
}

/**
 * 驗證上傳的 JSON 並正規化為可套用的草稿。
 * 圖片欄位一律忽略（需手動上傳）；全部通過才回傳 draft，否則回傳第一個錯誤。
 */
export function parseQuickImport(input: unknown): QuickImportResult {
  if (!isRecord(input)) return fail('檔案內容必須是一個 JSON 物件');
  if (typeof input.type !== 'string' || !(BUILDER_TYPES as string[]).includes(input.type)) {
    return fail('缺少或不正確的 type 欄位，請先下載範例檔對照格式');
  }
  const type = input.type as BuilderType;
  const rule = BUILDER_RULES[type];

  let title: string | null = null;
  if (input.title !== undefined) {
    const parsed = trimmedOrNull(input.title);
    if (parsed === null) return fail('title 必須是非空字串');
    if (parsed.length > 100) return fail('title 不可超過 100 個字');
    title = parsed;
  }

  const rows: QuickImportRow[] = [];
  if (rule.needs !== 'NONE') {
    if (!Array.isArray(input.rows)) return fail('缺少 rows 陣列');
    if (input.rows.length < rule.min || input.rows.length > rule.max) {
      return fail(`${rule.label}需要 ${rule.min}～${rule.max} 個項目（檔案中有 ${input.rows.length} 個）`);
    }
    const labels: string[] = [];
    for (let index = 0; index < input.rows.length; index++) {
      const item = input.rows[index];
      if (!isRecord(item)) return fail(`第 ${index + 1} 列格式不正確`);
      const label = item.label === undefined && (type === 'IMAGE_OPTION' || type === 'IMAGE_RANK') ? '' : trimmedOrNull(item.label);
      if (label === null) return fail(`第 ${index + 1} 列缺少 label`);
      if (label.length > 50) return fail(`第 ${index + 1} 列 label 不可超過 50 個字`);
      let match = '';
      if (type === 'MATCHING') {
        const parsed = trimmedOrNull(item.match);
        if (parsed === null) return fail(`第 ${index + 1} 列缺少 match`);
        if (parsed.length > 50) return fail(`第 ${index + 1} 列 match 不可超過 50 個字`);
        match = parsed;
      }
      let weight = '';
      if (type === 'SPIN_WHEEL' || type === 'SCRATCH') {
        if (item.weight !== undefined && trimmedOrNull(item.weight) !== null) weight = (item.weight as string).trim();
      }
      rows.push({ label, match, weight });
      if (label) labels.push(label);
    }
    if (type !== 'IMAGE_OPTION' && type !== 'IMAGE_RANK' && new Set(labels).size !== labels.length) {
      return fail('項目內容不可重複');
    }
    if (type === 'MATCHING') {
      const matches = rows.map((row) => row.match);
      if (new Set(matches).size !== matches.length) return fail('右側配對不可重複');
    }
    if ((type === 'SPIN_WHEEL' || type === 'SCRATCH') && rows.some((row) => row.weight)) {
      const badIndex = rows.findIndex((row) => !isPositiveIntString(row.weight));
      if (badIndex >= 0) return fail(`第 ${badIndex + 1} 列 weight 需為正整數（有填寫時每一列都要填）`);
    }
  }

  let prompt = '';
  if (typeof input.prompt === 'string') {
    prompt = input.prompt.trim();
    if (prompt.length > 200) return fail('prompt 不可超過 200 個字');
  }

  let points = 5;
  if (input.points !== undefined) {
    if (!Number.isInteger(input.points) || (input.points as number) < LIKERT_POINTS_MIN || (input.points as number) > LIKERT_POINTS_MAX) {
      return fail(`points 需為 ${LIKERT_POINTS_MIN}～${LIKERT_POINTS_MAX} 的整數`);
    }
    points = input.points as number;
  }

  let scaleMinLabel = '';
  let scaleMaxLabel = '';
  if (input.scaleMinLabel !== undefined || input.scaleMaxLabel !== undefined) {
    const min = trimmedOrNull(input.scaleMinLabel);
    const max = trimmedOrNull(input.scaleMaxLabel);
    if (min === null || max === null) return fail('scaleMinLabel 與 scaleMaxLabel 需同時填寫非空字串');
    if (min.length > 50 || max.length > 50) return fail('量表端點文字不可超過 50 個字');
    if (min === max) return fail('量表兩端文字不可相同');
    scaleMinLabel = min;
    scaleMaxLabel = max;
  }

  let maxSelections = 1;
  if (input.maxSelections !== undefined) {
    if (!Number.isInteger(input.maxSelections) || (input.maxSelections as number) < 1) {
      return fail('maxSelections 需為正整數');
    }
    maxSelections = input.maxSelections as number;
  }
  if (type === 'MULTI_SELECT' && maxSelections > rows.length) {
    return fail(`maxSelections 不可超過選項數（${rows.length}）`);
  }

  const scratchCard = createScratchCardDraft();
  if (type === 'SCRATCH' && input.scratchCard !== undefined) {
    if (!isRecord(input.scratchCard)) return fail('scratchCard 格式不正確');
    if (input.scratchCard.revealMode !== undefined) {
      if (input.scratchCard.revealMode !== 'SHARED' && input.scratchCard.revealMode !== 'PER_RESULT') {
        return fail('scratchCard.revealMode 僅支援 SHARED 或 PER_RESULT');
      }
      scratchCard.revealMode = input.scratchCard.revealMode as ScratchRevealMode;
    }
    if (input.scratchCard.showText !== undefined) {
      if (typeof input.scratchCard.showText !== 'boolean') return fail('scratchCard.showText 必須是布林值');
      scratchCard.showText = input.scratchCard.showText;
    }
  }

  return { ok: true, draft: { title, type, rows, prompt, points, scaleMinLabel, scaleMaxLabel, maxSelections, scratchCard } };
}

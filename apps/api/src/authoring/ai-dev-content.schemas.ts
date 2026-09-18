import { BadGatewayException } from '@nestjs/common';
import { TopicContentBlockType, TopicType } from '@prisma/client';
import { assertClean } from '../common/sensitive';

export type AiDevKind = 'formal' | 'quick' | 'survey';

/** AI 可產生的快問題型（圖片題需真實圖片，排除不給 AI 產生） */
export const AI_QUICK_TYPES = [
  TopicType.BINARY,
  TopicType.MULTIPLE,
  TopicType.SPECTRUM,
  TopicType.SHORT_ANSWER,
  TopicType.MATCHING,
  TopicType.PUZZLE,
  TopicType.SCRATCH,
  TopicType.SPIN_WHEEL,
  TopicType.LOTTERY,
  TopicType.STAR_RATING,
  TopicType.LIKERT,
  TopicType.MULTI_SELECT,
] as const;

export const AI_VOTE_DURATIONS = [6, 12, 24, 48] as const;

export interface AiScratchResult {
  label: string;
  weight?: number;
}

export interface AiQuickTopic {
  title: string;
  topicType: TopicType;
  options: string[];
  matches?: string[];
  weights?: number[];
  prompt?: string;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  scalePoints?: number;
  maxSelections?: number;
  scratchCard?: { revealMode?: string; showText?: boolean; results?: AiScratchResult[] };
}

export interface AiFormalTopic {
  title: string;
  description?: string;
  category: string;
  options: string[];
  blocks?: Array<{
    type: TopicContentBlockType;
    title: string;
    content: string;
    sourceLabel?: string;
  }>;
}

export interface AiSurvey {
  title: string;
  voteDurationHours?: number;
  questions: AiQuickTopic[];
}

export interface AiDevContent {
  formal: AiFormalTopic[];
  quick: AiQuickTopic[];
  surveys: AiSurvey[];
}

function invalidOutput(reason: string): BadGatewayException {
  return new BadGatewayException(`AI 回應格式不完整（${reason}），請再試一次`);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function checkTitle(title: unknown, min: number, max: number, label: string): string {
  if (typeof title !== 'string' || !title.trim() || title.trim().length < min || title.trim().length > max) {
    throw invalidOutput(`${label}需為 ${min} 到 ${max} 個字`);
  }
  const clean = title.trim();
  try {
    assertClean(clean, label);
  } catch (error) {
    throw invalidOutput(error instanceof Error ? error.message : `${label}含有敏感詞`);
  }
  return clean;
}

function checkLabels(labels: unknown, min: number, max: number, label: string): string[] {
  if (!Array.isArray(labels) || labels.length < min || labels.length > max) {
    throw invalidOutput(`${label}需為 ${min} 到 ${max} 個字串`);
  }
  const cleaned = labels.map((item) => {
    if (typeof item !== 'string' || !item.trim() || item.trim().length > 50) {
      throw invalidOutput(`${label}每項需為 1 到 50 個字`);
    }
    return item.trim();
  });
  if (new Set(cleaned).size !== cleaned.length) throw invalidOutput(`${label}不可重複`);
  cleaned.forEach((item) => {
    try {
      assertClean(item, label);
    } catch (error) {
      throw invalidOutput(error instanceof Error ? error.message : `${label}含有敏感詞`);
    }
  });
  return cleaned;
}

function checkPositiveInts(values: unknown, count: number, label: string): number[] | undefined {
  if (values === undefined) return undefined;
  if (!Array.isArray(values) || values.length !== count) throw invalidOutput(`${label}數量需與選項相同`);
  return values.map((value) => {
    if (!Number.isInteger(value) || (value as number) <= 0) throw invalidOutput(`${label}需為正整數`);
    return value as number;
  });
}

function maxOptionsFor(type: TopicType): number {
  switch (type) {
    case TopicType.BINARY:
      return 2;
    case TopicType.MATCHING:
      return 6;
    case TopicType.PUZZLE:
      return 4;
    case TopicType.SPIN_WHEEL:
      return 8;
    default:
      return 10;
  }
}

const NO_OPTION_TYPES = [TopicType.SPECTRUM, TopicType.SHORT_ANSWER, TopicType.STAR_RATING, TopicType.LIKERT] as const;

function checkVoteDurationHours(value: unknown): number {
  if (value === undefined) return 24;
  if (!Number.isInteger(value) || !(AI_VOTE_DURATIONS as readonly number[]).includes(value as number)) {
    throw invalidOutput('投票時間僅支援 6、12、24、48 小時');
  }
  return value as number;
}

function validateQuickTopic(value: unknown, label: string): AiQuickTopic {
  if (!value || typeof value !== 'object') throw invalidOutput(`${label}格式不正確`);
  const item = value as Record<string, unknown>;
  const topicType = item.topicType;
  if (typeof topicType !== 'string' || !(AI_QUICK_TYPES as readonly string[]).includes(topicType)) {
    throw invalidOutput(`${label}題型不支援（不可為圖片題）`);
  }
  const type = topicType as TopicType;
  const title = checkTitle(item.title, 5, 100, `${label}標題`);
  const options = (NO_OPTION_TYPES as readonly string[]).includes(type)
    ? []
    : checkLabels(item.options, 2, maxOptionsFor(type), `${label}選項`);
  const result: AiQuickTopic = { title, topicType: type, options };
  if (type === TopicType.MATCHING) {
    const matches = checkLabels(item.matches, options.length, options.length, `${label}配對`);
    result.matches = matches;
  }
  if (type === TopicType.SPIN_WHEEL) {
    const weights = checkPositiveInts(item.weights, options.length, `${label}權重`);
    if (weights) result.weights = weights;
  }
  if (type === TopicType.SHORT_ANSWER && item.prompt !== undefined) {
    const prompt = asString(item.prompt);
    if (prompt === null || prompt.length > 200) throw invalidOutput(`${label}提示不可超過 200 個字`);
    result.prompt = prompt.trim();
  }
  if (type === TopicType.LIKERT) {
    if (!Number.isInteger(item.scalePoints) || (item.scalePoints as number) < 3 || (item.scalePoints as number) > 10) {
      throw invalidOutput(`${label}量表點數需為 3 到 10 的整數`);
    }
    const minLabel = asString(item.scaleMinLabel);
    const maxLabel = asString(item.scaleMaxLabel);
    if (!minLabel?.trim() || !maxLabel?.trim() || minLabel.trim() === maxLabel.trim()) {
      throw invalidOutput(`${label}量表兩端需填寫不同文字`);
    }
    result.scalePoints = item.scalePoints as number;
    result.scaleMinLabel = minLabel.trim();
    result.scaleMaxLabel = maxLabel.trim();
  }
  if (type === TopicType.MULTI_SELECT) {
    if (!Number.isInteger(item.maxSelections) || (item.maxSelections as number) < 1 || (item.maxSelections as number) > options.length) {
      throw invalidOutput(`${label}最多可選數需介於 1 與選項數之間`);
    }
    result.maxSelections = item.maxSelections as number;
  }
  if (type === TopicType.SCRATCH) {
    if (!item.scratchCard || typeof item.scratchCard !== 'object') throw invalidOutput(`${label}缺少 scratchCard`);
    const card = item.scratchCard as Record<string, unknown>;
    if (!Array.isArray(card.results) || card.results.length < 2 || card.results.length > 9) {
      throw invalidOutput(`${label}刮刮樂需 2 到 9 個結果`);
    }
    const results: AiScratchResult[] = card.results.map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') throw invalidOutput(`${label}刮刮樂結果格式不正確`);
      const record = entry as Record<string, unknown>;
      const labelText = asString(record.label);
      if (!labelText?.trim() || labelText.trim().length > 50) throw invalidOutput(`${label}刮刮樂結果需為 1 到 50 個字`);
      const resultEntry: AiScratchResult = { label: labelText.trim() };
      if (record.weight !== undefined) {
        if (!Number.isInteger(record.weight) || (record.weight as number) <= 0) throw invalidOutput(`${label}刮刮樂權重需為正整數`);
        resultEntry.weight = record.weight as number;
      }
      return resultEntry;
    });
    if (new Set(results.map((entry) => entry.label)).size !== results.length) throw invalidOutput(`${label}刮刮樂結果不可重複`);
    results.forEach((entry) => {
      try {
        assertClean(entry.label, `${label}刮刮樂結果`);
      } catch (error) {
        throw invalidOutput(error instanceof Error ? error.message : '含有敏感詞');
      }
    });
    result.scratchCard = {
      revealMode: card.revealMode === 'PER_RESULT' ? 'PER_RESULT' : 'SHARED',
      showText: card.showText === undefined ? true : card.showText === true,
      results,
    };
  }
  return result;
}

function validateFormalTopic(value: unknown, categoryKeys: string[], label: string): AiFormalTopic {
  if (!value || typeof value !== 'object') throw invalidOutput(`${label}格式不正確`);
  const item = value as Record<string, unknown>;
  const title = checkTitle(item.title, 10, 100, `${label}標題`);
  const description = asString(item.description)?.trim() ?? '';
  if (description && description.length < 20) throw invalidOutput(`${label}描述需至少 20 個字`);
  if (description.length > 2000) throw invalidOutput(`${label}描述不可超過 2000 個字`);
  const category = asString(item.category);
  if (!category || !categoryKeys.includes(category)) throw invalidOutput(`${label}分類需為有效分類`);
  const options = checkLabels(item.options, 2, 10, `${label}選項`);
  const result: AiFormalTopic = { title, category, options };
  if (description) result.description = description;
  if (item.blocks !== undefined) {
    if (!Array.isArray(item.blocks)) throw invalidOutput(`${label}內容區塊格式不正確`);
    result.blocks = item.blocks.map((block: unknown) => {
      if (!block || typeof block !== 'object') throw invalidOutput(`${label}內容區塊格式不正確`);
      const record = block as Record<string, unknown>;
      if (record.type !== TopicContentBlockType.CASE && record.type !== TopicContentBlockType.DATA) {
        throw invalidOutput(`${label}內容區塊僅支援 CASE 或 DATA`);
      }
      const blockTitle = asString(record.title);
      const content = asString(record.content);
      if (!blockTitle || blockTitle.trim().length < 3 || blockTitle.trim().length > 120) {
        throw invalidOutput(`${label}區塊標題需為 3 到 120 個字`);
      }
      if (!content || content.trim().length < 10 || content.trim().length > 2000) {
        throw invalidOutput(`${label}區塊內容需為 10 到 2000 個字`);
      }
      return { type: record.type, title: blockTitle.trim(), content: content.trim(), sourceLabel: asString(record.sourceLabel)?.trim() || 'AI 開發 seeded 內容' };
    });
  }
  return result;
}

/** 驗證 AI 產出的開發內容（只保留請求的 kinds，其餘忽略）。 */
export function validateAiDevContent(output: unknown, categoryKeys: string[], kinds: AiDevKind[]): AiDevContent {
  if (!output || typeof output !== 'object' || !exactKeys(output as Record<string, unknown>, ['formal', 'quick', 'surveys'])) {
    throw invalidOutput('頂層需為 { formal, quick, surveys }');
  }
  const record = output as Record<string, unknown>;
  const content: AiDevContent = { formal: [], quick: [], surveys: [] };
  if (kinds.includes('formal')) {
    if (!Array.isArray(record.formal) || record.formal.length === 0) throw invalidOutput('formal 需為非空陣列');
    content.formal = record.formal.map((item, index) => validateFormalTopic(item, categoryKeys, `正式議題 ${index + 1}`));
  }
  if (kinds.includes('quick')) {
    if (!Array.isArray(record.quick) || record.quick.length === 0) throw invalidOutput('quick 需為非空陣列');
    content.quick = record.quick.map((item, index) => validateQuickTopic(item, `快問 ${index + 1}`));
  }
  if (kinds.includes('survey')) {
    if (!Array.isArray(record.surveys) || record.surveys.length === 0) throw invalidOutput('surveys 需為非空陣列');
    content.surveys = record.surveys.map((item, index) => {
      if (!item || typeof item !== 'object') throw invalidOutput(`問卷 ${index + 1} 格式不正確`);
      const survey = item as Record<string, unknown>;
      const title = checkTitle(survey.title, 5, 100, `問卷 ${index + 1} 標題`);
      if (!Array.isArray(survey.questions) || survey.questions.length < 2 || survey.questions.length > 20) {
        throw invalidOutput(`問卷 ${index + 1} 需 2 到 20 題`);
      }
      return {
        title,
        voteDurationHours: checkVoteDurationHours(survey.voteDurationHours),
        questions: (survey.questions as unknown[]).map((question, questionIndex) => validateQuickTopic(question, `問卷 ${index + 1} 第 ${questionIndex + 1} 題`)),
      };
    });
  }
  return content;
}

/** strict 模式 JSON schema（所有欄位 required，由 CLI 忽略非請求 kinds）。 */
export function aiDevContentJsonSchema(): Record<string, unknown> {
  const result = {
    type: 'object',
    properties: { label: { type: 'string' }, weight: { type: 'integer', minimum: 1 } },
    required: ['label'],
    additionalProperties: false,
  };
  const quickTopic = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      topicType: { type: 'string', enum: AI_QUICK_TYPES as unknown as string[] },
      options: { type: 'array', items: { type: 'string' } },
      matches: { type: 'array', items: { type: 'string' } },
      weights: { type: 'array', items: { type: 'integer', minimum: 1 } },
      prompt: { type: 'string' },
      scaleMinLabel: { type: 'string' },
      scaleMaxLabel: { type: 'string' },
      scalePoints: { type: 'integer', minimum: 3, maximum: 10 },
      maxSelections: { type: 'integer', minimum: 1 },
      scratchCard: {
        type: 'object',
        properties: {
          revealMode: { type: 'string', enum: ['SHARED', 'PER_RESULT'] },
          showText: { type: 'boolean' },
          results: { type: 'array', items: result },
        },
        required: ['revealMode', 'showText', 'results'],
        additionalProperties: false,
      },
    },
    required: ['title', 'topicType', 'options', 'matches', 'weights', 'prompt', 'scaleMinLabel', 'scaleMaxLabel', 'scalePoints', 'maxSelections', 'scratchCard'],
    additionalProperties: false,
  };
  return {
    type: 'object',
    properties: {
      formal: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
            blocks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['CASE', 'DATA'] },
                  title: { type: 'string' },
                  content: { type: 'string' },
                  sourceLabel: { type: 'string' },
                },
                required: ['type', 'title', 'content', 'sourceLabel'],
                additionalProperties: false,
              },
            },
          },
          required: ['title', 'description', 'category', 'options', 'blocks'],
          additionalProperties: false,
        },
      },
      quick: { type: 'array', items: quickTopic },
      surveys: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            voteDurationHours: { type: 'integer', enum: [6, 12, 24, 48] },
            questions: { type: 'array', items: quickTopic },
          },
          required: ['title', 'voteDurationHours', 'questions'],
          additionalProperties: false,
        },
      },
    },
    required: ['formal', 'quick', 'surveys'],
    additionalProperties: false,
  };
}

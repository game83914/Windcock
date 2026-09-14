import { BadGatewayException } from '@nestjs/common';

export type AuthoringTarget = 'TOPIC' | 'STANCE';

export interface AuthoringQuestion {
  id: string;
  prompt: string;
  required: true;
  maxLength: 1000;
}

export interface TopicDraftForm {
  title: string;
  description: string;
  category: string;
  topicType: 'BINARY' | 'MULTIPLE' | 'SPECTRUM';
  options: string[];
  voteDurationDays: 3 | 7 | 14 | 30;
  blocks: Array<{ type: 'BACKGROUND' | 'CASE' | 'DATA' | 'PERSPECTIVES'; title: string; content: string }>;
}

export interface StanceDraftForm {
  title: string;
  rationale: string;
}

export interface AuthoringDraft<T = TopicDraftForm | StanceDraftForm> {
  id: string;
  label: string;
  form: T;
}

const text = (value: unknown, min: number, max: number) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => key in value);

export const questionsJsonSchema = {
  type: 'object', additionalProperties: false, required: ['questions'],
  properties: {
    questions: {
      type: 'array', minItems: 2, maxItems: 4,
      items: { type: 'object', additionalProperties: false, required: ['prompt'], properties: { prompt: { type: 'string', minLength: 5, maxLength: 300 } } },
    },
  },
};

const topicFormSchema = (categoryKeys: string[]) => ({
  type: 'object', additionalProperties: false,
  required: ['title', 'description', 'category', 'topicType', 'options', 'voteDurationDays', 'blocks'],
  properties: {
    title: { type: 'string', minLength: 10, maxLength: 100 },
    description: { type: 'string', minLength: 20, maxLength: 2000 },
    category: { type: 'string', enum: categoryKeys },
    topicType: { type: 'string', enum: ['BINARY', 'MULTIPLE', 'SPECTRUM'] },
    options: { type: 'array', maxItems: 6, items: { type: 'string', minLength: 1, maxLength: 50 } },
    voteDurationDays: { type: 'integer', enum: [3, 7, 14, 30] },
    blocks: {
      type: 'array', maxItems: 8,
      items: {
        type: 'object', additionalProperties: false, required: ['type', 'title', 'content'],
        properties: {
          type: { type: 'string', enum: ['BACKGROUND', 'CASE', 'DATA', 'PERSPECTIVES'] },
          title: { type: 'string', minLength: 3, maxLength: 120 },
          content: { type: 'string', minLength: 10, maxLength: 2000 },
        },
      },
    },
  },
});

const stanceFormSchema = {
  type: 'object', additionalProperties: false, required: ['title', 'rationale'],
  properties: {
    title: { type: 'string', minLength: 2, maxLength: 80 },
    rationale: { type: 'string', maxLength: 200 },
  },
};

export function draftsJsonSchema(target: AuthoringTarget, categoryKeys: string[] = []) {
  return {
    type: 'object', additionalProperties: false, required: ['drafts'],
    properties: {
      drafts: {
        type: 'array', minItems: 3, maxItems: 5,
        items: {
          type: 'object', additionalProperties: false, required: ['label', 'form'],
          properties: { label: { type: 'string', minLength: 1, maxLength: 40 }, form: target === 'TOPIC' ? topicFormSchema(categoryKeys) : stanceFormSchema },
        },
      },
    },
  };
}

export function validateQuestionPrompts(value: unknown): string[] {
  if (!value || typeof value !== 'object') throw invalidOutput();
  const questions = (value as { questions?: unknown }).questions;
  if (!Array.isArray(questions) || questions.length < 2 || questions.length > 4) throw invalidOutput();
  const prompts = questions.map((question) => {
    if (!question || typeof question !== 'object' || !exactKeys(question as Record<string, unknown>, ['prompt'])) throw invalidOutput();
    const prompt = (question as { prompt?: unknown }).prompt;
    if (!text(prompt, 5, 300)) throw invalidOutput();
    return (prompt as string).trim();
  });
  if (new Set(prompts).size !== prompts.length) throw invalidOutput();
  return prompts;
}

export function validateDrafts(value: unknown, target: AuthoringTarget, categoryKeys: string[] = []): Array<{ label: string; form: TopicDraftForm | StanceDraftForm }> {
  if (!value || typeof value !== 'object') throw invalidOutput();
  const drafts = (value as { drafts?: unknown }).drafts;
  if (!Array.isArray(drafts) || drafts.length < 3 || drafts.length > 5) throw invalidOutput();
  return drafts.map((draft) => {
    if (!draft || typeof draft !== 'object' || !exactKeys(draft as Record<string, unknown>, ['label', 'form'])) throw invalidOutput();
    const { label, form } = draft as { label?: unknown; form?: unknown };
    if (!text(label, 1, 40) || !form || typeof form !== 'object') throw invalidOutput();
    if (target === 'TOPIC') validateTopicForm(form as Record<string, unknown>, categoryKeys);
    else validateStanceForm(form as Record<string, unknown>);
    return { label: (label as string).trim(), form: form as TopicDraftForm | StanceDraftForm };
  });
}

function validateTopicForm(form: Record<string, unknown>, categoryKeys: string[]) {
  const keys = ['title', 'description', 'category', 'topicType', 'options', 'voteDurationDays', 'blocks'];
  if (!exactKeys(form, keys) || !text(form.title, 10, 100) || !text(form.description, 20, 2000)) throw invalidOutput();
  if (!categoryKeys.includes(form.category as string)) throw invalidOutput();
  if (!['BINARY', 'MULTIPLE', 'SPECTRUM'].includes(form.topicType as string)) throw invalidOutput();
  if (![3, 7, 14, 30].includes(form.voteDurationDays as number) || !Array.isArray(form.options) || !Array.isArray(form.blocks) || form.blocks.length > 8) throw invalidOutput();
  const options = form.options as unknown[];
  const expectedOptions = form.topicType === 'BINARY' ? options.length === 2 : form.topicType === 'MULTIPLE' ? options.length >= 2 && options.length <= 6 : options.length === 0;
  if (!expectedOptions || options.some((option) => !text(option, 1, 50)) || new Set(options.map(String)).size !== options.length) throw invalidOutput();
  for (const block of form.blocks as unknown[]) {
    if (!block || typeof block !== 'object') throw invalidOutput();
    const item = block as Record<string, unknown>;
    if (!exactKeys(item, ['type', 'title', 'content']) || !['BACKGROUND', 'CASE', 'DATA', 'PERSPECTIVES'].includes(item.type as string) || !text(item.title, 3, 120) || !text(item.content, 10, 2000)) throw invalidOutput();
  }
}

function validateStanceForm(form: Record<string, unknown>) {
  if (!exactKeys(form, ['title', 'rationale']) || !text(form.title, 2, 80) || typeof form.rationale !== 'string' || form.rationale.trim().length > 200) throw invalidOutput();
}

function invalidOutput() {
  return new BadGatewayException('AI 草稿格式不完整，請再試一次');
}

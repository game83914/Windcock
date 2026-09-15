import type { Category, Topic, TopicOption } from '~/types/topic';

export interface CategoryMeta {
  key: string;
  label: string;
  eyebrow: string;
  color: string;
  soft: string;
}

const KEY_META: Record<string, CategoryMeta> = {
  politics: { key: 'politics', label: '政治', eyebrow: '治理與政策', color: '#9c3b3b', soft: '#f6e7e7' },
  society: { key: 'society', label: '社會', eyebrow: '公共生活', color: '#37639c', soft: '#e7eff6' },
  life: { key: 'life', label: '生活', eyebrow: '生活選擇', color: '#3f7a58', soft: '#e5f1e9' },
  technology: { key: 'technology', label: '科技', eyebrow: '科技與數位', color: '#7a5cbf', soft: '#efeafb' },
  entertainment: { key: 'entertainment', label: '娛樂', eyebrow: '娛樂與文化', color: '#b0761f', soft: '#f8f0e3' },
  quick: { key: 'quick', label: '快問', eyebrow: 'UGC 微投票', color: '#b0761f', soft: '#f8ecd6' },
};

const LABEL_TO_KEY: Record<string, string> = { 政治: 'politics', 社會: 'society', 生活: 'life', 科技: 'technology', 娛樂: 'entertainment' };

const OTHER: CategoryMeta = { key: 'other', label: '未分類', eyebrow: '其他話題', color: '#525252', soft: '#eeeeea' };

let categoryRules: Record<string, CategoryMeta> = { ...KEY_META };

export function applyCategoryRules(categories: Category[]) {
  const next: Record<string, CategoryMeta> = { ...KEY_META };
  for (const category of categories) {
    next[category.key] = { key: category.key, label: category.label, eyebrow: category.eyebrow, color: category.color, soft: category.soft };
  }
  categoryRules = next;
}

export function getCategoryMeta(category: string): CategoryMeta {
  if (!category) return OTHER;
  return categoryRules[category] ?? categoryRules[LABEL_TO_KEY[category] ?? ''] ?? OTHER;
}

export function contrastTextColor(background: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(background);
  if (!match) return '#ffffff';
  const channels = [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return (1.05 / (luminance + 0.05)) >= ((luminance + 0.05) / 0.05) ? '#ffffff' : '#171717';
}

export function formatCompactNumber(value: string | number) {
  return new Intl.NumberFormat('zh-TW', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value));
}

export function formatDeadline(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function deadlineLabel(iso?: string | null, now = Date.now()) {
  if (!iso) return '尚未開票';
  const remaining = new Date(iso).getTime() - now;
  const hours = Math.ceil(remaining / 3_600_000);
  if (hours <= 0) return '已截止';
  if (hours <= 24) return `${hours} 小時後截止`;
  if (hours <= 72) return `${Math.ceil(hours / 24)} 天後截止`;
  return `截止 ${formatDeadline(iso)}`;
}

export function optionPercentage(option: TopicOption, topic: Topic) {
  const total = Number(topic.totalVotes);
  return total > 0 ? Math.round((Number(option.voteCount) / total) * 100) : 0;
}

export const TOPIC_TYPE_LABEL: Record<string, string> = {
  BINARY: '二選一',
  MULTIPLE: '多選項',
  SPECTRUM: '光譜題',
  SHORT_ANSWER: '簡答題',
  MATCHING: '連連看',
  PUZZLE: '拼圖題',
  SCRATCH: '刮刮樂',
  SPIN_WHEEL: '轉盤抽獎',
  LOTTERY: '日式搖獎',
};

export function isOptionPickType(topicType?: string) {
  return !!topicType && !['SPECTRUM', 'SHORT_ANSWER'].includes(topicType);
}

export function topicTypeLabel(topicType?: string) {
  return TOPIC_TYPE_LABEL[topicType ?? ''] ?? '選項題';
}

export function leadingOptions(topic: Topic, limit = 2) {
  return [...topic.options]
    .sort((a, b) => Number(b.voteCount) - Number(a.voteCount))
    .slice(0, limit);
}

export const VOTE_GUEST_NOTICE = '登入後即可一鍵投票，還能獲得點數。';
export const VOTE_IDENTITY_NOTICE = '此身份僅供查閱，不能投票。';
export const VOTE_LOGIN_LABEL = '門號登入投票';

export const OPTION_COLLAPSE_LIMIT = 4;

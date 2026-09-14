import { BadRequestException } from '@nestjs/common';

export const SENSITIVE_WORDS = ['詐騙', '色情', '暴力', '私訊加賴', '自殘', '自殺']; // placeholder 敏感詞黑名單

export function assertClean(content: string, label = '內容') {
  const hit = SENSITIVE_WORDS.find((word) => content.includes(word));
  if (hit) {
    throw new BadRequestException(`${label}包含敏感詞「${hit}」，請修改後再送出`);
  }
}
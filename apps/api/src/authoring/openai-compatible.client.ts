import { GatewayTimeoutException, Injectable, ServiceUnavailableException, BadGatewayException } from '@nestjs/common';

interface Message { role: 'system' | 'user'; content: string }

@Injectable()
export class OpenAiCompatibleClient {
  private readonly enabled = process.env.AI_AUTHORING_ENABLED === 'true';
  private readonly baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  private readonly apiKey = process.env.OPENAI_API_KEY || '';
  private readonly model = process.env.OPENAI_MODEL || '';
  private readonly timeoutMs = Number(process.env.AI_AUTHORING_TIMEOUT_MS || 25000);
  private readonly maxResponseBytes = Number(process.env.AI_AUTHORING_MAX_RESPONSE_BYTES || 262144);
  private readonly maxOutputTokens = Number(process.env.AI_AUTHORING_MAX_OUTPUT_TOKENS || 1800);
  private readonly responseFormat = process.env.OPENAI_RESPONSE_FORMAT || 'json_schema';

  constructor() {
    if (!this.enabled) return;
    if (!this.apiKey || !this.model || !Number.isFinite(this.timeoutMs) || this.timeoutMs < 1000 || !Number.isInteger(this.maxResponseBytes) || this.maxResponseBytes < 1024 || !Number.isInteger(this.maxOutputTokens) || this.maxOutputTokens < 100 || !['json_schema', 'json_object'].includes(this.responseFormat)) {
      throw new Error('AI authoring is enabled but OPENAI_API_KEY, OPENAI_MODEL, or timeout configuration is invalid');
    }
    const url = new URL(this.baseUrl);
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      throw new Error('OPENAI_BASE_URL must use HTTPS in production');
    }
  }

  assertAvailable() {
    if (!this.enabled) throw new ServiceUnavailableException('AI 輔助目前未啟用');
  }

  async complete(messages: Message[], schemaName: string, schema: Record<string, unknown>): Promise<unknown> {
    this.assertAvailable();
    let lastStatus = 0;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            temperature: 0.4,
            max_tokens: this.maxOutputTokens,
            messages,
            response_format: this.responseFormat === 'json_schema'
              ? { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } }
              : { type: 'json_object' },
          }),
          signal: controller.signal,
        });
        lastStatus = response.status;
        const raw = await response.text();
        if (Buffer.byteLength(raw, 'utf8') > this.maxResponseBytes) throw new BadGatewayException('AI 回應內容過大');
        if (!response.ok) {
          if ((response.status === 429 || response.status >= 500) && attempt === 0) continue;
          throw new ServiceUnavailableException('AI 服務暫時無法使用，請稍後再試');
        }
        const body = JSON.parse(raw) as { choices?: Array<{ message?: { content?: unknown } }> };
        const content = body.choices?.[0]?.message?.content;
        if (typeof content !== 'string') throw new BadGatewayException('AI 回應格式不完整');
        return JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as unknown;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw new GatewayTimeoutException('AI 回應逾時，請再試一次');
        if (error instanceof BadGatewayException || error instanceof ServiceUnavailableException) throw error;
        if (attempt === 0 && lastStatus === 0) continue;
        throw new BadGatewayException('無法解析 AI 回應');
      } finally {
        clearTimeout(timer);
      }
    }
    throw new ServiceUnavailableException('AI 服務暫時無法使用');
  }
}

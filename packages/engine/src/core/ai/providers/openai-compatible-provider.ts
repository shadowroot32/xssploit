import { BaseAIProvider, type AIResponse, type PayloadSuggestionRequest, type VulnClassification } from './base-provider.js';
import { HTTPClient } from '../../../utils/http-client.js';

/**
 * Generic OpenAI-compatible chat-completions provider. Backs both
 * Antigravity (tier 2) and DeepSeek (tier 3) — they share the API shape.
 */
export class OpenAICompatibleProvider extends BaseAIProvider {
  private readonly http = new HTTPClient();

  constructor(
    readonly name: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {
    super();
  }

  isAvailable(): boolean {
    return this.apiKey.length > 0 && this.baseUrl.length > 0;
  }

  private async chat(prompt: string, maxTokens: number): Promise<AIResponse> {
    const res = await this.http.fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      timeoutMs: 30_000,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const json = JSON.parse(res.body) as {
      choices?: { message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };
    return {
      text: json.choices?.[0]?.message?.content ?? '',
      tokensUsed: json.usage?.total_tokens ?? 0,
      provider: this.name,
    };
  }

  async suggestPayloads(req: PayloadSuggestionRequest) {
    const prompt = [
      'Authorized pentest. Suggest XSS payloads as a JSON array of strings only.',
      `Context: ${req.context}. Intact syntax: ${JSON.stringify(req.intactSyntax)}.`,
      req.waf ? `WAF: ${req.waf}.` : '',
      req.failedPayloads.length > 0 ? `Blocked already: ${req.failedPayloads.slice(0, 5).join(' | ')}` : '',
      `Max ${req.max ?? 8} items.`,
    ].join(' ');
    const res = await this.chat(prompt, 1024);
    let payloads: string[] = [];
    try {
      const t = res.text.replace(/```json?|```/g, '').trim();
      const arr = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1));
      if (Array.isArray(arr)) payloads = arr.filter((x): x is string => typeof x === 'string');
    } catch {
      payloads = [];
    }
    return { payloads, tokensUsed: res.tokensUsed };
  }

  async classifyVuln(input: { context: string; payload: string; url: string; parameter: string }) {
    const res = await this.chat(
      `Classify this XSS finding. JSON only {"severity":"...","reasoning":"...","description":"..."}: ${JSON.stringify(input)}`,
      512,
    );
    let result: VulnClassification;
    try {
      const t = res.text.replace(/```json?|```/g, '').trim();
      result = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)) as VulnClassification;
    } catch {
      result = { severity: 'medium', reasoning: 'defaulted', description: `XSS via ${input.parameter}` };
    }
    return { result, tokensUsed: res.tokensUsed };
  }

  analyze(prompt: string, maxTokens = 1024): Promise<AIResponse> {
    return this.chat(prompt, maxTokens);
  }
}

/** Tier-2 factory. */
export function antigravityProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider(
    'antigravity',
    process.env.ANTIGRAVITY_BASE_URL ?? 'https://api.antigravity.ai/v1',
    process.env.ANTIGRAVITY_API_KEY ?? '',
    'antigravity-pro',
  );
}

/** Tier-3 factory. */
export function deepseekProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider(
    'deepseek',
    process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
    process.env.DEEPSEEK_API_KEY ?? '',
    'deepseek-chat',
  );
}

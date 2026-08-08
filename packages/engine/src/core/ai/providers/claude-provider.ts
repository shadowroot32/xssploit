import { BaseAIProvider, type AIResponse, type PayloadSuggestionRequest, type VulnClassification } from './base-provider.js';
import { HTTPClient } from '../../../utils/http-client.js';
import { resolveAISettings } from '../../../utils/settings-store.js';

/**
 * Anthropic Claude provider (tier 1). Uses the Messages API directly via
 * undici so the engine has no heavyweight SDK dependency.
 * Key resolution: settings file (dashboard) → ANTHROPIC_API_KEY env.
 */
export class ClaudeProvider extends BaseAIProvider {
  readonly name = 'claude';
  private readonly http = new HTTPClient();

  constructor(private readonly apiKey?: string, private readonly model?: string) {
    super();
  }

  private get key(): string {
    return this.apiKey ?? resolveAISettings().anthropicApiKey;
  }

  private get modelName(): string {
    return this.model ?? resolveAISettings().anthropicModel;
  }

  isAvailable(): boolean {
    return this.key.length > 0;
  }

  private async messages(prompt: string, maxTokens: number): Promise<AIResponse> {
    const res = await this.http.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      timeoutMs: 30_000,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.modelName,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const json = JSON.parse(res.body) as {
      content?: { text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    return {
      text: json.content?.[0]?.text ?? '',
      tokensUsed: (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0),
      provider: this.name,
    };
  }

  async suggestPayloads(req: PayloadSuggestionRequest) {
    const prompt = [
      'You are assisting an authorized penetration test. Suggest XSS payloads.',
      req.directives ? `Operator directives (MUST follow): ${req.directives}` : '',
      `Injection context: ${req.context}`,
      `Surviving syntax chars: ${JSON.stringify(req.intactSyntax)}`,
      req.waf ? `WAF detected: ${req.waf}` : 'No WAF detected.',
      req.failedPayloads.length > 0 ? `Already blocked/filtered: ${req.failedPayloads.slice(0, 5).join(' | ')}` : '',
      `Return ONLY a JSON array of up to ${req.max ?? 8} payload strings. No markdown fences.`,
    ].join('\n');
    const res = await this.messages(prompt, 1024);
    return { payloads: parseJsonArray(res.text), tokensUsed: res.tokensUsed };
  }

  async classifyVuln(input: { context: string; payload: string; url: string; parameter: string; directives?: string }) {
    const prompt = [
      'Classify this confirmed XSS finding for a pentest report. Reply ONLY with JSON:',
      '{"severity":"critical|high|medium|low","reasoning":"...","description":"..."}',
      input.directives ? `Operator directives (weigh these in severity/description): ${input.directives}` : '',
      JSON.stringify({ context: input.context, payload: input.payload, url: input.url, parameter: input.parameter }),
    ].join('\n');
    const res = await this.messages(prompt, 512);
    const parsed = parseJsonObject<VulnClassification>(res.text);
    return {
      result: parsed ?? {
        severity: 'medium',
        reasoning: 'AI response unparseable; defaulted.',
        description: `XSS via ${input.parameter} on ${input.url}`,
      },
      tokensUsed: res.tokensUsed,
    };
  }

  async analyze(prompt: string, maxTokens = 1024): Promise<AIResponse> {
    return this.messages(prompt, maxTokens);
  }
}

function parseJsonArray(text: string): string[] {
  try {
    const cleaned = text.replace(/```json?|```/g, '').trim();
    const arr = JSON.parse(cleaned.slice(cleaned.indexOf('['), cleaned.lastIndexOf(']') + 1));
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(text: string): T | null {
  try {
    const cleaned = text.replace(/```json?|```/g, '').trim();
    return JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1)) as T;
  } catch {
    return null;
  }
}

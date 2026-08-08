import { BaseAIProvider, type AIResponse, type PayloadSuggestionRequest, type VulnClassification } from './base-provider.js';
import { HTTPClient } from '../../../utils/http-client.js';
import { resolveAISettings } from '../../../utils/settings-store.js';

/**
 * Generic OpenAI-compatible chat-completions provider. Backs both
 * Antigravity (tier 2) and DeepSeek (tier 3) — they share the API shape.
 * When constructed without explicit values, resolves from the settings
 * file (dashboard) → env vars → defaults, lazily on each call so saves
 * from the Settings page take effect on the next request.
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

  /** Overridable config accessors (lazy subclasses resolve per-call). */
  protected url(): string {
    return this.baseUrl;
  }

  protected key(): string {
    return this.apiKey;
  }

  protected modelName(): string {
    return this.model;
  }

  isAvailable(): boolean {
    return this.key().length > 0 && this.url().length > 0;
  }

  /** Create lazily-resolved variant (no constructor args). */
  static lazy(name: 'antigravity' | 'deepseek'): OpenAICompatibleProvider {
    return new LazyOpenAICompatibleProvider(name);
  }

  private async chat(prompt: string, maxTokens: number): Promise<AIResponse> {
    const res = await this.http.fetch(`${this.url().replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      timeoutMs: 30_000,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.key()}` },
      body: JSON.stringify({
        model: this.modelName(),
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
      req.directives ? `Operator directives (MUST follow): ${req.directives}.` : '',
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

  async classifyVuln(input: { context: string; payload: string; url: string; parameter: string; directives?: string }) {
    const res = await this.chat(
      `Classify this XSS finding. JSON only {"severity":"...","reasoning":"...","description":"..."}${
        input.directives ? `. Operator directives: ${input.directives}` : ''
      }: ${JSON.stringify({ context: input.context, payload: input.payload, url: input.url, parameter: input.parameter })}`,
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

/** Lazily resolves baseUrl/apiKey from the settings store on every call. */
class LazyOpenAICompatibleProvider extends OpenAICompatibleProvider {
  constructor(providerName: 'antigravity' | 'deepseek') {
    super(providerName, '', '', '');
  }

  private cfg(): { baseUrl: string; apiKey: string; model: string } {
    const s = resolveAISettings();
    return this.name === 'antigravity'
      ? { baseUrl: s.antigravityBaseUrl, apiKey: s.antigravityApiKey, model: 'antigravity-pro' }
      : { baseUrl: s.deepseekBaseUrl, apiKey: s.deepseekApiKey, model: 'deepseek-chat' };
  }

  protected override url(): string {
    return this.cfg().baseUrl;
  }

  protected override key(): string {
    return this.cfg().apiKey;
  }

  protected override modelName(): string {
    return this.cfg().model;
  }
}

/** Tier-2 factory. */
export function antigravityProvider(): OpenAICompatibleProvider {
  return OpenAICompatibleProvider.lazy('antigravity');
}

/** Tier-3 factory. */
export function deepseekProvider(): OpenAICompatibleProvider {
  return OpenAICompatibleProvider.lazy('deepseek');
}

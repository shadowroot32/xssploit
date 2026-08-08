import { BaseAIProvider, type AIResponse, type PayloadSuggestionRequest, type VulnClassification } from './base-provider.js';
import { HTTPClient } from '../../../utils/http-client.js';

/**
 * Local Ollama provider (tier 4) — zero-cost, offline fallback.
 */
export class OllamaProvider extends BaseAIProvider {
  readonly name = 'ollama';
  private readonly http = new HTTPClient();

  constructor(
    private readonly host = process.env.OLLAMA_BASE_URL ?? process.env.OLLAMA_HOST ?? 'http://localhost:11434',
    private readonly model = process.env.OLLAMA_MODEL ?? 'llama3.1:8b',
  ) {
    super();
  }

  isAvailable(): boolean {
    return true; // presence verified lazily on first call; failure → NoAI tier
  }

  private async generate(prompt: string): Promise<AIResponse> {
    const res = await this.http.fetch(`${this.host}/api/generate`, {
      method: 'POST',
      timeoutMs: 60_000,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt, stream: false }),
    });
    const json = JSON.parse(res.body) as { response?: string; eval_count?: number; prompt_eval_count?: number };
    return {
      text: json.response ?? '',
      tokensUsed: (json.eval_count ?? 0) + (json.prompt_eval_count ?? 0),
      provider: this.name,
    };
  }

  async suggestPayloads(req: PayloadSuggestionRequest) {
    const res = await this.generate(
      `XSS payloads for authorized test.${
        req.directives ? ` Directives (must follow): ${req.directives}.` : ''
      } Context: ${req.context}. JSON array of strings only, max ${req.max ?? 8}.`,
    );
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
    const res = await this.generate(
      `Classify XSS finding JSON {"severity","reasoning","description"}${
        input.directives ? ` considering operator directives: ${input.directives}` : ''
      }: ${JSON.stringify({ context: input.context, payload: input.payload, url: input.url, parameter: input.parameter })}`,
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

  analyze(prompt: string): Promise<AIResponse> {
    return this.generate(prompt);
  }
}

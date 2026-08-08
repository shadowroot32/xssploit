import type { InjectionContext, PayloadCategory, Severity } from '@xssploit/shared';

export interface PayloadSuggestionRequest {
  context: InjectionContext;
  /** Which chars survived encoding in the target (from reflection analysis). */
  intactSyntax: { angleBrackets: boolean; quotes: boolean; singleQuotes: boolean };
  /** Payloads already tried that were filtered/reflected-safely. */
  failedPayloads: string[];
  /** WAF fingerprint if detected. */
  waf?: string;
  /** Operator directives from ScanConfig.userPrompt — providers must honor these. */
  directives?: string;
  max?: number;
}

export interface VulnClassification {
  severity: Severity;
  reasoning: string;
  /** Suggested report description. */
  description: string;
}

export interface AIResponse {
  text: string;
  tokensUsed: number;
  provider: string;
}

/**
 * Contract every AI backend implements. The ProviderManager walks the
 * tier chain (Claude → Antigravity → DeepSeek → Ollama → NoAI) until one
 * answers.
 */
export abstract class BaseAIProvider {
  abstract readonly name: string;

  /** Cheap health/config check — no network call required for most. */
  abstract isAvailable(): boolean;

  /** Suggest context-appropriate payloads. */
  abstract suggestPayloads(req: PayloadSuggestionRequest): Promise<{ payloads: string[]; tokensUsed: number }>;

  /** Classify a confirmed finding (severity + report text). */
  abstract classifyVuln(input: {
    context: InjectionContext;
    payload: string;
    url: string;
    parameter: string;
    /** Operator directives from ScanConfig.userPrompt. */
    directives?: string;
  }): Promise<{ result: VulnClassification; tokensUsed: number }>;

  /** Free-form analysis (CSP review, response anomaly explanation). */
  abstract analyze(prompt: string, maxTokens?: number): Promise<AIResponse>;
}

export type { PayloadCategory };

import { BaseAIProvider } from './providers/base-provider.js';
import { ClaudeProvider } from './providers/claude-provider.js';
import { antigravityProvider, deepseekProvider } from './providers/openai-compatible-provider.js';
import { OllamaProvider } from './providers/ollama-provider.js';
import { NoAIProvider } from './providers/no-ai-provider.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('ai-providers');

/**
 * Owns the tier chain and the per-scan token budget. Every AI call goes
 * through `withProvider`, which walks down the chain on failure and stops
 * when the budget is exhausted.
 */
export class ProviderManager {
  private readonly chain: BaseAIProvider[];
  private tokensUsed = 0;
  /** Operator directives attached to every AI request this scan. */
  readonly directives?: string;

  constructor(private readonly maxTokens: number, enabled = true, directives?: string) {
    const trimmed = directives?.trim();
    this.directives = trimmed ? trimmed.slice(0, 2000) : undefined;
    this.chain = enabled
      ? [new ClaudeProvider(), antigravityProvider(), deepseekProvider(), new OllamaProvider(), new NoAIProvider()]
      : [new NoAIProvider()];
  }

  get budgetExhausted(): boolean {
    return this.tokensUsed >= this.maxTokens;
  }

  get used(): number {
    return this.tokensUsed;
  }

  /** Run an AI operation against the first healthy provider within budget. */
  async withProvider<T>(
    op: (provider: BaseAIProvider) => Promise<{ value: T; tokensUsed: number }>,
    fallback: () => T,
  ): Promise<T> {
    if (this.budgetExhausted) {
      logger.debug({ used: this.tokensUsed }, 'AI token budget exhausted — rule-based path');
      const noAi = this.chain[this.chain.length - 1]!;
      const res = await op(noAi).catch(() => ({ value: fallback(), tokensUsed: 0 }));
      return res.value;
    }

    for (const provider of this.chain) {
      if (!provider.isAvailable()) continue;
      try {
        const { value, tokensUsed } = await op(provider);
        this.tokensUsed += tokensUsed;
        return value;
      } catch (err) {
        logger.warn({ provider: provider.name, err: (err as Error).message }, 'AI provider failed, falling back');
      }
    }
    return fallback();
  }
}

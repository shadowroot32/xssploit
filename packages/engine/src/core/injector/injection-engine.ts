import type {
  DiscoveredEndpoint,
  Payload,
  ScanConfig,
  Vulnerability,
} from '@xssploit/shared';
import type { HTTPClient } from '../../utils/http-client.js';
import type { RateLimiter } from '../../network/rate-limiter.js';
import { ResponseAnalyzer } from '../analyzer/response-analyzer.js';
import { PayloadMutator } from './payload-mutator.js';
import { deliver } from './delivery-methods/index.js';
import { ProviderManager } from '../ai/provider-manager.js';
import { NoAIProvider } from '../ai/providers/no-ai-provider.js';
import { randomToken } from '../../utils/hash.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('injector');

export interface InjectionCallbacks {
  onVulnerability: (vuln: Omit<Vulnerability, 'id' | 'discoveredAt'>) => Promise<void>;
  onRequest?: () => void;
  isCancelled?: () => boolean;
}

/**
 * Active reflected-XSS engine. For each (endpoint, param):
 *  1. send a canary probe to learn reflection context + filter behavior
 *  2. pick context-appropriate payloads (library → AI → mutations)
 *  3. confirm: payload string present verbatim in an executable context
 */
export class InjectionEngine {
  private readonly analyzer = new ResponseAnalyzer();
  private readonly mutator = new PayloadMutator();
  private readonly noAi = new NoAIProvider();

  constructor(
    private readonly http: HTTPClient,
    private readonly limiter: RateLimiter,
    private readonly config: ScanConfig,
    private readonly ai: ProviderManager,
    private readonly authHeaders: Record<string, string> = {},
  ) {}

  async testEndpoint(
    endpoint: DiscoveredEndpoint,
    payloads: Payload[],
    cb: InjectionCallbacks,
  ): Promise<void> {
    for (const param of endpoint.params) {
      if (cb.isCancelled?.()) return;
      await this.testParam(endpoint, param, payloads, cb);
    }
  }

  private async testParam(
    endpoint: DiscoveredEndpoint,
    param: string,
    payloads: Payload[],
    cb: InjectionCallbacks,
  ): Promise<void> {
    // ── Step 1: canary probe ────────────────────────────────────────────
    const canary = `xss${randomToken(4)}`;
    const probe = `${canary}<>'"()`;
    await this.limiter.acquire();
    cb.onRequest?.();
    let analysis;
    try {
      const res = await deliver({ http: this.http, endpoint, param, payload: probe, authHeaders: this.authHeaders });
      analysis = this.analyzer.analyze(res, canary, probe);
    } catch {
      return; // endpoint unreachable with payload — skip
    }

    if (analysis.blocked) {
      logger.debug({ url: endpoint.url, param }, 'request blocked (WAF?)');
      return;
    }
    if (analysis.reflections.length === 0) return; // not reflected at all

    const context = analysis.reflections[0]!.context;
    const syntax = analysis.reflections[0]!.intactSyntax;
    if (!syntax.angleBrackets && context === 'html-body') return; // fully encoded → safe

    // ── Step 2: choose payloads for this context ────────────────────────
    const contextPayloads = payloads.filter(
      (p) => p.contexts.includes(context) || p.contexts.includes('unknown') || p.category === 'polyglot',
    );
    const library = (contextPayloads.length > 0 ? contextPayloads : payloads).slice(
      0,
      this.config.profile === 'quick' ? 12 : 40,
    );

    const aiSuggested = await this.ai.withProvider(
      async (provider) => {
        const r = await provider.suggestPayloads({
          context,
          intactSyntax: syntax,
          failedPayloads: [],
          directives: this.ai.directives,
          max: 6,
        });
        return { value: r.payloads, tokensUsed: r.tokensUsed };
      },
      () => [] as string[],
    );

    const queue: string[] = dedupe([...aiSuggested, ...library.map((p) => p.payload)]);

    // ── Step 3: inject until confirmed ──────────────────────────────────
    const failed: string[] = [];
    for (const payload of queue) {
      if (cb.isCancelled?.()) return;
      const hit = await this.tryPayload(endpoint, param, payload, context, cb);
      if (hit) return;
      failed.push(payload);

      // Escalate to mutations if the plain payload got encoded/filtered.
      if (failed.length <= 3) {
        for (const variant of this.mutator.mutate(payload, 4)) {
          if (cb.isCancelled?.()) return;
          const mutantHit = await this.tryPayload(endpoint, param, variant, context, cb);
          if (mutantHit) return;
        }
      }
    }

    // Last resort: rule-based escalation with full failure knowledge.
    const lastDitch = (await this.noAi.suggestPayloads({ context, intactSyntax: syntax, failedPayloads: failed, max: 4 }))
      .payloads;
    for (const payload of lastDitch) {
      if (cb.isCancelled?.()) return;
      const hit = await this.tryPayload(endpoint, param, payload, context, cb);
      if (hit) return;
    }
  }

  /** Deliver one payload; on reflection create the vulnerability record. */
  private async tryPayload(
    endpoint: DiscoveredEndpoint,
    param: string,
    payload: string,
    context: Vulnerability['evidence']['context'],
    cb: InjectionCallbacks,
  ): Promise<boolean> {
    const canary = `c${randomToken(3)}`;
    const tagged = `${payload}<!--${canary}-->`;
    await this.limiter.acquire();
    cb.onRequest?.();

    let res;
    try {
      res = await deliver({ http: this.http, endpoint, param, payload: tagged, authHeaders: this.authHeaders });
    } catch {
      return false;
    }

    // Confirmation: payload itself (not just canary) appears in an executable way.
    const executable =
      res.body.includes(payload) &&
      res.status < 400 &&
      looksExecutable(res.body, payload, context);
    if (!executable) return false;

    const classification = await this.ai.withProvider(
      async (provider) => {
        const r = await provider.classifyVuln({
          context,
          payload,
          url: endpoint.url,
          parameter: param,
          directives: this.ai.directives,
        });
        return { value: r.result, tokensUsed: r.tokensUsed };
      },
      () => ({
        severity: 'medium' as const,
        reasoning: 'rule-based default',
        description: `Reflected XSS via "${param}" at ${endpoint.url}`,
      }),
    );

    await cb.onVulnerability({
      scanId: '', // filled by Scanner
      type: 'reflected-xss',
      severity: classification.severity,
      confidence: 'confirmed',
      url: endpoint.url,
      title: `Reflected XSS in "${param}" (${endpoint.method} ${new URL(endpoint.url).pathname})`,
      description: classification.description,
      evidence: {
        payload,
        parameter: param,
        request: { method: endpoint.method, url: endpoint.url },
        responseSnippet: snippetAround(res.body, payload),
        context,
        executionProof: 'payload reflected verbatim in executable context',
      },
      score: scoreFor(classification.severity),
      remediation:
        'Context-encode all user input on output (HTML-encode in body, attribute-encode in attributes), adopt a strict CSP, and validate input server-side.',
      aiAnalysis: classification.reasoning,
    });
    logger.info({ url: endpoint.url, param }, 'reflected XSS confirmed');
    return true;
  }
}

/** Heuristic: is this occurrence of the payload in an executable position? */
function looksExecutable(body: string, payload: string, context: string): boolean {
  const idx = body.indexOf(payload);
  if (idx === -1) return false;
  const window = body.slice(Math.max(0, idx - 200), idx + payload.length + 200);
  switch (context) {
    case 'html-body':
    case 'svg':
      return /<[a-z][^>]*on\w+\s*=|<script|<svg|<img[^>]+onerror/i.test(window);
    case 'html-attribute':
    case 'html-attribute-unquoted':
      return /on\w+\s*=|"><|<\/[a-z]+>/i.test(window);
    case 'javascript-string':
    case 'javascript-code':
      return /alert\s*\(|confirm\s*\(|prompt\s*\(|<\/script>/i.test(window);
    case 'url':
      return /javascript:|data:text\/html/i.test(window);
    default:
      return true;
  }
}

function snippetAround(body: string, needle: string, radius = 200): string {
  const idx = body.indexOf(needle);
  if (idx === -1) return body.slice(0, radius * 2);
  return body.slice(Math.max(0, idx - radius), idx + needle.length + radius);
}

function scoreFor(severity: string): number {
  return { critical: 9.5, high: 7.5, medium: 5.5, low: 3.0, info: 1.0 }[severity] ?? 5.0;
}

function dedupe(list: string[]): string[] {
  return [...new Set(list)];
}

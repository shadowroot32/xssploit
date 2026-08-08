import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type {
  DiscoveredEndpoint,
  ScanConfig,
  ScanProgress,
  ScanResult,
  Vulnerability,
} from '@xssploit/shared';
import { HTTPClient } from './utils/http-client.js';
import { RateLimiter } from './network/rate-limiter.js';
import { Spider } from './core/crawler/spider.js';
import { InjectionEngine } from './core/injector/injection-engine.js';
import { PayloadLoader } from './core/injector/payload-loader.js';
import { ProviderManager } from './core/ai/provider-manager.js';
import { AuthManager } from './core/auth/auth-manager.js';
import { JSStaticAnalyzer, type TaintFlow } from './core/analyzer/js-static-analyzer.js';
import { TechDetector, type TechFingerprint } from './core/crawler/tech-detector.js';
import { CSPAnalyzer, type CspReport } from './core/analyzer/csp-analyzer.js';
import { CallbackPayloadGenerator } from './core/callback/payload-generator.js';
import { deliver } from './core/injector/delivery-methods/index.js';
import { BrowserManager } from './sandbox/browser/browser-manager.js';
import { NotificationManager } from './core/callback/notification.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('scanner');

export interface ScannerOptions {
  /** Repo-root payloads/ directory. */
  payloadsDir: string;
  /** Where blind hits should call home (https://cb.example.com). */
  callbackBase?: string;
  notifier?: NotificationManager;
  /** Enable Playwright DOM confirmation when available. Default true. */
  useSandbox?: boolean;
  onProgress?: (p: ScanProgress) => void;
  onVulnerability?: (v: Vulnerability) => void | Promise<void>;
}

/**
 * Scanner — the top-level orchestrator. One instance = one scan.
 *
 * Pipeline: auth → crawl → (per page: static JS taint analysis, CSP grade,
 * tech fingerprint) → active injection (reflected + blind seeding) →
 * optional browser-sandbox DOM confirmation → result.
 */
export class Scanner {
  readonly scanId = randomUUID();
  private readonly http = new HTTPClient();
  private readonly limiter: RateLimiter;
  private readonly ai: ProviderManager;
  private readonly startedAt = new Date().toISOString();
  private cancelled = false;
  private requests = 0;
  private readonly vulnerabilities: Vulnerability[] = [];

  constructor(
    private readonly config: ScanConfig,
    private readonly opts: ScannerOptions,
  ) {
    this.limiter = new RateLimiter(config.rateLimit, config.profile === 'stealth' ? 1500 : 0);
    this.ai = new ProviderManager(config.ai.maxTokens, config.ai.enabled);
  }

  cancel(): void {
    this.cancelled = true;
  }

  async run(): Promise<ScanResult> {
    const finish = (status: ScanResult['status']): ScanResult => ({
      scanId: this.scanId,
      config: this.config,
      status,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      stats: {
        pagesCrawled: this.progress.pagesCrawled,
        endpointsTested: this.progress.endpointsFound,
        requestsSent: this.requests,
        aiTokensUsed: this.ai.used,
        durationMs: Date.now() - new Date(this.startedAt).getTime(),
      },
      vulnerabilityIds: this.vulnerabilities.map((v) => v.id),
    });

    const timeoutHandle = setTimeout(() => {
      logger.warn('scan timeout reached — cancelling');
      this.cancel();
    }, this.config.timeout * 1000);
    timeoutHandle.unref?.();

    try {
      this.progress.currentActivity = 'authenticating';
      const authHeaders = await new AuthManager(this.http).resolveHeaders(this.config.auth);

      // ── Crawl + passive analysis ────────────────────────────────────────
      this.progress.currentActivity = 'crawling';
      const staticAnalyzer = new JSStaticAnalyzer();
      const techDetector = new TechDetector();
      const cspAnalyzer = new CSPAnalyzer();
      const spider = new Spider(this.http, this.limiter, this.config);
      const taintFlows: (TaintFlow & { page: string })[] = [];
      let tech: TechFingerprint = { libraries: [] };
      let csp: CspReport = { present: false, findings: [], allowsInlineScript: true };

      const crawl = await spider.crawl(async (pageUrl, html) => {
        this.progress.pagesCrawled += 1;
        this.emit();
        for (const flow of staticAnalyzer.analyze(html)) taintFlows.push({ ...flow, page: pageUrl });
      }, authHeaders);

      this.progress.endpointsFound = crawl.endpoints.length;
      this.emit();

      // Passive fingerprint of the front page.
      try {
        this.limiter.acquire().catch(() => undefined);
        const front = await this.http.fetch(this.config.targetUrl, { headers: authHeaders });
        tech = techDetector.detect(front, front.body);
        csp = cspAnalyzer.analyze(front.headers['content-security-policy']);
        if (tech.waf) logger.info({ waf: tech.waf }, 'WAF detected — stealth pacing recommended');
      } catch {
        /* target unreachable at the end — findings so far still valid */
      }

      // Record statically-detected DOM flows as potential findings.
      if (this.config.types.dom) {
        for (const flow of taintFlows.filter((f) => f.confidence === 'high')) {
          await this.addVulnerability({
            scanId: this.scanId,
            type: 'dom-xss',
            severity: 'medium',
            confidence: 'potential',
            url: flow.page,
            title: `Potential DOM XSS: ${flow.source} → ${flow.sink}`,
            description: `Static taint analysis found ${flow.source} flowing into ${flow.sink} (${flow.page}:${flow.line}).`,
            evidence: {
              payload: flow.snippet,
              parameter: flow.via ?? flow.source,
              request: { method: 'GET', url: flow.page },
              context: 'javascript-code',
              executionProof: 'static taint flow (sandbox confirmation pending)',
            },
            score: 5.0,
            remediation:
              'Avoid inserting location.* / postMessage data into innerHTML/eval. Use textContent, sanitize with DOMPurify, and validate URLs.',
          });
        }
      }

      // ── Active injection ────────────────────────────────────────────────
      const payloads = new PayloadLoader(this.opts.payloadsDir).loadAll(this.config.payloadCategories);
      const injector = new InjectionEngine(this.http, this.limiter, this.config, this.ai, authHeaders);
      const callbacks = {
        onVulnerability: async (v: Omit<Vulnerability, 'id' | 'discoveredAt'>) => this.addVulnerability(v),
        onRequest: () => {
          this.requests += 1;
        },
        isCancelled: () => this.cancelled,
      };

      if (this.config.types.reflected) {
        this.progress.currentActivity = 'injecting payloads';
        for (const endpoint of crawl.endpoints) {
          if (this.cancelled) break;
          await injector.testEndpoint(endpoint, payloads, callbacks);
          this.emit();
        }
      }

      // ── Blind XSS seeding ───────────────────────────────────────────────
      if (this.config.types.blind && this.config.blindXss.enabled && this.opts.callbackBase) {
        this.progress.currentActivity = 'seeding blind-XSS payloads';
        const generator = new CallbackPayloadGenerator(this.opts.callbackBase);
        for (const endpoint of crawl.endpoints) {
          if (this.cancelled) break;
          for (const param of endpoint.params.slice(0, 5)) {
            const blind = generator.generate({ withExfil: false, tag: this.scanId });
            await this.limiter.acquire();
            this.requests += 1;
            try {
              await deliver({ http: this.http, endpoint, param, payload: blind.payload, authHeaders });
            } catch {
              /* seeding failure is non-fatal */
            }
          }
        }
        logger.info('blind payloads seeded — watch the callback server for hits');
      }

      // ── Browser sandbox DOM confirmation ────────────────────────────────
      const useSandbox = this.opts.useSandbox !== false && this.config.types.dom;
      if (useSandbox && !this.cancelled) {
        this.progress.currentActivity = 'DOM sandbox analysis';
        const browser = new BrowserManager();
        if (await browser.isAvailable()) {
          for (const flow of taintFlows.filter((f) => f.confidence === 'high').slice(0, 10)) {
            if (this.cancelled) break;
            const probeUrl = withHashProbe(flow.page);
            const obs = await browser.observe(probeUrl, 3000, authHeaders);
            this.requests += 1;
            if (obs.dialogFired || obs.sinkEvents.length > 0) {
              // Upgrade the static potential finding to probable/confirmed.
              const existing = this.vulnerabilities.find(
                (v) => v.url === flow.page && v.type === 'dom-xss',
              );
              if (existing) {
                existing.confidence = obs.dialogFired ? 'confirmed' : 'probable';
                existing.evidence.executionProof = obs.dialogFired
                  ? `payload executed in browser sandbox (${obs.sinkEvents.length} sink events)`
                  : `${obs.sinkEvents.length} sink events observed in sandbox`;
                if (obs.dialogFired) existing.severity = 'high';
                existing.score = obs.dialogFired ? 7.5 : 6.0;
              }
            }
          }
          await browser.close();
        }
      }

      this.progress.status = this.cancelled ? 'cancelled' : 'done';
      this.progress.percent = 100;
      this.progress.currentActivity = 'finished';
      this.emit();
      return finish(this.progress.status as ScanResult['status']);
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'scan failed');
      this.progress.status = 'failed';
      this.progress.error = (err as Error).message;
      this.emit();
      return finish('failed');
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  // ── internals ──────────────────────────────────────────────────────────

  private progress: ScanProgress = {
    scanId: this.scanId,
    status: 'running',
    pagesCrawled: 0,
    endpointsFound: 0,
    requestsSent: 0,
    vulnsFound: 0,
    percent: 0,
    currentActivity: 'starting',
    startedAt: this.startedAt,
    updatedAt: this.startedAt,
  };

  private async addVulnerability(v: Omit<Vulnerability, 'id' | 'discoveredAt'>): Promise<void> {
    // Dedupe: same type + url + parameter already recorded → skip.
    const dup = this.vulnerabilities.some(
      (x) => x.type === v.type && x.url === v.url && x.evidence.parameter === v.evidence.parameter,
    );
    if (dup) return;

    const vuln: Vulnerability = {
      ...v,
      id: randomUUID(),
      discoveredAt: new Date().toISOString(),
    };
    this.vulnerabilities.push(vuln);
    this.progress.vulnsFound = this.vulnerabilities.length;
    this.emit();

    await this.opts.onVulnerability?.(vuln);
    if (this.config.notify) {
      await this.opts.notifier?.notify({
        kind: 'vuln-found',
        scanId: this.scanId,
        message: `${vuln.severity.toUpperCase()}: ${vuln.title}`,
        severity: vuln.severity,
        url: vuln.url,
        timestamp: vuln.discoveredAt,
      });
    }
  }

  private emit(): void {
    this.progress.requestsSent = this.requests;
    this.progress.updatedAt = new Date().toISOString();
    this.progress.percent = estimatePercent(this.progress);
    this.opts.onProgress?.({ ...this.progress });
  }
}

function estimatePercent(p: ScanProgress): number {
  if (p.status === 'done' || p.status === 'failed' || p.status === 'cancelled') return 100;
  // Crawl is the first ~40%, injection the rest — best effort.
  const crawlPart = Math.min(40, p.pagesCrawled);
  const injectPart = Math.min(55, p.vulnsFound > 0 ? 55 : p.endpointsFound > 0 ? 30 : 0);
  return Math.min(99, 5 + crawlPart + injectPart);
}

function withHashProbe(pageUrl: string): string {
  const u = new URL(pageUrl);
  u.hash = 'xssploit-probe-<img src=x onerror=alert(1)>';
  return u.toString();
}

/** Convenience factory used by the CLI and API. */
export function defaultScanConfig(partial: Partial<ScanConfig> & { targetUrl: string }): ScanConfig {
  return {
    program: undefined,
    profile: 'quick',
    types: { reflected: true, dom: true, stored: false, blind: false },
    inScope: [],
    outOfScope: [],
    auth: { method: 'none' },
    rateLimit: 20,
    maxPages: 50,
    crawlDepth: 2,
    timeout: 900,
    payloadCategories: [],
    ai: { enabled: true, maxTokens: Number(process.env.AI_MAX_TOKENS_PER_SCAN ?? 50_000) },
    blindXss: { enabled: false, callbackBase: process.env.CALLBACK_DOMAIN ? `http://${process.env.CALLBACK_DOMAIN}` : undefined },
    notify: false,
    respectRobots: true,
    ...partial,
  };
}

export function payloadsRootFrom(moduleUrl: string): string {
  // packages/engine/src/scanner.ts → repo root payloads/
  return path.resolve(path.dirname(new URL(moduleUrl).pathname), '..', '..', '..', '..', 'payloads');
}

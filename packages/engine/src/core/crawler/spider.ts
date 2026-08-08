import type { DiscoveredEndpoint, ScanConfig } from '@xssploit/shared';
import type { HTTPClient } from '../../utils/http-client.js';
import type { RateLimiter } from '../../network/rate-limiter.js';
import { ScopeManager } from '../scope/scope-manager.js';
import { LinkExtractor } from './link-extractor.js';
import { FormDiscoverer } from './form-discoverer.js';
import { ParameterExtractor } from './parameter-extractor.js';
import { SitemapParser } from './sitemap-parser.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('spider');

export interface CrawlResult {
  pagesVisited: number;
  endpoints: DiscoveredEndpoint[];
  /** Raw HTML of visited pages, reused later for stored-XSS checks. */
  pages: Map<string, string>;
}

/**
 * Breadth-first crawler bounded by scope, depth, page cap and rate limit.
 * Emits both pages and deduplicated fuzzable endpoints (query params + forms).
 */
export class Spider {
  private readonly scope: ScopeManager;
  private readonly links = new LinkExtractor();
  private readonly forms = new FormDiscoverer();
  private readonly params = new ParameterExtractor();
  private readonly sitemap: SitemapParser;

  constructor(
    private readonly http: HTTPClient,
    private readonly limiter: RateLimiter,
    private readonly config: ScanConfig,
  ) {
    this.scope = new ScopeManager(config.targetUrl, config.inScope, config.outOfScope);
    this.sitemap = new SitemapParser(http);
  }

  async crawl(
    onPage?: (url: string, html: string) => Promise<void>,
    authHeaders: Record<string, string> = {},
  ): Promise<CrawlResult> {
    const origin = new URL(this.config.targetUrl).origin;
    const queue: { url: string; depth: number }[] = [{ url: this.config.targetUrl, depth: 0 }];
    const visited = new Set<string>();
    const pages = new Map<string, string>();
    const endpoints: DiscoveredEndpoint[] = [];

    for (const seed of await this.sitemap.seedUrls(origin)) {
      if (this.scope.isAllowed(seed)) queue.push({ url: seed, depth: 1 });
    }

    while (queue.length > 0 && visited.size < this.config.maxPages) {
      const item = queue.shift()!;
      const normalized = normalize(item.url);
      if (visited.has(normalized) || item.depth > this.config.crawlDepth) continue;
      if (!this.scope.isAllowed(normalized)) continue;
      visited.add(normalized);

      await this.limiter.acquire();
      let html: string;
      try {
        const res = await this.http.fetch(normalized, { headers: authHeaders });
        const rawContentType = res.headers['content-type'];
        const contentType = Array.isArray(rawContentType)
          ? (rawContentType[0] ?? '')
          : (rawContentType ?? '');
        if (!contentType.includes('text/html')) continue;
        html = res.body;
      } catch {
        continue;
      }

      pages.set(normalized, html);
      if (onPage) await onPage(normalized, html);

      const foundForms = this.forms.discover(html, normalized);
      endpoints.push(...this.forms.toEndpoints(foundForms));

      // The target URL itself may carry fuzzable query params even when the
      // page body contains no links or forms (single-endpoint test targets,
      // API-style entry points).
      const selfEp = this.params.fromUrl(normalized);
      if (selfEp) endpoints.push(selfEp);

      for (const link of this.links.extract(html, normalized)) {
        const ep = this.params.fromUrl(link);
        if (ep) endpoints.push(ep);
        if (this.scope.isAllowed(link) && !visited.has(normalize(link)) && item.depth + 1 <= this.config.crawlDepth) {
          queue.push({ url: link, depth: item.depth + 1 });
        }
      }

      logger.debug({ visited: visited.size, queued: queue.length }, 'crawl progress');
    }

    const merged = this.params.merge(endpoints);
    logger.info({ pages: visited.size, endpoints: merged.length }, 'crawl finished');
    return { pagesVisited: visited.size, endpoints: merged, pages };
  }
}

function normalize(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    // Sort query params so ?a=1&b=2 and ?b=2&a=1 dedupe.
    u.searchParams.sort();
    return u.toString();
  } catch {
    return url;
  }
}

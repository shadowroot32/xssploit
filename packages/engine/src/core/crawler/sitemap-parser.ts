import type { HTTPClient } from '../../utils/http-client.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('sitemap');

/**
 * Pull seed URLs from robots.txt sitemaps + sitemap.xml. Failures are
 * non-fatal — sitemaps are a bonus, not a requirement.
 */
export class SitemapParser {
  constructor(private readonly http: HTTPClient) {}

  async seedUrls(origin: string): Promise<string[]> {
    const urls = new Set<string>();
    const candidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];

    try {
      const robots = await this.http.fetch(`${origin}/robots.txt`, { timeoutMs: 8_000 });
      for (const line of robots.body.split('\n')) {
        const m = line.match(/^sitemap:\s*(\S+)/i);
        if (m?.[1]) candidates.push(m[1].trim());
      }
    } catch {
      logger.debug({ origin }, 'no robots.txt');
    }

    for (const sm of candidates.slice(0, 4)) {
      try {
        const res = await this.http.fetch(sm, { timeoutMs: 8_000 });
        for (const loc of res.body.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) {
          if (loc[1]) urls.add(loc[1].trim());
        }
      } catch {
        /* missing/invalid sitemap */
      }
    }

    return [...urls].slice(0, 1000);
  }
}

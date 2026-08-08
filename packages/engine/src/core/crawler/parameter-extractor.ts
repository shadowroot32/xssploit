import type { DiscoveredEndpoint } from '@xssploit/shared';

/**
 * Extract fuzzable parameters from URLs: query string keys, plus common
 * "param in path" patterns (/user/123/edit → id-ish segments are left alone,
 * only query params are fuzzed — path injection has too high a breakage rate).
 */
export class ParameterExtractor {
  fromUrl(url: string): DiscoveredEndpoint | null {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return null;
    }
    const params = [...new Set([...u.searchParams.keys()])];
    if (params.length === 0) return null;
    // Strip existing query values; injector sets its own.
    const base = `${u.origin}${u.pathname}`;
    return { url: base, method: 'GET', params, source: 'crawl' };
  }

  /** Merge duplicate endpoints (same url+method) by unioning their params. */
  merge(endpoints: DiscoveredEndpoint[]): DiscoveredEndpoint[] {
    const map = new Map<string, DiscoveredEndpoint>();
    for (const ep of endpoints) {
      const key = `${ep.method} ${ep.url}`;
      const existing = map.get(key);
      if (existing) {
        existing.params = [...new Set([...existing.params, ...ep.params])];
      } else {
        map.set(key, { ...ep, params: [...ep.params] });
      }
    }
    return [...map.values()];
  }
}

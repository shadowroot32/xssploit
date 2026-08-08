import { parseHTML } from 'linkedom';

/**
 * Extract same-origin navigable URLs from an HTML document.
 * Handles <a href>, <link href>, <iframe src> and common meta refreshes.
 */
export class LinkExtractor {
  extract(html: string, baseUrl: string): string[] {
    const { document } = parseHTML(html);
    const found = new Set<string>();

    const push = (raw: string | null | undefined) => {
      if (!raw) return;
      try {
        const u = new URL(raw, baseUrl);
        if (u.protocol === 'http:' || u.protocol === 'https:') {
          u.hash = '';
          found.add(u.toString());
        }
      } catch {
        /* malformed link */
      }
    };

    for (const el of document.querySelectorAll('a[href], link[href], area[href]')) {
      push(el.getAttribute('href'));
    }
    for (const el of document.querySelectorAll('iframe[src], frame[src]')) {
      push(el.getAttribute('src'));
    }
    const refresh = document.querySelector('meta[http-equiv="refresh" i]');
    const content = refresh?.getAttribute('content');
    const m = content?.match(/url\s*=\s*([^;]+)/i);
    if (m) push(m[1]?.trim());

    return [...found];
  }
}

import type { HttpResponse } from '../../utils/http-client.js';

export interface TechFingerprint {
  server?: string;
  framework?: string;
  cms?: string;
  waf?: string;
  libraries: string[];
}

/**
 * Cheap passive tech/WAF fingerprinting from headers + HTML. Used to
 * pick payload sets (e.g. framework-specific) and to flag a WAF early
 * so the scan can slow down instead of getting banned.
 */
export class TechDetector {
  detect(response: HttpResponse, html: string): TechFingerprint {
    const h = response.headers;
    const out: TechFingerprint = { libraries: [] };

    const server = str(h['server']);
    if (server) out.server = server;
    const powered = str(h['x-powered-by']);
    if (powered) out.framework = powered;

    if (str(h['x-generator'])?.match(/wordpress/i) || html.includes('wp-content')) out.cms = 'WordPress';
    if (html.includes('Drupal.settings')) out.cms = 'Drupal';
    if (html.includes('ng-app') || html.includes('data-ng-')) out.framework = 'AngularJS';
    if (html.includes('__NEXT_DATA__')) out.framework = 'Next.js';
    if (html.includes('data-reactroot') || html.includes('__REACT')) out.framework ??= 'React';
    if (html.includes('data-v-') && html.includes('vue')) out.framework ??= 'Vue';

    // WAF hints
    const wafHeaders: [string, RegExp, string][] = [
      ['server', /cloudflare/i, 'Cloudflare'],
      ['server', /awselb|amazon/i, 'AWS ELB'],
      ['x-sucuri-id', /.*/, 'Sucuri'],
      ['x-cdn', /akamai/i, 'Akamai'],
      ['x-mod-security', /.*/, 'ModSecurity'],
    ];
    for (const [header, re, name] of wafHeaders) {
      const value = str(h[header]);
      if (value !== undefined && re.test(value)) {
        out.waf = name;
        break;
      }
    }
    if (!out.waf && response.status === 403 && /access denied|blocked|forbidden/i.test(html)) {
      out.waf = 'generic-403-filter';
    }

    for (const m of html.matchAll(/(?:src|href)="[^"]*?([a-z0-9.-]+)[.-](\d+\.\d+(?:\.\d+)?)[.-]?(?:min\.)?js"/gi)) {
      if (m[1]) out.libraries.push(`${m[1]}@${m[2]}`);
    }

    return out;
  }
}

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

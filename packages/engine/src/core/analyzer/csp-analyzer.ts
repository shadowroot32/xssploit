export interface CspFinding {
  directive: string;
  issue: string;
  severity: 'high' | 'medium' | 'low';
}

export interface CspReport {
  present: boolean;
  policy?: string;
  findings: CspFinding[];
  /** Overall: can injected inline script run under this policy? */
  allowsInlineScript: boolean;
}

/**
 * Parses and grades Content-Security-Policy headers. Findings feed the
 * report (weak CSP noted even without a bypass) and the bypass engine.
 */
export class CSPAnalyzer {
  analyze(headerValue: string | string[] | undefined): CspReport {
    const header = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!header) return { present: false, findings: [], allowsInlineScript: true };

    const directives = new Map<string, string[]>();
    for (const part of header.split(';')) {
      const [name, ...values] = part.trim().split(/\s+/);
      if (name) directives.set(name.toLowerCase(), values);
    }

    const findings: CspFinding[] = [];
    const scriptSrc = directives.get('script-src') ?? directives.get('default-src') ?? [];

    const has = (v: string) => scriptSrc.includes(v);

    if (has("'unsafe-inline'")) {
      findings.push({ directive: 'script-src', issue: "'unsafe-inline' permits inline scripts/event handlers", severity: 'high' });
    }
    if (has("'unsafe-eval'")) {
      findings.push({ directive: 'script-src', issue: "'unsafe-eval' permits eval()/new Function()", severity: 'medium' });
    }
    if (has('*') || scriptSrc.some((v) => v === 'https:' || v === 'http:')) {
      findings.push({ directive: 'script-src', issue: 'Wildcard/scheme source allows scripts from any host', severity: 'high' });
    }
    if (scriptSrc.some((v) => /googleapis\.com|cloudflare\.com|unpkg\.com|jsdelivr/i.test(v))) {
      findings.push({
        directive: 'script-src',
        issue: 'Allows CDN hosts known to serve attacker-controllable content (JSONP/Angular)',
        severity: 'medium',
      });
    }
    if (!directives.has('object-src') && !directives.has('default-src')) {
      findings.push({ directive: 'object-src', issue: 'object-src not set — plugin content unrestricted', severity: 'low' });
    }
    if (!directives.has('base-uri')) {
      findings.push({ directive: 'base-uri', issue: 'base-uri not set — <base> tag injection possible', severity: 'low' });
    }
    if (scriptSrc.some((v) => v.startsWith("'nonce-") || v.startsWith("'sha"))) {
      // Nonces/hashes are strong unless inline is also allowed.
      if (has("'unsafe-inline'")) {
        findings.push({ directive: 'script-src', issue: "nonce/hash combined with 'unsafe-inline' defeats the nonce", severity: 'high' });
      }
    }

    return {
      present: true,
      policy: header,
      findings,
      allowsInlineScript: has("'unsafe-inline'") || has('*') || scriptSrc.length === 0,
    };
  }
}

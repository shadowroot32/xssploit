/**
 * Input validation helpers shared by CLI, API and engine.
 */

/** Strict http(s) URL check. Returns the parsed URL or null. */
export function parseHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

export function validateUrl(raw: string): boolean {
  return parseHttpUrl(raw) !== null;
}

/**
 * Scope test used by the crawler/scope manager.
 * `scopeEntry` may be a bare host ("example.com"), a wildcard suffix
 * ("*.example.com") or a full origin ("https://app.example.com:8443").
 */
export function isInScope(targetUrl: string, scope: string[]): boolean {
  const url = parseHttpUrl(targetUrl);
  if (!url || scope.length === 0) return false;
  const host = url.hostname.toLowerCase();

  return scope.some((entry) => {
    const e = entry.trim().toLowerCase();
    if (!e) return false;
    if (e.startsWith('*.')) {
      const suffix = e.slice(2);
      return host === suffix || host.endsWith(`.${suffix}`);
    }
    const asUrl = parseHttpUrl(e);
    if (asUrl) return asUrl.host === url.host;
    return host === e;
  });
}

/** True when the URL matches any out-of-scope regex (logout, delete, …). */
export function isOutOfScope(targetUrl: string, outOfScopePatterns: string[]): boolean {
  return outOfScopePatterns.some((pattern) => {
    try {
      return new RegExp(pattern, 'i').test(targetUrl);
    } catch {
      // Invalid regex in config — treat literally.
      return targetUrl.toLowerCase().includes(pattern.toLowerCase());
    }
  });
}

/** Payload sanity: non-empty, length-capped single string. */
export function validatePayload(payload: string, maxLength = 4096): boolean {
  return typeof payload === 'string' && payload.length > 0 && payload.length <= maxLength;
}

/** Very small email check for webhook/alert routing forms. */
export function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

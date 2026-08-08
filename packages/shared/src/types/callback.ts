/**
 * Blind-XSS callback types — data received when a blind payload fires
 * on a target you are authorized to test.
 */

export interface BlindXssCallbackHit {
  id: string;
  /** Token embedded in the payload; ties the hit back to a scan + injection point. */
  token: string;
  scanId?: string;
  /** URL where the payload executed (victim page). */
  originUrl?: string;
  /** HTTP Referer header of the callback request. */
  referer?: string;
  /** Victim browser user agent. */
  userAgent?: string;
  /** Cookies readable via document.cookie (non-HttpOnly) — PoC evidence only. */
  cookies?: string;
  /** document.location.href at execution time. */
  location?: string;
  /** Page title at execution time. */
  title?: string;
  /** DOM snapshot excerpt (truncated server-side). */
  domSnippet?: string;
  /** Screenshot (base64 data URL, truncated) if the payload captured one. */
  screenshot?: string;
  /** Extra JSON payload fields. */
  extra?: Record<string, unknown>;
  receivedAt: string;
  remoteAddr?: string;
}

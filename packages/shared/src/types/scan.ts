/**
 * Scan lifecycle types shared by engine, API, CLI and dashboard.
 */

export type ScanStatus = 'queued' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled';

export type ScanProfileName = 'quick' | 'deep' | 'stealth' | 'dom-only' | 'blind' | 'api';

export type ScanMode = 'active' | 'passive' | 'dom';

/** Which XSS classes the scanner should test for. */
export interface ScanTypeSelection {
  reflected: boolean;
  dom: boolean;
  stored: boolean;
  blind: boolean;
}

/** Optional authentication material for authenticated scanning. */
export interface ScanAuth {
  method: 'none' | 'cookie' | 'bearer' | 'form-login';
  /** Raw Cookie header value when method = cookie. */
  cookie?: string;
  /** Bearer token when method = bearer. */
  token?: string;
  /** Form login details when method = form-login. */
  loginUrl?: string;
  usernameField?: string;
  passwordField?: string;
  username?: string;
  password?: string;
}

/** Full configuration for one scan run. */
export interface ScanConfig {
  targetUrl: string;
  /** Human label, e.g. the bug-bounty program name. Stored for reporting. */
  program?: string;
  profile: ScanProfileName;
  types: ScanTypeSelection;
  /** Hosts/paths allowed to be crawled. Defaults to the target origin. */
  inScope: string[];
  /** Regex strings that must never be requested (logout, destructive endpoints). */
  outOfScope: string[];
  auth: ScanAuth;
  /** Requests per second ceiling (adaptive limiter may go lower). */
  rateLimit: number;
  maxPages: number;
  crawlDepth: number;
  /** Wall-clock timeout for the whole scan, seconds. */
  timeout: number;
  /** Payload categories to use; empty = all applicable. */
  payloadCategories: string[];
  /** AI assistance on/off + token ceiling. */
  ai: { enabled: boolean; maxTokens: number };
  /** Blind XSS: inject callback payloads tagging this scan. */
  blindXss: { enabled: boolean; callbackBase?: string };
  /** Notify personal webhook channels on findings. */
  notify: boolean;
  respectRobots: boolean;
  /**
   * Free-form operator directives injected into every AI prompt
   * ("focus on search params", "target runs React", …). Also used by the
   * rule-based fallback for keyword hints. Printed into reports for audit.
   */
  userPrompt?: string;
}

export interface ScanProgress {
  scanId: string;
  status: ScanStatus;
  pagesCrawled: number;
  endpointsFound: number;
  requestsSent: number;
  vulnsFound: number;
  /** 0–100 best-effort estimate. */
  percent: number;
  currentActivity: string;
  startedAt: string;
  updatedAt: string;
  error?: string;
}

export interface ScanResult {
  scanId: string;
  config: ScanConfig;
  status: ScanStatus;
  startedAt: string;
  finishedAt?: string;
  stats: {
    pagesCrawled: number;
    endpointsTested: number;
    requestsSent: number;
    aiTokensUsed: number;
    durationMs: number;
  };
  vulnerabilityIds: string[];
}

/** A crawlable/testable URL + parameter set discovered by the crawler. */
export interface DiscoveredEndpoint {
  url: string;
  method: 'GET' | 'POST';
  /** Query/body parameter names that accept user input. */
  params: string[];
  /** Where the endpoint was found (page URL, form action, JS, sitemap). */
  source: 'crawl' | 'form' | 'js' | 'sitemap';
  /** Content type for POST bodies. */
  contentType?: 'form' | 'json';
}

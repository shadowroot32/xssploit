import type { ScanConfig, ScanProfileName } from '../types/scan.js';

type ProfileDefaults = Pick<
  ScanConfig,
  'rateLimit' | 'maxPages' | 'crawlDepth' | 'timeout' | 'types' | 'respectRobots'
> & { description: string };

/**
 * Built-in scan profiles. Values are defaults — every field can be
 * overridden per-scan from the CLI or dashboard.
 */
export const SCAN_PROFILES: Record<ScanProfileName, ProfileDefaults> = {
  quick: {
    description: 'Fast reflected-XSS sweep, top payload set, shallow crawl.',
    rateLimit: 20,
    maxPages: 50,
    crawlDepth: 2,
    timeout: 900,
    respectRobots: true,
    types: { reflected: true, dom: false, stored: false, blind: false },
  },
  deep: {
    description: 'Full crawl + all XSS classes + AI-assisted payload selection.',
    rateLimit: 10,
    maxPages: 500,
    crawlDepth: 5,
    timeout: 7200,
    respectRobots: true,
    types: { reflected: true, dom: true, stored: true, blind: true },
  },
  stealth: {
    description: 'Low-and-slow, jittered requests, conservative payload set.',
    rateLimit: 2,
    maxPages: 200,
    crawlDepth: 4,
    timeout: 14400,
    respectRobots: true,
    types: { reflected: true, dom: true, stored: false, blind: true },
  },
  'dom-only': {
    description: 'Browser-sandbox DOM analysis only (taint tracking, no active injection).',
    rateLimit: 10,
    maxPages: 100,
    crawlDepth: 3,
    timeout: 3600,
    respectRobots: true,
    types: { reflected: false, dom: true, stored: false, blind: false },
  },
  blind: {
    description: 'Seed callback-tagged payloads into every input; findings arrive via callbacks.',
    rateLimit: 5,
    maxPages: 300,
    crawlDepth: 4,
    timeout: 7200,
    respectRobots: true,
    types: { reflected: false, dom: false, stored: true, blind: true },
  },
  api: {
    description: 'JSON/REST endpoints: parameter fuzzing with JSON-aware payloads.',
    rateLimit: 15,
    maxPages: 200,
    crawlDepth: 2,
    timeout: 3600,
    respectRobots: false,
    types: { reflected: true, dom: false, stored: true, blind: false },
  },
};

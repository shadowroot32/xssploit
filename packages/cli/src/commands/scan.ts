import { defineCommand } from 'citty';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { Scanner, defaultScanConfig, ReportBuilder } from '@xssploit/engine';
import type { ScanConfig, Vulnerability } from '@xssploit/shared';
import { SCAN_PROFILES } from '@xssploit/shared';

const SEV_COLOR: Record<string, string> = {
  critical: '\x1b[95m',
  high: '\x1b[91m',
  medium: '\x1b[93m',
  low: '\x1b[92m',
  info: '\x1b[96m',
};
const R = '\x1b[0m';

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
}

export const scanCommand = defineCommand({
  meta: { name: 'scan', description: 'Run an XSS scan against an authorized target' },
  args: {
    url: { type: 'positional', description: 'Target URL (https://app.example.com)', required: true },
    program: { type: 'string', description: 'Bug bounty program name (audit trail)' },
    profile: { type: 'string', description: `Profile: ${Object.keys(SCAN_PROFILES).join('|')}`, default: 'quick' },
    types: { type: 'string', description: 'Comma list: reflected,dom,stored,blind' },
    'rate-limit': { type: 'string', description: 'Requests/sec', default: '20' },
    'max-pages': { type: 'string', description: 'Crawl page budget' },
    'crawl-depth': { type: 'string', description: 'Crawl link depth' },
    timeout: { type: 'string', description: 'Scan timeout (seconds)' },
    auth: { type: 'string', description: 'Cookie header value for authenticated scans' },
    categories: { type: 'string', description: 'Payload categories (comma), empty = all' },
    'no-ai': { type: 'boolean', description: 'Disable AI analysis' },
    blind: { type: 'boolean', description: 'Seed blind-XSS payloads (requires CALLBACK_DOMAIN)' },
    'callback-base': { type: 'string', description: 'Callback base URL, e.g. http://cb.example.com' },
    'out-dir': { type: 'string', description: 'Report output directory', default: '' },
    prompt: { type: 'string', description: 'AI directives, e.g. "focus on search params; target runs React"' },
    interactive: { type: 'boolean', description: 'Ask for AI directives before the scan starts', alias: 'i' },
    json: { type: 'boolean', description: 'Print machine-readable JSON summary' },
  },
  async run({ args }) {
    const typeSet = new Set((args.types ?? 'reflected,dom').split(',').map((s) => s.trim()));
    const profile = args.profile as ScanConfig['profile'];
    if (!(profile in SCAN_PROFILES)) {
      console.error(`unknown profile "${args.profile}" — use: ${Object.keys(SCAN_PROFILES).join(', ')}`);
      process.exit(2);
    }

    // Operator directives: --prompt wins; --interactive asks before anything runs.
    let userPrompt = args.prompt?.trim() || undefined;
    if (!userPrompt && args.interactive) {
      userPrompt = await askDirectives();
    }
    if (userPrompt && userPrompt.length > 2000) {
      console.error('⚠️  directives too long (>2000 chars) — truncating');
      userPrompt = userPrompt.slice(0, 2000);
    }

    const config = defaultScanConfig({
      targetUrl: args.url,
      program: args.program,
      profile,
      types: {
        reflected: typeSet.has('reflected'),
        dom: typeSet.has('dom'),
        stored: typeSet.has('stored'),
        blind: args.blind || typeSet.has('blind'),
      },
      auth: args.auth ? { method: 'cookie', cookie: args.auth } : { method: 'none' },
      rateLimit: Number(args['rate-limit']) || 20,
      maxPages: args['max-pages'] ? Number(args['max-pages']) : SCAN_PROFILES[profile].maxPages,
      crawlDepth: args['crawl-depth'] ? Number(args['crawl-depth']) : SCAN_PROFILES[profile].crawlDepth,
      timeout: args.timeout ? Number(args.timeout) : SCAN_PROFILES[profile].timeout,
      payloadCategories: args.categories ? args.categories.split(',').map((s) => s.trim()) : [],
      ai: { enabled: !args['no-ai'], maxTokens: 50_000 },
      blindXss: {
        enabled: args.blind || typeSet.has('blind'),
        callbackBase: args['callback-base'],
      },
      userPrompt,
    });

    if (config.types.blind && !config.blindXss.callbackBase) {
      console.error('⚠️  blind mode requires --callback-base (or CALLBACK_DOMAIN env) — disabling blind seeding');
      config.blindXss.enabled = false;
      config.types.blind = false;
    }

    const vulns: Vulnerability[] = [];
    const scanner = new Scanner(config, {
      payloadsDir: path.join(repoRoot(), 'payloads'),
      callbackBase: config.blindXss.callbackBase,
      onProgress: (p) => {
        if (!args.json) {
          process.stdout.write(
            `\r\x1b[K[${p.percent.toString().padStart(3)}%] ${p.currentActivity} · pages=${p.pagesCrawled} endpoints=${p.endpointsFound} findings=${p.vulnsFound}`,
          );
        }
      },
      onVulnerability: (v) => {
        vulns.push(v);
        if (!args.json) {
          const c = SEV_COLOR[v.severity] ?? '';
          console.log(`\n${c}[${v.severity.toUpperCase()}]${R} ${v.title}\n    ${v.url} (${v.evidence.parameter})`);
        }
      },
    });

    if (!args.json) {
      console.log(`🛡️  XSSPLOIT v5 — scanning ${config.targetUrl} [profile=${config.profile}]`);
      if (config.program) console.log(`   program: ${config.program} (authorized engagement)`);
    }

    const result = await scanner.run();
    if (!args.json) process.stdout.write('\n');

    const outDir = args['out-dir'] || path.join(repoRoot(), 'reports', 'output');
    const artifacts = new ReportBuilder(outDir).buildAll({
      scan: result,
      vulnerabilities: vulns,
      generatedAt: new Date().toISOString(),
    });

    if (args.json) {
      console.log(JSON.stringify({ result, vulnerabilities: vulns, artifacts }, null, 2));
    } else {
      console.log(`\n✅ scan ${result.status} — ${vulns.length} finding(s), ${result.stats.requestsSent} requests, ${Math.round(result.stats.durationMs / 1000)}s`);
      for (const [fmt, p] of Object.entries(artifacts)) console.log(`   ${fmt.padEnd(8)} → ${p}`);
    }
  },
});

/** Prompt the operator for free-form AI directives before the scan begins. */
function askDirectives(): Promise<string | undefined> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(
      '🧠 AI directives for this scan (optional, Enter to skip)\n   e.g. "focus on search/comment params; target runs React; WAF=Cloudflare"\n> ',
      (answer) => {
        rl.close();
        resolve(answer.trim() || undefined);
      },
    );
  });
}

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Payload, PayloadCategory } from '@xssploit/shared';
import { sha256 } from '../../utils/hash.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('payload-loader');

/** Map payloads/<dir> → category. Unknown dirs fall back to custom. */
const DIR_CATEGORY: Record<string, PayloadCategory> = {
  'context-based': 'html-context', // refined per-file below
  encoding: 'encoding',
  'waf-bypass': 'waf-bypass',
  'framework-specific': 'framework-specific',
  'csp-bypass': 'csp-bypass',
  'blind-xss': 'blind-xss',
  polyglot: 'polyglot',
  'dom-clobbering': 'dom-clobbering',
  mxss: 'mxss',
  'ai-generated': 'ai-generated',
  custom: 'custom',
};

const FILE_CATEGORY: Record<string, PayloadCategory> = {
  'html-context.txt': 'html-context',
  'attribute-context.txt': 'attribute-context',
  'javascript-context.txt': 'javascript-context',
  'url-context.txt': 'url-context',
  'css-context.txt': 'css-context',
  'svg-context.txt': 'svg-context',
  'template-context.txt': 'template-context',
};

/**
 * Loads the on-disk payload library (payloads/ at repo root).
 * Lines starting with # are comments. Blank lines ignored.
 */
export class PayloadLoader {
  constructor(private readonly payloadsRoot: string) {}

  loadAll(categories?: string[]): Payload[] {
    if (!existsSync(this.payloadsRoot)) {
      logger.warn({ root: this.payloadsRoot }, 'payload directory missing');
      return [];
    }
    const out: Payload[] = [];
    for (const entry of readdirSync(this.payloadsRoot)) {
      const dir = path.join(this.payloadsRoot, entry);
      if (!statSync(dir).isDirectory()) continue;
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.txt')) continue;
        const category = FILE_CATEGORY[file] ?? DIR_CATEGORY[entry] ?? 'custom';
        if (categories && categories.length > 0 && !categories.includes(category)) continue;
        out.push(...this.parseFile(path.join(dir, file), category, `${entry}/${file}`));
      }
    }
    logger.info({ count: out.length }, 'payloads loaded');
    return out;
  }

  private parseFile(filePath: string, category: PayloadCategory, source: string): Payload[] {
    let text: string;
    try {
      text = readFileSync(filePath, 'utf8');
    } catch {
      return [];
    }
    const requiresCallback = category === 'blind-xss';
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .map((payload) => ({
        id: sha256(payload).slice(0, 16),
        payload,
        category,
        source,
        contexts: guessContexts(category),
        tags: guessTags(payload),
        requiresCallback,
      }));
  }
}

function guessContexts(category: PayloadCategory): Payload['contexts'] {
  switch (category) {
    case 'html-context':
      return ['html-body'];
    case 'attribute-context':
      return ['html-attribute', 'html-attribute-unquoted'];
    case 'javascript-context':
      return ['javascript-string', 'javascript-code'];
    case 'url-context':
      return ['url'];
    case 'css-context':
      return ['css'];
    case 'svg-context':
      return ['svg', 'html-body'];
    default:
      return ['unknown'];
  }
}

function guessTags(payload: string): string[] {
  const tags = new Set<string>();
  if (/on\w+\s*=/i.test(payload)) tags.add('event-handler');
  if (/<svg/i.test(payload)) tags.add('svg');
  if (/<img/i.test(payload)) tags.add('img');
  if (/javascript:/i.test(payload)) tags.add('js-scheme');
  if (/["']>\s*</.test(payload)) tags.add('tag-break');
  if (/["']\s*>/.test(payload) && !tags.has('tag-break')) tags.add('quote-break');
  if (/<iframe/i.test(payload)) tags.add('iframe');
  return [...tags];
}

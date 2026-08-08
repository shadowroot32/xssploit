import path from 'node:path';
import { readdirSync, readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { PayloadLoader } from '@xssploit/engine';

const CATEGORY_RE = /^[a-z0-9][a-z0-9-]{0,49}$/;

function payloadsDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'payloads');
}

interface PayloadIndexEntry {
  category: string;
  file: string;
  count: number;
  tags?: string[];
}

export async function payloadRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    const dir = payloadsDir();
    const indexPath = path.join(dir, 'payload-index.json');
    let index: PayloadIndexEntry[] = [];
    if (existsSync(indexPath)) {
      try {
        const raw = JSON.parse(readFileSync(indexPath, 'utf8')) as unknown;
        // Index may be a bare array or { version, categories: [...] }.
        const list = Array.isArray(raw)
          ? raw
          : (raw as { categories?: unknown[] }).categories;
        if (Array.isArray(list)) index = list as PayloadIndexEntry[];
      } catch {
        index = [];
      }
    }
    if (index.length === 0) {
      // Derive from filesystem when the collector hasn't run yet.
      const ctxDir = path.join(dir, 'context-based');
      if (existsSync(ctxDir)) {
        index = readdirSync(ctxDir)
          .filter((f) => f.endsWith('.txt'))
          .map((f) => {
            const lines = readFileSync(path.join(ctxDir, f), 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#'));
            return { category: f.replace('.txt', ''), file: `context-based/${f}`, count: lines.length };
          });
      }
    }
    // Operator-added payloads live in payloads/custom/<name>.txt — always merge.
    const customDir = path.join(dir, 'custom');
    if (existsSync(customDir)) {
      for (const f of readdirSync(customDir).filter((f) => f.endsWith('.txt'))) {
        const count = readFileSync(path.join(customDir, f), 'utf8')
          .split('\n')
          .filter((l) => l.trim() && !l.startsWith('#')).length;
        if (count > 0) index.push({ category: 'custom', file: `custom/${f}`, count });
      }
    }
    return { categories: index, total: index.reduce((n, e) => n + e.count, 0) };
  });

  app.get('/preview', async (req) => {
    const { categories, limit = '3' } = req.query as { categories?: string; limit?: string };
    const dir = payloadsDir();
    const loader = new PayloadLoader(dir);
    const cats = categories ? categories.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    const all = loader.loadAll(cats);
    const n = Math.max(1, Math.min(50, Number(limit) || 3));
    const byCat = new Map<string, string[]>();
    for (const p of all) {
      const arr = byCat.get(p.category) ?? [];
      if (arr.length < n) arr.push(p.payload);
      byCat.set(p.category, arr);
    }
    return { preview: Object.fromEntries(byCat), loaded: all.length };
  });

  /**
   * Append operator-supplied payloads to payloads/custom/<category>.txt.
   * New category names are created on the fly; duplicates are skipped.
   * Loaded live by the next scan — no restart needed.
   */
  app.post('/', async (req, reply) => {
    const body = req.body as { category?: string; payloads?: unknown } | null;
    const category = body?.category?.trim().toLowerCase();
    if (!category || !CATEGORY_RE.test(category)) {
      return reply.code(400).send({
        error: 'category must be lowercase letters/digits/dashes (e.g. "waf-bypass", "react-custom")',
      });
    }
    const lines = Array.isArray(body?.payloads)
      ? (body.payloads as unknown[]).filter((x): x is string => typeof x === 'string')
      : typeof body?.payloads === 'string'
        ? (body.payloads as string).split('\n')
        : null;
    if (!lines) return reply.code(400).send({ error: 'payloads must be a string or array of strings' });

    const cleaned = [...new Set(lines.map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#')))];
    if (cleaned.length === 0) return reply.code(400).send({ error: 'no valid payload lines' });
    if (cleaned.length > 500) return reply.code(400).send({ error: 'max 500 payloads per request' });
    for (const p of cleaned) {
      if (p.includes('\n') || p.includes('\r') || p.length > 2000) {
        return reply.code(400).send({ error: 'each payload must be a single line of at most 2000 chars' });
      }
    }

    const dir = path.join(payloadsDir(), 'custom');
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${category}.txt`);
    const existing = existsSync(file)
      ? new Set(
          readFileSync(file, 'utf8')
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean),
        )
      : new Set<string>();
    const fresh = cleaned.filter((p) => !existing.has(p));
    if (fresh.length > 0) {
      const header = existing.size === 0 ? `# custom payloads — ${category}\n` : '';
      appendFileSync(file, header + fresh.join('\n') + '\n', 'utf8');
    }
    return { ok: true, category, added: fresh.length, skipped: cleaned.length - fresh.length, file: `custom/${category}.txt` };
  });
}

import path from 'node:path';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { PayloadLoader } from '@xssploit/engine';

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
        index = JSON.parse(readFileSync(indexPath, 'utf8')) as PayloadIndexEntry[];
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
}

import { defineCommand } from 'citty';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PayloadLoader, PayloadMutator } from '@xssploit/engine';

function payloadsDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'payloads');
}

const list = defineCommand({
  meta: { name: 'list', description: 'List payload categories and counts' },
  args: {
    categories: { type: 'string', description: 'Filter categories (comma list)' },
    preview: { type: 'string', description: 'Show N sample payloads per category', default: '2' },
  },
  run({ args }) {
    const loader = new PayloadLoader(payloadsDir());
    const cats = args.categories?.split(',').map((s) => s.trim()).filter(Boolean);
    const payloads = loader.loadAll(cats);
    const n = Number(args.preview) || 0;

    const byCat = new Map<string, string[]>();
    for (const p of payloads) {
      const arr = byCat.get(p.category) ?? [];
      arr.push(p.payload);
      byCat.set(p.category, arr);
    }
    console.log(`payload library: ${payloads.length} payloads in ${byCat.size} categories\n`);
    for (const [cat, items] of byCat) {
      console.log(`  ${cat} (${items.length})`);
      items.slice(0, n).forEach((p) => console.log(`    · ${p.length > 80 ? p.slice(0, 77) + '…' : p}`));
    }
  },
});

const mutate = defineCommand({
  meta: { name: 'mutate', description: 'Generate WAF-bypass mutations of a payload' },
  args: {
    payload: { type: 'positional', description: 'Base payload', required: true },
    level: { type: 'string', description: 'Mutation level 1-3', default: '2' },
  },
  run({ args }) {
    const mutator = new PayloadMutator();
    const level = Math.min(3, Math.max(1, Number(args.level) || 2)) as 1 | 2 | 3;
    const mutations = mutator.mutate(args.payload, level);
    console.log(`${mutations.length} mutations (level ${level}):\n`);
    mutations.forEach((m, i) => console.log(`  ${String(i + 1).padStart(3)}. ${m}`));
  },
});

export const payloadCommand = defineCommand({
  meta: { name: 'payload', description: 'Payload library operations' },
  subCommands: { list, mutate },
});

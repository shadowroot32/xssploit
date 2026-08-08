#!/usr/bin/env node
/**
 * Scans payloads/**\/*.txt and regenerates payload-index.json.
 * Lines starting with # (or empty) are comments and excluded from counts.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const payloadsDir = path.join(root, 'payloads');

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (entry.endsWith('.txt')) yield full;
  }
}

const categories = [];
for (const file of walk(payloadsDir)) {
  const rel = path.relative(payloadsDir, file).replaceAll('\\', '/');
  const lines = readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  categories.push({ category: path.basename(file, '.txt'), file: rel, count: lines.length });
}

categories.sort((a, b) => a.category.localeCompare(b.category));
const index = { version: 1, generatedAt: new Date().toISOString(), categories };
writeFileSync(path.join(payloadsDir, 'payload-index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`✅ payload-index.json updated: ${categories.length} categories, ${categories.reduce((n, c) => n + c.count, 0)} payloads`);

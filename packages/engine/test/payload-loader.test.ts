import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PayloadLoader } from '../src/core/injector/payload-loader.js';

describe('PayloadLoader', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'xssploit-payloads-'));
  mkdirSync(path.join(dir, 'context-based'), { recursive: true });
  mkdirSync(path.join(dir, 'waf-bypass'), { recursive: true });
  writeFileSync(
    path.join(dir, 'context-based', 'html-context.txt'),
    '# comment\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n',
  );
  writeFileSync(path.join(dir, 'waf-bypass', 'bypasses.txt'), '<ScRiPt>alert(1)</ScRiPt>\n');

  it('loads all categories when no filter given', () => {
    const loader = new PayloadLoader(dir);
    const all = loader.loadAll();
    expect(all.length).toBe(3);
    expect(new Set(all.map((p) => p.category))).toEqual(new Set(['html-context', 'waf-bypass']));
  });

  it('filters by category and skips comments/empties', () => {
    const loader = new PayloadLoader(dir);
    const filtered = loader.loadAll(['waf-bypass']);
    expect(filtered.length).toBe(1);
    expect(filtered[0]!.payload).toBe('<ScRiPt>alert(1)</ScRiPt>');
  });

  it('returns empty for missing directory', () => {
    expect(new PayloadLoader(path.join(dir, 'nope')).loadAll()).toEqual([]);
  });
});

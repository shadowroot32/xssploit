import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import type { BlindXssCallbackHit } from '@xssploit/shared';
import { randomToken } from '../../utils/hash.js';

/**
 * Minimal JSONL store for blind-XSS hits. The API package has the SQL
 * database; the standalone callback server (often running on a separate
 * box) only needs append-only persistence it can sync later.
 */
export class DataCollector {
  private readonly file: string;

  constructor(dataDir: string) {
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    this.file = path.join(dataDir, 'blind-xss-hits.jsonl');
  }

  record(partial: Omit<BlindXssCallbackHit, 'id' | 'receivedAt'>): BlindXssCallbackHit {
    const hit: BlindXssCallbackHit = {
      ...partial,
      id: randomToken(8),
      receivedAt: new Date().toISOString(),
      // Bound stored blobs so a hostile page cannot fill the disk.
      domSnippet: partial.domSnippet?.slice(0, 4000),
      screenshot: partial.screenshot?.slice(0, 200_000),
      cookies: partial.cookies?.slice(0, 2000),
    };
    appendFileSync(this.file, JSON.stringify(hit) + '\n', 'utf8');
    return hit;
  }

  list(limit = 200): BlindXssCallbackHit[] {
    if (!existsSync(this.file)) return [];
    const lines = readFileSync(this.file, 'utf8').split('\n').filter(Boolean);
    return lines
      .slice(-limit)
      .map((l) => JSON.parse(l) as BlindXssCallbackHit)
      .reverse();
  }
}

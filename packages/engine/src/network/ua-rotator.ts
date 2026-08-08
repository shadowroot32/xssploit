import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Rotates real-world User-Agent strings. Ships with a small built-in list;
 * network/ua-database.json can be extended with hundreds more.
 */
export class UARotator {
  private readonly agents: string[];
  private index = 0;

  constructor(extraAgents: string[] = []) {
    let fromFile: string[] = [];
    try {
      const dbPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ua-database.json');
      fromFile = JSON.parse(readFileSync(dbPath, 'utf8')) as string[];
    } catch {
      fromFile = [];
    }
    this.agents = [...BUILT_IN, ...fromFile, ...extraAgents];
  }

  next(): string {
    const ua = this.agents[this.index % this.agents.length] ?? BUILT_IN[0]!;
    this.index += 1;
    return ua;
  }
}

const BUILT_IN = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/126.0.0.0',
];

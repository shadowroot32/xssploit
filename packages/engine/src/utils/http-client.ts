import { request, type Dispatcher } from 'undici';
import { createLogger } from './logger.js';

const logger = createLogger('http');

export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  /** Per-request timeout in ms (default 15s). */
  timeoutMs?: number;
  /** Follow up to N redirects (default 3). */
  maxRedirections?: number;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string | string[]>;
  body: string;
  /** Final URL after redirects. */
  url: string;
  durationMs: number;
}

const DEFAULT_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/**
 * Thin undici wrapper with sane scanner defaults: no cookie jar (stateless
 * per request), bounded timeouts, response size cap so a hostile/huge page
 * cannot blow up memory.
 */
export class HTTPClient {
  private readonly maxBodyBytes = 5 * 1024 * 1024;

  async fetch(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const started = performance.now();
    const { method = 'GET', headers = {}, body, timeoutMs = 15_000, maxRedirections = 3 } = options;

    let response: Dispatcher.ResponseData;
    try {
      response = await request(url, {
        method: method as Dispatcher.HttpMethod,
        headers: { 'user-agent': DEFAULT_UA, accept: '*/*', ...headers },
        body,
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
        maxRedirections,
      });
    } catch (err) {
      logger.debug({ url, err: (err as Error).message }, 'request failed');
      throw err;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += (chunk as Buffer).length;
      if (size > this.maxBodyBytes) break;
      chunks.push(chunk as Buffer);
    }

    const flatHeaders: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(response.headers)) {
      if (v !== undefined) flatHeaders[k.toLowerCase()] = v;
    }

    return {
      status: response.statusCode,
      headers: flatHeaders,
      body: Buffer.concat(chunks).toString('utf8'),
      url,
      durationMs: performance.now() - started,
    };
  }

  /** Convenience: GET with merged query params. */
  async getWithParams(
    url: string,
    params: Record<string, string>,
    options: HttpRequestOptions = {},
  ): Promise<HttpResponse> {
    const u = new URL(url);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return this.fetch(u.toString(), options);
  }
}

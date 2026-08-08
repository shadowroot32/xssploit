import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('sandbox');

/** Playwright is an optional peer — DOM scanning degrades gracefully without it. */
type Browser = import('playwright').Browser;
type BrowserContext = import('playwright').BrowserContext;

export interface DomObservation {
  url: string;
  /** Payload execution proof: alert/confirm/prompt was called. */
  dialogFired: boolean;
  /** sink events recorded by the hook script. */
  sinkEvents: { kind: string; detail: string }[];
  consoleErrors: string[];
}

/**
 * Manages a headless Chromium instance for DOM-XSS confirmation.
 * Lazy-loads Playwright; callers must handle `isAvailable() === false`.
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private playwright: typeof import('playwright') | null = null;

  async isAvailable(): Promise<boolean> {
    if (this.playwright) return true;
    try {
      this.playwright = await import('playwright');
      return true;
    } catch {
      logger.warn('playwright not installed — DOM sandbox disabled (pnpm --filter @xssploit/engine exec playwright install chromium)');
      return false;
    }
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    if (!(await this.isAvailable())) throw new Error('playwright unavailable');
    this.browser = await this.playwright!.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    return this.browser;
  }

  /**
   * Load `url` in a hooked, instrumented page and observe sink/dialog
   * activity for `observeMs` after load.
   */
  async observe(url: string, observeMs = 4000, headers: Record<string, string> = {}): Promise<DomObservation> {
    const browser = await this.ensureBrowser();
    const context: BrowserContext = await browser.newContext({
      extraHTTPHeaders: headers,
      bypassCSP: false, // we WANT to see CSP-blocked behavior
      javaScriptEnabled: true,
    });

    const consoleErrors: string[] = [];
    try {
      const hookPath = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        'hooks',
        'sink-hook.js',
      );
      await context.addInitScript({ content: readFileSync(hookPath, 'utf8') });
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'failed to load hook script');
    }

    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err).slice(0, 300)));

    const observation: DomObservation = { url, dialogFired: false, sinkEvents: [], consoleErrors };

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      await page.waitForTimeout(observeMs);

      interface SinkEvent {
        kind: string;
        detail: string;
      }
      interface HookState {
        alerted: boolean;
        events: SinkEvent[];
      }
      const state = await page.evaluate<HookState>(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const x = (globalThis as any).__xssploit as HookState | undefined;
        return { alerted: x?.alerted ?? false, events: x?.events ?? [] };
      });
      observation.dialogFired = state.alerted;
      observation.sinkEvents = state.events.filter(
        (e) => e.kind.startsWith('sink:') || e.kind.startsWith('source:'),
      );
    } catch (err) {
      logger.debug({ url, err: (err as Error).message }, 'DOM observation failed');
    } finally {
      await context.close();
    }
    return observation;
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }
}

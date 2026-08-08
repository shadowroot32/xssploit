import type { WebhookEvent } from '@xssploit/shared';
import { HTTPClient } from '../../utils/http-client.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('notify');

/**
 * Sends findings to YOUR private channels (Discord webhook / Telegram bot).
 * These are personal ops notifications — not a multi-tenant product feature.
 */
export class NotificationManager {
  private readonly http = new HTTPClient();

  constructor(
    private readonly opts: {
      discordWebhookUrl?: string;
      telegramBotToken?: string;
      telegramChatId?: string;
    } = {},
  ) {}

  async notify(event: WebhookEvent): Promise<void> {
    const text = format(event);
    await Promise.allSettled([this.sendDiscord(text, event), this.sendTelegram(text)]);
  }

  private async sendDiscord(text: string, event: WebhookEvent): Promise<void> {
    const url = this.opts.discordWebhookUrl;
    if (!url) return;
    try {
      await this.http.fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: titleFor(event),
              description: text.slice(0, 1900),
              color: event.severity === 'high' || event.severity === 'critical' ? 0xe11d48 : 0xf59e0b,
              timestamp: event.timestamp,
            },
          ],
        }),
      });
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'discord notify failed');
    }
  }

  private async sendTelegram(text: string): Promise<void> {
    const { telegramBotToken, telegramChatId } = this.opts;
    if (!telegramBotToken || !telegramChatId) return;
    try {
      await this.http.fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: telegramChatId, text: text.slice(0, 4000) }),
      });
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'telegram notify failed');
    }
  }
}

function titleFor(event: WebhookEvent): string {
  switch (event.kind) {
    case 'vuln-found':
      return '🚨 XSSPLOIT — Vulnerability found';
    case 'scan-finished':
      return '✅ XSSPLOIT — Scan finished';
    case 'blind-xss-triggered':
      return '💥 XSSPLOIT — Blind XSS fired!';
  }
}

function format(event: WebhookEvent): string {
  const lines = [event.message];
  if (event.url) lines.push(`URL: ${event.url}`);
  if (event.severity) lines.push(`Severity: ${event.severity}`);
  lines.push(`Scan: ${event.scanId}`);
  return lines.join('\n');
}

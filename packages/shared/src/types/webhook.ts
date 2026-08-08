/**
 * Personal notification webhook types (Discord/Telegram/custom — your channels).
 */

export type WebhookType = 'discord' | 'telegram' | 'custom';

export interface WebhookConfig {
  id: string;
  type: WebhookType;
  /** discord/custom: full webhook URL. telegram: unused (bot token+chat id in env). */
  url?: string;
  enabled: boolean;
  /** Which events push a notification. */
  events: WebhookEventKind[];
  createdAt: string;
}

export type WebhookEventKind = 'vuln-found' | 'scan-finished' | 'blind-xss-triggered';

export interface WebhookEvent {
  kind: WebhookEventKind;
  scanId: string;
  message: string;
  severity?: string;
  url?: string;
  timestamp: string;
}

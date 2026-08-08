import type { ScanAuth } from '@xssploit/shared';
import type { HTTPClient } from '../../utils/http-client.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('auth');

/**
 * Turns the scan's auth config into request headers. Supports static
 * cookie/bearer and simple form-login (POST credentials, harvest Set-Cookie).
 */
export class AuthManager {
  constructor(private readonly http: HTTPClient) {}

  async resolveHeaders(auth: ScanAuth): Promise<Record<string, string>> {
    switch (auth.method) {
      case 'cookie':
        return auth.cookie ? { cookie: auth.cookie } : {};
      case 'bearer':
        return auth.token ? { authorization: `Bearer ${auth.token}` } : {};
      case 'form-login':
        return this.formLogin(auth);
      default:
        return {};
    }
  }

  private async formLogin(auth: ScanAuth): Promise<Record<string, string>> {
    if (!auth.loginUrl || !auth.usernameField || !auth.passwordField) return {};
    try {
      const body = new URLSearchParams({
        [auth.usernameField]: auth.username ?? '',
        [auth.passwordField]: auth.password ?? '',
      });
      const res = await this.http.fetch(auth.loginUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        maxRedirections: 0,
      });
      const setCookie = res.headers['set-cookie'];
      const cookies = (Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [])
        .map((c) => c.split(';')[0])
        .filter(Boolean)
        .join('; ');
      if (cookies) {
        logger.info('form login succeeded, session captured');
        return { cookie: cookies };
      }
      logger.warn('form login produced no cookies');
      return {};
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'form login failed — continuing unauthenticated');
      return {};
    }
  }
}

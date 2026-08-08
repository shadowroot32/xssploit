import type { DiscoveredEndpoint } from '@xssploit/shared';
import type { HTTPClient, HttpResponse } from '../../../utils/http-client.js';

export interface DeliveryContext {
  http: HTTPClient;
  endpoint: DiscoveredEndpoint;
  param: string;
  payload: string;
  /** Session headers (cookies / bearer) when scanning authenticated areas. */
  authHeaders: Record<string, string>;
}

/**
 * Deliver one payload into one parameter of an endpoint.
 * All sibling params get harmless filler so forms submit "realistically".
 */
export async function deliver(ctx: DeliveryContext): Promise<HttpResponse> {
  const { http, endpoint, param, payload, authHeaders } = ctx;

  if (endpoint.method === 'GET') {
    const params: Record<string, string> = {};
    for (const p of endpoint.params) params[p] = p === param ? payload : 'xssploit';
    return http.getWithParams(endpoint.url, params, { headers: authHeaders });
  }

  if (endpoint.contentType === 'json') {
    const body: Record<string, string> = {};
    for (const p of endpoint.params) body[p] = p === param ? payload : 'xssploit';
    return http.fetch(endpoint.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
    });
  }

  const form = new URLSearchParams();
  for (const p of endpoint.params) form.set(p, p === param ? payload : 'xssploit');
  return http.fetch(endpoint.url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...authHeaders },
    body: form.toString(),
  });
}

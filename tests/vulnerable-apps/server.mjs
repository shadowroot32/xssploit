#!/usr/bin/env node
/**
 * Local intentionally-vulnerable test server (integration tests / manual QA).
 * NEVER expose beyond localhost.
 *
 *   node tests/vulnerable-apps/server.mjs [port]
 *
 * Routes:
 *   /               → link hub
 *   /search?q=      → reflects q unescaped (basic-reflected)
 *   /comment?text=  → strips <> but keeps quotes (filtered-input)
 *   /secure-search?q= → reflects q but with strict CSP header (negative test)
 *   /dom            → dom-based.html
 *   /ws             → websocket-app.html
 *   /stored         → POST body saved; /board renders stored entries unescaped
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const stored = [];

const esc = (s) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');

const server = createServer((req, res) => {
  const u = new URL(req.url ?? '/', 'http://localhost');
  const send = (code, body, headers = {}) => {
    res.writeHead(code, { 'content-type': 'text/html; charset=utf-8', ...headers });
    res.end(body);
  };

  switch (u.pathname) {
    case '/':
      return send(200, `<h1>vuln apps</h1><ul>
        <li><a href="/search?q=test">/search?q=</a> (reflected)</li>
        <li><a href="/comment?text=test">/comment?text=</a> (filtered)</li>
        <li><a href="/secure-search?q=test">/secure-search?q=</a> (CSP)</li>
        <li><a href="/dom#test">/dom</a> (DOM)</li>
        <li><a href="/ws">/ws</a> (websocket)</li>
        <li><a href="/board">/board</a> (stored)</li></ul>`);
    case '/search':
      return send(200, `<h1>results for: ${u.searchParams.get('q') ?? ''}</h1>`);
    case '/comment': {
      const filtered = (u.searchParams.get('text') ?? '').replace(/[<>]/g, '');
      return send(200, `<h1>comment</h1><input value="${filtered}">`);
    }
    case '/secure-search':
      return send(200, `<h1>results for: ${u.searchParams.get('q') ?? ''}</h1>`, {
        'content-security-policy': "default-src 'self'; script-src 'self'",
      });
    case '/dom':
      return send(200, readFileSync(path.join(dir, 'dom-based.html'), 'utf8'));
    case '/ws':
      return send(200, readFileSync(path.join(dir, 'websocket-app.html'), 'utf8'));
    case '/stored': {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        stored.push(new URLSearchParams(body).get('entry') ?? '');
        send(200, '<a href="/board">view board</a>');
      });
      return;
    }
    case '/board':
      return send(200, `<h1>board</h1>${stored.map((s) => `<div class="entry">${s}</div>`).join('')}
        <form method="post" action="/stored"><input name="entry"><button>save</button></form>`);
    default:
      return send(404, `not found: ${esc(u.pathname)}`);
  }
});

const port = Number(process.argv[2] ?? 9999);
server.listen(port, '127.0.0.1', () => {
  console.log(`🧪 vulnerable test apps on http://127.0.0.1:${port}`);
});

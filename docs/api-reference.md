# API Reference — XSSPLOIT v5

Base: `http://127.0.0.1:4000`. When `LOCAL_AUTH_TOKEN` is set, send
`Authorization: Bearer <token>` on all endpoints except `/api/health`.

## Health

### GET /api/health
→ `{ status, service, version, time }`

## Scans

### POST /api/scans
Start a scan. Body = `ScanConfig` (partial OK):

```json
{
  "targetUrl": "https://app.example.com",
  "program": "acme-h1",
  "profile": "deep",
  "types": { "reflected": true, "dom": true, "stored": false, "blind": false },
  "inScope": ["*.example.com"],
  "outOfScope": ["/logout"],
  "auth": { "method": "cookie", "cookie": "session=…" },
  "rateLimit": 20,
  "maxPages": 50,
  "crawlDepth": 2,
  "timeout": 900,
  "payloadCategories": ["html-body", "waf-bypass"],
  "ai": { "enabled": true, "maxTokens": 50000 },
  "blindXss": { "enabled": false },
  "notify": true,
  "respectRobots": true
}
```
→ `201 { scanId, status }` · `400` on invalid target/profile.

### GET /api/scans
→ `{ scans: ScanRow[] }` (latest 50, includes finding counts).

### GET /api/scans/:id
→ `{ scan }` with `progress_json` / `stats_json` (live progress while running).

### POST /api/scans/:id/cancel
→ `{ cancelled: true }` · `409` when not running.

### GET /api/scans/:id/vulnerabilities
→ `{ vulnerabilities: Vulnerability[] }`.

### GET /api/scans/profiles
→ `{ profiles }` — available scan profiles and their defaults.

## Vulnerabilities

### GET /api/vulnerabilities?scanId=
All findings (optionally per scan).

## Payloads

### GET /api/payloads
→ `{ categories: [{category, file, count}], total }`.

### GET /api/payloads/preview?categories=html-body,js-string&limit=3
→ `{ preview: { category: [payload…] }, loaded }`.

## Blind callbacks

### GET /api/callbacks?scanId=&limit=
Captured blind-XSS hits (cookies, origin, DOM snippet, screenshot ref).

## Reports

### GET /api/reports?scanId=
List generated artifacts (html / markdown / sarif / junit).

### GET /api/reports/:id/download
Stream the report file.

## Webhooks

### GET /api/webhooks · POST /api/webhooks · DELETE /api/webhooks/:id
Manage Discord/Telegram/custom notification targets.
`POST` body: `{ type: "discord"|"telegram"|"custom", url, events: ["vuln-found","scan-finished"] }`.

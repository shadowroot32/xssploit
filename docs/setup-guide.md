# XSSPLOIT v5 — Setup Guide

Personal, local-first XSS hunting toolkit. **Authorized targets only** — see
[authorization-policy.md](authorization-policy.md).

## Prereqs

- Node.js ≥ 20, pnpm 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
- Optional: Python 3.11+ (python-services), Docker (containerized run)
- Optional: `npx playwright install chromium` for DOM sandbox confirmation

## Install & run

```bash
pnpm install
pnpm db:migrate            # create ./data/xssploit.db
pnpm dev                   # api (:4000) + dashboard (:3000) via turbo
```

Open http://127.0.0.1:3000 → **New Scan** wizard.

## CLI

```bash
pnpm cli scan https://app.example.com --profile deep --program acme-h1
pnpm cli payload list --preview 3
pnpm cli callback serve --port 5001     # blind-XSS listener
pnpm cli callback hits
```

## Environment (.env)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | SQLite path (default `./data/xssploit.db`) |
| `LOCAL_AUTH_TOKEN` | If set, all API calls need `Authorization: Bearer …` |
| `ANTHROPIC_API_KEY` | Claude (AI tier 1) |
| `ANTIGRAVITY_API_KEY` / `ANTIGRAVITY_BASE_URL` | Tier 2 |
| `DEEPSEEK_API_KEY` | Tier 3 (OpenAI-compatible) |
| `OLLAMA_BASE_URL` | Tier 4 local model |
| `CALLBACK_DOMAIN` | Blind-XSS callback base (e.g. `http://your-vps:5001`) |
| `API_HOST` / `API_PORT` | API bind (default `127.0.0.1:4000`) |

## Docker

```bash
docker compose up api dashboard          # local stack
docker compose --profile worker up engine
docker compose up callback               # run on your VPS instead
```

## python-services (optional)

```bash
cd python-services && pip install -r requirements.txt
python ai_service.py      # :8001 rule-based reflection analysis
python fuzzer_service.py  # :8002 mutation fuzzer
```

## Test targets

```bash
node tests/vulnerable-apps/server.mjs 9999
pnpm cli scan http://127.0.0.1:9999 --types reflected,dom
```

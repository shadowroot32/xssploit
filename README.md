# 🛡️ XSSPLOIT — Personal Edition (v5)

AI-assisted XSS scanner for **your own authorized engagements only**
(bug bounty scope, signed pentest contracts). Single-user, local-first.
Not a product. Not distributed. See [LICENSE](LICENSE).

> ⚖️ **Authorization first.** Log every target in [AUTHORIZATION_LOG.md](AUTHORIZATION_LOG.md)
> before scanning. Read [docs/authorization-policy.md](docs/authorization-policy.md).

## Stack

| Piece | Tech |
|---|---|
| Monorepo | pnpm workspace + Turborepo |
| Scanner engine | TypeScript, undici, linkedom, Acorn (taint tracking) |
| Browser sandbox | Playwright (DOM XSS, hook injection) |
| AI engine | Tiered: Claude → Antigravity → DeepSeek → Ollama → rule-based |
| API | Fastify + better-sqlite3 (WAL) |
| Dashboard | Next.js 14 App Router + Tailwind |
| CLI | `xssploit` (citty) |
| Python services | FastAPI: AI analysis + payload fuzzer |

## Quick start

```bash
pnpm install                 # or: make setup
cp .env.example .env         # fill ANTHROPIC_API_KEY etc.
pnpm db:migrate              # create SQLite schema
pnpm build && pnpm dev
# dashboard → http://localhost:3000   api → http://localhost:4000
```

CLI:

```bash
pnpm cli scan https://authorized-target.tld --profile deep --program "ACME BBP"
pnpm cli payload list --context html
pnpm cli callback serve
```

Payload library (auto-collected from public sources):

```bash
make payloads
```

## Layout

- [packages/shared](packages/shared) — types, constants, validators
- [packages/engine](packages/engine) — scanner core (crawler, injector, analyzer, AI, sandbox, callback, reports)
- [packages/api](packages/api) — local REST API + SQLite
- [packages/cli](packages/cli) — command-line interface
- [packages/dashboard](packages/dashboard) — local web UI
- [packages/python-services](packages/python-services) — AI/fuzzer microservices
- [payloads](payloads) — payload library
- [tests/vulnerable-apps](tests/vulnerable-apps) — self-built practice targets
- [infra](infra) — Dockerfiles, CI
- [docs](docs) — setup, API reference, authorization policy

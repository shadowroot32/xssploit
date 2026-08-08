# 🛡️ XSSPLOIT — AI Scaffolding Instruction Manual

> Dokumen ini berisi **instruksi lengkap** (prompt) agar AI bisa men-scaffold seluruh project XSSPLOIT dari nol. Copy-paste prompt ke AI coding assistant (Claude Code, Antigravity, Cursor, dll), dan biarkan AI membangun semuanya.

---

## 📋 Daftar Isi

1. [Prerequisites](#-prerequisites)
2. [Quick Start — Master Prompt](#-quick-start--master-prompt-satu-prompt-untuk-semua)
3. [Phase-by-Phase Prompts](#-phase-by-phase-prompts)
   - [Phase 1: Monorepo Root](#phase-1-monorepo-root--config)
   - [Phase 2: Shared Package](#phase-2-shared-package)
   - [Phase 3: Scanner Engine](#phase-3-scanner-engine)
   - [Phase 4: Backend API](#phase-4-backend-api)
   - [Phase 5: Dashboard Frontend](#phase-5-dashboard-frontend)
   - [Phase 6: Payload Library](#phase-6-payload-library)
   - [Phase 7: Infrastructure](#phase-7-infrastructure)
4. [Post-Scaffold Checklist](#-post-scaffold-checklist)
5. [Run Instructions](#-run-instructions)

---

## 🔧 Prerequisites

Sebelum memulai scaffolding, pastikan tools berikut sudah terinstall:

```bash
# Wajib
node --version    # >= 20.x
pnpm --version    # >= 9.x (atau install: npm i -g pnpm)
python3 --version # >= 3.11
git --version     # >= 2.x

# Opsional (untuk full feature)
docker --version       # Untuk containerized deployment
uv --version           # Python package manager (faster pip)
rustc --version        # Untuk rust-modules (opsional)
```

Install pnpm jika belum ada:
```bash
npm install -g pnpm
```

---

## 🚀 Quick Start — Master Prompt (Satu Prompt untuk Semua)

> Copy-paste prompt di bawah ini ke AI coding assistant kamu. AI akan membuat SELURUH folder structure dan boilerplate files.

````
Buatkan project XSSPLOIT — AI-Powered XSS Scanner SaaS Platform.

## PROJECT OVERVIEW
XSSPLOIT adalah SaaS platform untuk XSS vulnerability scanning dengan fitur:
- AI engine (tiered: Claude → Antigravity → Ollama → rule-based fallback)
- Deep JavaScript analysis (source→sink taint tracking)
- 100K+ payload library (auto-download dari 30+ sumber internet)
- Blind XSS callback server dengan webhook (Discord/Telegram/Slack)
- Post-exploitation PoC demonstration
- Web dashboard + CLI dual interface
- Subscription model (Free/Starter/Pro/Enterprise)
- Multi-tenant dengan PostgreSQL

## TECH STACK
- Monorepo: pnpm workspace + Turborepo
- Frontend: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Backend API: Node.js + Fastify + BullMQ job queue
- Scanner Engine: TypeScript + Playwright (browser sandbox)
- AI Service: Python + FastAPI (anthropic, google-genai, ollama SDKs)
- Database: PostgreSQL (Drizzle ORM) + Redis (ioredis)
- Auth: NextAuth.js (Auth.js v5)
- Payments: Stripe
- Fuzzer: Python (mutation engine, grammar fuzzer)

## INSTRUKSI SCAFFOLDING

Buat SEMUA folder dan file berikut. Untuk setiap file, buat boilerplate code yang minimal tapi fungsional (bukan placeholder kosong). Setiap file harus:
1. Punya import/export yang benar
2. Punya TypeScript types/interfaces jika TypeScript
3. Punya komentar yang menjelaskan fungsi module
4. Bisa di-build tanpa error

### ROOT FILES

```
xssploit/
├── package.json              → pnpm workspace root, scripts: dev, build, lint, test
├── pnpm-workspace.yaml       → packages: ["packages/*"]
├── turbo.json                → pipeline: build, dev, lint, test
├── tsconfig.base.json        → shared TypeScript config (strict mode)
├── .env.example              → semua env vars yang dibutuhkan
├── .gitignore                → node_modules, dist, .env, data/*, reports/output/*
├── .eslintrc.js              → ESLint config
├── .prettierrc               → Prettier config
├── docker-compose.yaml       → PostgreSQL + Redis + app services
├── docker-compose.prod.yaml  → Production compose
├── Makefile                  → shortcuts: make dev, make build, make test
├── LICENSE                   → MIT License
└── README.md                 → Project overview + setup instructions
```

### PACKAGES

#### packages/shared/
Shared types, constants, dan utilities.

```
packages/shared/
├── package.json              → name: @xssploit/shared
├── tsconfig.json             → extends ../../tsconfig.base.json
└── src/
    ├── index.ts              → re-export semua
    ├── types/
    │   ├── scan.ts           → ScanConfig, ScanStatus, ScanResult interfaces
    │   ├── vulnerability.ts  → Vulnerability, VulnType, Severity enums/interfaces
    │   ├── payload.ts        → Payload, PayloadCategory, PayloadIndex interfaces
    │   ├── user.ts           → User, Organization, OrgMember interfaces
    │   ├── subscription.ts   → SubscriptionTier enum, TierFeatures interface
    │   └── webhook.ts        → WebhookConfig, WebhookEvent interfaces
    ├── constants/
    │   ├── tiers.ts          → TIER_FEATURES object (Free/Starter/Pro/Enterprise limits)
    │   ├── limits.ts         → Rate limits, scan limits per tier
    │   ├── xss-types.ts      → XSS_TYPES enum (reflected, stored, dom, blind, mxss, clobbering)
    │   └── scan-profiles.ts  → SCAN_PROFILES (quick, deep, stealth, dom-only, blind, api)
    └── utils/
        ├── validators.ts     → validateUrl, validateScope, validatePayload
        └── formatters.ts     → formatDuration, formatBytes, formatSeverity
```

#### packages/engine/
Scanner engine — core scanning logic.

```
packages/engine/
├── package.json              → name: @xssploit/engine, dependencies: playwright, acorn, js-yaml
├── tsconfig.json
└── src/
    ├── index.ts              → export scanner entry point
    │
    ├── core/
    │   ├── ai/
    │   │   ├── orchestrator.ts          → class AIOrchestrator: main AI decision loop
    │   │   ├── provider-manager.ts      → class ProviderManager: tiered fallback (claude→agy→ollama→noai)
    │   │   ├── providers/
    │   │   │   ├── base-provider.ts     → abstract class BaseAIProvider { analyze(), suggest(), classify() }
    │   │   │   ├── claude-provider.ts   → class ClaudeProvider extends BaseAIProvider
    │   │   │   ├── antigravity-provider.ts → class AntigravityProvider extends BaseAIProvider
    │   │   │   ├── ollama-provider.ts   → class OllamaProvider extends BaseAIProvider
    │   │   │   └── no-ai-provider.ts    → class NoAIProvider: rule-based fallback
    │   │   ├── payload-selector.ts      → class PayloadSelector: AI-powered payload selection
    │   │   ├── context-detector.ts      → class ContextDetector: detect injection context
    │   │   ├── vulnerability-classifier.ts → class VulnClassifier: classify severity
    │   │   ├── token-budget.ts          → class TokenBudget: track AI token usage
    │   │   └── prompt-templates/
    │   │       ├── analyze-response.md
    │   │       ├── suggest-payload.md
    │   │       ├── suggest-bypass.md
    │   │       ├── classify-vuln.md
    │   │       └── analyze-csp.md
    │   │
    │   ├── crawler/
    │   │   ├── spider.ts                → class Spider: crawl website
    │   │   ├── form-discoverer.ts       → class FormDiscoverer: find all forms & inputs
    │   │   ├── parameter-extractor.ts   → class ParameterExtractor: extract params from URL/body
    │   │   ├── endpoint-mapper.ts       → class EndpointMapper: map all endpoints
    │   │   ├── link-extractor.ts        → class LinkExtractor: extract all links
    │   │   ├── sitemap-parser.ts        → class SitemapParser: parse sitemap.xml
    │   │   └── tech-detector.ts         → class TechDetector: detect framework & tech stack
    │   │
    │   ├── injector/
    │   │   ├── injection-engine.ts      → class InjectionEngine: main injection loop
    │   │   ├── payload-loader.ts        → class PayloadLoader: load from payloads/ folder
    │   │   ├── payload-mutator.ts       → class PayloadMutator: encode/obfuscate payloads
    │   │   ├── request-builder.ts       → class RequestBuilder: build HTTP req with payload
    │   │   ├── chain-builder.ts         → class ChainBuilder: multi-step payload chains
    │   │   └── delivery-methods/
    │   │       ├── get-parameter.ts     → injectViaGetParam()
    │   │       ├── post-body.ts         → injectViaPostBody()
    │   │       ├── header-injection.ts  → injectViaHeader()
    │   │       ├── cookie-injection.ts  → injectViaCookie()
    │   │       ├── fragment-injection.ts → injectViaFragment()
    │   │       ├── multipart-injection.ts → injectViaMultipart()
    │   │       └── json-injection.ts    → injectViaJson()
    │   │
    │   ├── analyzer/
    │   │   ├── response-analyzer.ts     → class ResponseAnalyzer
    │   │   ├── reflection-detector.ts   → class ReflectionDetector
    │   │   ├── filter-detector.ts       → class FilterDetector
    │   │   ├── csp-analyzer.ts          → class CSPAnalyzer
    │   │   ├── diff-engine.ts           → class DiffEngine
    │   │   ├── js-static-analyzer.ts    → class JSStaticAnalyzer: analyze JS files
    │   │   ├── redirect-chain.ts        → class RedirectChain: open redirect → XSS
    │   │   ├── endpoint-extractor.ts    → extractEndpointsFromJS()
    │   │   ├── secret-finder.ts         → findSecretsInJS()
    │   │   └── library-detector.ts      → detectVulnerableLibraries()
    │   │
    │   ├── auth/
    │   │   ├── auth-manager.ts          → class AuthManager
    │   │   ├── cookie-handler.ts        → class CookieHandler
    │   │   ├── token-handler.ts         → class TokenHandler
    │   │   ├── form-login.ts            → class FormLogin: auto-fill & submit login
    │   │   ├── oauth-handler.ts         → class OAuthHandler
    │   │   └── session-recorder.ts      → class SessionRecorder: record browser login
    │   │
    │   ├── recon/
    │   │   ├── recon-manager.ts         → class ReconManager
    │   │   ├── waf-fingerprinter.ts     → class WAFFingerprinter
    │   │   ├── tech-stack-detector.ts   → class TechStackDetector
    │   │   ├── wayback-miner.ts         → class WaybackMiner
    │   │   ├── parameter-miner.ts       → class ParameterMiner
    │   │   └── js-endpoint-miner.ts     → class JSEndpointMiner
    │   │
    │   ├── exfiltration/
    │   │   ├── exfil-manager.ts         → class ExfilManager
    │   │   ├── payloads/
    │   │   │   ├── cookie-stealer.js    → document.cookie exfil payload template
    │   │   │   ├── keylogger.js         → keylogger payload template
    │   │   │   ├── dom-grabber.js       → DOM snapshot payload
    │   │   │   ├── screenshot.js        → html2canvas screenshot payload
    │   │   │   ├── form-interceptor.js  → credential harvester payload
    │   │   │   ├── storage-exfil.js     → localStorage/sessionStorage payload
    │   │   │   └── clipboard-reader.js  → clipboard access payload
    │   │   └── delivery/
    │   │       ├── fetch-delivery.ts    → FetchDelivery class
    │   │       ├── image-delivery.ts    → ImageDelivery class (bypass CORS)
    │   │       └── dns-delivery.ts      → DNSDelivery class (stealth)
    │   │
    │   ├── post-exploit/
    │   │   ├── post-exploit-manager.ts  → class PostExploitManager
    │   │   ├── session-hijack.ts        → sessionHijackPoC()
    │   │   ├── keylogger-inject.ts      → keyloggerPoC()
    │   │   ├── phishing-overlay.ts      → phishingOverlayPoC()
    │   │   ├── impact-scorer.ts         → class ImpactScorer: calculate real impact
    │   │   └── templates/
    │   │       ├── fake-login.html      → phishing overlay HTML template
    │   │       └── defacement.html      → defacement PoC template
    │   │
    │   ├── protocols/
    │   │   ├── websocket-tester.ts      → class WebSocketTester
    │   │   ├── graphql-tester.ts        → class GraphQLTester
    │   │   ├── postmessage-tester.ts    → class PostMessageTester
    │   │   └── sse-tester.ts            → class SSETester
    │   │
    │   ├── proxy/
    │   │   ├── proxy-server.ts          → class PassiveProxyServer (MITM)
    │   │   ├── passive-analyzer.ts      → class PassiveAnalyzer
    │   │   └── traffic-recorder.ts      → class TrafficRecorder
    │   │
    │   └── scope/
    │       ├── scope-manager.ts         → class ScopeManager
    │       └── scope-validator.ts       → class ScopeValidator
    │
    ├── sandbox/
    │   ├── browser/
    │   │   ├── browser-manager.ts       → class BrowserManager: manage Playwright instances
    │   │   ├── page-controller.ts       → class PageController
    │   │   ├── screenshot-capture.ts    → class ScreenshotCapture
    │   │   ├── network-interceptor.ts   → class NetworkInterceptor
    │   │   └── har-recorder.ts          → class HARRecorder
    │   │
    │   ├── stealth/
    │   │   ├── stealth-plugin.ts        → class StealthPlugin: patch webdriver detection
    │   │   ├── fingerprint-randomizer.ts → class FingerprintRandomizer
    │   │   ├── canvas-spoof.ts          → spoofCanvasFingerprint()
    │   │   └── webgl-spoof.ts           → spoofWebGLFingerprint()
    │   │
    │   ├── js-engine/
    │   │   ├── dom-monitor.ts           → class DOMMonitor: MutationObserver wrapper
    │   │   ├── sink-tracker.ts          → class SinkTracker: hook innerHTML, eval, etc.
    │   │   ├── source-tracker.ts        → class SourceTracker: track location.*, postMessage
    │   │   ├── taint-analyzer.ts        → class TaintAnalyzer: source→sink flow
    │   │   ├── event-hook.ts            → class EventHook: intercept event listeners
    │   │   ├── js-parser.ts             → class JSParser: Acorn-based AST analysis
    │   │   ├── prototype-monitor.ts     → class PrototypeMonitor
    │   │   ├── execution-tracer.ts      → class ExecutionTracer
    │   │   ├── clobbering-detector.ts   → class ClobberingDetector
    │   │   └── mxss-detector.ts         → class MXSSDetector
    │   │
    │   ├── csp/
    │   │   ├── csp-parser.ts            → class CSPParser: parse CSP header string
    │   │   ├── csp-evaluator.ts         → class CSPEvaluator: evaluate CSP strength
    │   │   └── csp-bypass-engine.ts     → class CSPBypassEngine
    │   │
    │   ├── hooks/                        → JavaScript files (NOT TypeScript!) injected into target page
    │   │   ├── alert-hook.js            → hook window.alert/confirm/prompt
    │   │   ├── console-hook.js          → hook console.*
    │   │   ├── fetch-hook.js            → hook fetch() and XMLHttpRequest
    │   │   ├── cookie-hook.js           → hook document.cookie getter/setter
    │   │   ├── storage-hook.js          → hook localStorage/sessionStorage
    │   │   ├── navigation-hook.js       → hook location changes
    │   │   ├── websocket-hook.js        → hook WebSocket
    │   │   └── postmessage-hook.js      → hook window.postMessage
    │   │
    │   └── detection/
    │       ├── popup-detector.ts        → class PopupDetector
    │       ├── dom-change-detector.ts   → class DOMChangeDetector
    │       ├── script-execution-detector.ts → class ScriptExecutionDetector
    │       ├── exfiltration-detector.ts → class ExfiltrationDetector
    │       └── rules/
    │           ├── xss-confirmed.yaml   → detection rules for confirmed XSS
    │           ├── xss-potential.yaml   → detection rules for potential XSS
    │           └── false-positive.yaml  → false positive filter rules
    │
    ├── network/
    │   ├── proxy-chain.ts               → class ProxyChain: SOCKS5/HTTP/Tor chaining
    │   ├── proxy-rotator.ts             → class ProxyRotator
    │   ├── ua-rotator.ts                → class UARotator
    │   ├── ua-database.json             → 500+ real User-Agent strings
    │   ├── rate-limiter.ts              → class RateLimiter: adaptive rate limiting
    │   ├── request-throttle.ts          → class RequestThrottle: with jitter
    │   ├── tls-fingerprint.ts           → class TLSFingerprint
    │   └── tor-integration.ts           → class TorIntegration
    │
    ├── callback/
    │   ├── server.ts                    → class CallbackServer: HTTPS listener for blind XSS
    │   ├── payload-generator.ts         → class CallbackPayloadGenerator
    │   ├── data-collector.ts            → class DataCollector: collect exfil data
    │   ├── notification.ts              → class NotificationManager: alert on trigger
    │   ├── webhook/
    │   │   ├── webhook-manager.ts       → class WebhookManager
    │   │   ├── discord-webhook.ts       → class DiscordWebhook
    │   │   ├── telegram-bot.ts          → class TelegramBot
    │   │   ├── slack-webhook.ts         → class SlackWebhook
    │   │   └── custom-webhook.ts        → class CustomWebhook
    │   └── templates/
    │       ├── basic-callback.js        → minimal callback payload
    │       ├── full-exfil.js            → full exfiltration payload
    │       └── screenshot-callback.js   → screenshot + data payload
    │
    ├── reports/
    │   ├── generator/
    │   │   ├── report-builder.ts        → class ReportBuilder
    │   │   ├── evidence-collector.ts    → class EvidenceCollector
    │   │   ├── severity-scorer.ts       → class SeverityScorer: CVSS-like
    │   │   ├── remediation-advisor.ts   → class RemediationAdvisor: AI suggestions
    │   │   └── poc-generator.ts         → class PoCGenerator: auto PoC URL/HTML
    │   ├── templates/
    │   │   ├── html-report.hbs          → Handlebars HTML report template
    │   │   ├── markdown-report.md       → Markdown report template
    │   │   ├── sarif-report.json        → SARIF format template
    │   │   ├── junit-report.xml         → JUnit XML template
    │   │   ├── hackerone-report.hbs     → HackerOne bug bounty format
    │   │   └── bugcrowd-report.hbs      → Bugcrowd format
    │   └── output/
    │       └── .gitkeep
    │
    ├── config/
    │   ├── default.yaml                 → default scanner config
    │   ├── ai-config.yaml               → AI provider tiered config
    │   ├── browser-config.yaml          → Playwright browser settings
    │   ├── network-config.yaml          → proxy, UA, rate limit defaults
    │   ├── webhook-config.yaml          → webhook output config
    │   └── scan-profiles/
    │       ├── quick-scan.yaml
    │       ├── deep-scan.yaml
    │       ├── stealth-scan.yaml
    │       ├── dom-only.yaml
    │       ├── blind-xss.yaml
    │       └── api-scan.yaml
    │
    └── utils/
        ├── logger.ts                    → createLogger() using pino
        ├── http-client.ts               → class HTTPClient: undici wrapper
        ├── encoder.ts                   → encode/decode utilities (URL, HTML, Unicode, etc.)
        ├── sanitizer-fingerprint.ts     → class SanitizerFingerprint
        ├── hash.ts                      → sha256(), md5() utilities
        └── validator.ts                 → validateUrl(), validatePayload()
```

#### packages/api/
Backend API server.

```
packages/api/
├── package.json              → name: @xssploit/api, dependencies: fastify, bullmq, drizzle-orm, stripe, ioredis
├── tsconfig.json
└── src/
    ├── index.ts              → Fastify server entry point, register routes
    ├── routes/
    │   ├── scans.ts          → CRUD /api/scans, POST /api/scans/:id/start
    │   ├── vulnerabilities.ts → GET /api/vulnerabilities, GET /api/vulnerabilities/:id
    │   ├── payloads.ts       → GET /api/payloads, POST /api/payloads/upload
    │   ├── reports.ts        → GET /api/reports/:scanId, POST /api/reports/:scanId/export
    │   ├── webhooks.ts       → CRUD /api/webhooks
    │   ├── billing.ts        → GET /api/billing/usage, POST /api/billing/checkout
    │   ├── team.ts           → CRUD /api/team/members, PATCH /api/team/members/:id/role
    │   ├── api-keys.ts       → CRUD /api/keys
    │   ├── auth.ts           → POST /api/auth/login, /api/auth/register, /api/auth/callback
    │   ├── recon.ts          → POST /api/recon/analyze (AI parse program description)
    │   └── callback.ts       → POST /api/callback/:token (blind XSS data receiver)
    ├── middleware/
    │   ├── auth.ts           → JWT validation middleware
    │   ├── rate-limit.ts     → per-tier rate limiting
    │   ├── feature-gate.ts   → check feature access by subscription tier
    │   └── usage-track.ts    → track usage (scans, AI tokens, API calls)
    ├── services/
    │   ├── scan-service.ts   → class ScanService: orchestrate scans via job queue
    │   ├── billing-service.ts → class BillingService: Stripe integration
    │   ├── notification-service.ts → class NotificationService: email, webhook
    │   ├── usage-service.ts  → class UsageService: track & enforce limits
    │   ├── ai-parse-service.ts → class AIProgramParser: parse HackerOne/Bugcrowd description
    │   └── payload-service.ts → class PayloadService: manage payload library
    ├── queue/
    │   ├── scan-worker.ts    → BullMQ worker: process scan jobs
    │   └── report-worker.ts  → BullMQ worker: generate reports
    ├── db/
    │   ├── index.ts          → Drizzle ORM connection
    │   ├── schema.ts         → all tables: users, orgs, subscriptions, scans, vulns, etc.
    │   ├── migrate.ts        → migration runner
    │   └── seed.ts           → seed data for development
    ├── python-services/
    │   ├── ai_service.py     → FastAPI: /ai/analyze, /ai/suggest, /ai/classify
    │   ├── fuzzer_service.py → FastAPI: /fuzzer/mutate, /fuzzer/generate
    │   └── requirements.txt  → anthropic, google-genai, ollama, fastapi, uvicorn
    └── stripe/
        ├── webhook-handler.ts → handle Stripe webhook events
        └── plans.ts          → Stripe price IDs per tier
```

#### packages/dashboard/
Next.js frontend dashboard.

```
packages/dashboard/
├── package.json              → name: @xssploit/dashboard, deps: next, react, tailwindcss, @shadcn/ui
├── tsconfig.json
├── next.config.js            → Next.js config with API rewrites
├── tailwind.config.ts        → Tailwind config with custom theme (dark, purple/blue accents)
├── postcss.config.js
├── components.json           → shadcn/ui config
└── src/
    ├── app/
    │   ├── layout.tsx        → Root layout: html, body, font (Inter), ThemeProvider
    │   ├── globals.css       → Tailwind directives + custom CSS variables (dark theme)
    │   │
    │   ├── (marketing)/      → Public pages (no auth required)
    │   │   ├── page.tsx      → Landing page: hero, features, pricing preview, CTA
    │   │   ├── pricing/
    │   │   │   └── page.tsx  → Full pricing page with tier comparison table
    │   │   └── layout.tsx    → Marketing layout (different header/footer)
    │   │
    │   ├── (auth)/           → Auth pages
    │   │   ├── login/
    │   │   │   └── page.tsx  → Login form: email/password + OAuth buttons (Google, GitHub)
    │   │   ├── register/
    │   │   │   └── page.tsx  → Register form
    │   │   └── layout.tsx    → Centered auth layout
    │   │
    │   ├── (dashboard)/      → Protected dashboard pages
    │   │   ├── layout.tsx    → Dashboard layout: sidebar + header + main content
    │   │   ├── page.tsx      → Dashboard home/overview: stats cards, recent scans, AI credits
    │   │   ├── scans/
    │   │   │   ├── page.tsx  → Scan history list
    │   │   │   ├── new/
    │   │   │   │   └── page.tsx → 5-step scan wizard form (THE MAIN FORM)
    │   │   │   └── [id]/
    │   │   │       └── page.tsx → Live scan view + results
    │   │   ├── vulnerabilities/
    │   │   │   ├── page.tsx  → All vulnerabilities list (filterable)
    │   │   │   └── [id]/
    │   │   │       └── page.tsx → Vuln detail: PoC, screenshot, remediation
    │   │   ├── payloads/
    │   │   │   └── page.tsx  → Payload library browser (search, filter, categories)
    │   │   ├── recon/
    │   │   │   └── page.tsx  → Recon module (WAF detect, tech stack, param mining)
    │   │   ├── blind-xss/
    │   │   │   └── page.tsx  → Blind XSS monitor (callback list, triggered alerts)
    │   │   ├── reports/
    │   │   │   └── page.tsx  → Reports list + export (HTML, PDF, SARIF, bug bounty)
    │   │   ├── integrations/
    │   │   │   └── page.tsx  → Webhooks, CI/CD, API keys management
    │   │   ├── team/
    │   │   │   └── page.tsx  → Team members, roles, invite
    │   │   ├── billing/
    │   │   │   └── page.tsx  → Plans, usage, invoices, upgrade
    │   │   └── settings/
    │   │       └── page.tsx  → Profile, AI config, notification preferences
    │   │
    │   └── api/              → Next.js API routes
    │       ├── auth/
    │       │   └── [...nextauth]/
    │       │       └── route.ts → NextAuth handler
    │       └── stripe/
    │           └── webhook/
    │               └── route.ts → Stripe webhook receiver
    │
    ├── components/
    │   ├── ui/               → shadcn/ui components (button, card, input, dialog, etc.)
    │   │   └── (install via: npx shadcn@latest add button card input ...)
    │   ├── layout/
    │   │   ├── sidebar.tsx   → Dashboard sidebar navigation
    │   │   ├── header.tsx    → Top header with user menu
    │   │   └── mobile-nav.tsx
    │   ├── scan/
    │   │   ├── scan-wizard.tsx         → 5-step wizard container
    │   │   ├── step-target.tsx         → Step 1: Target & Program Description
    │   │   ├── step-scope.tsx          → Step 2: Scope & Rules
    │   │   ├── step-auth.tsx           → Step 3: Authentication
    │   │   ├── step-config.tsx         → Step 4: Configuration & Mode
    │   │   ├── step-review.tsx         → Step 5: Review & Launch
    │   │   ├── live-scan-feed.tsx      → Real-time scan progress feed
    │   │   ├── scan-card.tsx           → Scan history card
    │   │   └── scan-mode-selector.tsx  → Mode selection cards (Quick/Deep/Stealth/...)
    │   ├── vuln/
    │   │   ├── vuln-card.tsx           → Vulnerability list item card
    │   │   ├── vuln-detail.tsx         → Full vulnerability detail view
    │   │   ├── severity-badge.tsx      → Colored severity badge
    │   │   └── poc-viewer.tsx          → PoC code/URL viewer
    │   ├── payload/
    │   │   ├── payload-browser.tsx     → Searchable payload list
    │   │   ├── payload-filters.tsx     → Category/source/technique filters
    │   │   └── payload-stats.tsx       → Payload collection statistics
    │   ├── charts/
    │   │   ├── severity-chart.tsx      → Pie chart by severity
    │   │   ├── scan-timeline.tsx       → Timeline chart
    │   │   └── usage-chart.tsx         → Usage bar chart
    │   ├── billing/
    │   │   ├── plan-card.tsx           → Subscription plan card
    │   │   ├── usage-meter.tsx         → Usage progress bars
    │   │   └── invoice-list.tsx        → Invoice history table
    │   └── common/
    │       ├── loading.tsx             → Loading spinner
    │       ├── empty-state.tsx         → Empty state illustration
    │       └── error-boundary.tsx      → Error boundary
    │
    ├── lib/
    │   ├── auth.ts           → NextAuth config (Google, GitHub, Credentials providers)
    │   ├── stripe.ts         → Stripe client initialization
    │   ├── api-client.ts     → fetch wrapper for backend API
    │   ├── socket.ts         → Socket.io client for real-time updates
    │   └── utils.ts          → cn() helper, misc utils
    │
    ├── hooks/
    │   ├── use-scan.ts       → useScan() hook: fetch scan data
    │   ├── use-vulns.ts      → useVulnerabilities() hook
    │   ├── use-payloads.ts   → usePayloads() hook with search/filter
    │   ├── use-subscription.ts → useSubscription() hook: tier info
    │   └── use-realtime.ts   → useRealtime() hook: WebSocket connection
    │
    └── store/
        ├── scan-store.ts     → Zustand: scan wizard state
        ├── auth-store.ts     → Zustand: user/session state
        └── ui-store.ts       → Zustand: sidebar, theme, modals
```

### PAYLOADS FOLDER (root level, shared)

```
payloads/
├── all-the-things/           → PayloadsAllTheThings XSS payloads (downloaded)
│   └── .gitkeep
├── context-based/
│   ├── html-context.txt      → placeholder: "# HTML Context Payloads\n# Run: xss-scan payload download"
│   ├── attribute-context.txt
│   ├── javascript-context.txt
│   ├── url-context.txt
│   ├── css-context.txt
│   ├── svg-context.txt
│   └── template-context.txt
├── encoding/
│   └── .gitkeep
├── waf-bypass/
│   └── .gitkeep
├── framework-specific/
│   └── .gitkeep
├── csp-bypass/
│   └── .gitkeep
├── protocol-specific/
│   └── .gitkeep
├── blind-xss/
│   └── .gitkeep
├── polyglot/
│   └── .gitkeep
├── dom-clobbering/
│   └── .gitkeep
├── mxss/
│   └── .gitkeep
├── ai-generated/
│   └── .gitkeep
├── custom/
│   ├── .gitkeep
│   └── my-payloads.txt       → "# Add your custom payloads here, one per line"
└── payload-index.json        → { "version": "1.0", "sources": [], "categories": {}, "total": 0 }
```

### SCRIPTS

```
scripts/
├── setup.sh                  → install all deps (pnpm install, pip install, etc.)
├── payload-collector/
│   ├── collect.sh            → master download script
│   ├── sources.yaml          → all 30+ payload sources defined
│   ├── downloaders/
│   │   ├── github-cloner.sh  → clone GitHub repos
│   │   └── web-scraper.py    → scrape PortSwigger, HTML5sec, etc.
│   └── processors/
│       ├── categorizer.py    → auto-categorize payloads
│       ├── deduplicator.py   → remove duplicate payloads
│       └── index-builder.py  → build payload-index.json
├── install-ollama.sh         → install Ollama + pull llama3.1
└── build.sh                  → build all packages
```

### INFRASTRUCTURE

```
infra/
├── docker/
│   ├── Dockerfile.dashboard  → Next.js production build
│   ├── Dockerfile.api        → Node.js API server
│   ├── Dockerfile.engine     → Scanner engine with Playwright
│   └── Dockerfile.callback   → Callback server
├── nginx/
│   └── nginx.conf            → reverse proxy config
└── scripts/
    ├── setup-dev.sh          → setup local dev environment
    ├── deploy.sh             → deploy to production
    └── backup-db.sh          → PostgreSQL backup
```

### TESTS

```
tests/
├── unit/                     → unit tests per module
│   └── .gitkeep
├── integration/              → integration tests
│   └── .gitkeep
├── e2e/                      → end-to-end tests
│   └── .gitkeep
└── vulnerable-apps/          → local vulnerable apps for testing
    ├── basic-reflected.html  → simple reflected XSS page
    ├── dom-based.html        → DOM-based XSS page
    ├── stored-xss-server.ts  → Express server with stored XSS
    ├── filtered-input.html   → page with input sanitization
    ├── csp-protected.html    → page with CSP headers
    └── websocket-app.html    → WebSocket XSS test page
```

### DOCS

```
docs/
├── architecture.md
├── payload-guide.md          → how to add custom payloads
├── ai-engine.md              → how AI engine works
├── deep-js-analysis.md       → taint tracking explained
├── network-stealth.md        → proxy chaining, UA rotation
├── plugin-development.md
├── ci-cd-integration.md
├── blind-xss-guide.md
├── api-reference.md          → REST API documentation
├── self-hosting-guide.md     → how to self-host
└── contributing.md
```

## IMPORTANT RULES FOR SCAFFOLDING

1. Setiap file TypeScript (.ts/.tsx) harus punya minimal: imports, type definitions, class/function skeleton, dan exports
2. Jangan buat file kosong — setiap file harus punya boilerplate code yang menjelaskan fungsinya
3. Semua class harus punya constructor dan method stubs dengan TODO comments
4. File YAML config harus punya contoh values yang masuk akal
5. File .js di folder hooks/ adalah plain JavaScript (bukan TypeScript) karena di-inject ke browser target
6. Pastikan package.json punya semua dependencies yang dibutuhkan
7. Gunakan pnpm workspace protocol: "@xssploit/shared": "workspace:*"
8. Semua file harus UTF-8, LF line endings, 2-space indent

Setelah scaffolding, jalankan:
```bash
cd xssploit
pnpm install
pnpm build
```

Pastikan build berhasil tanpa error.
````

---

## 📦 Phase-by-Phase Prompts

> Kalau mau build **bertahap** (bukan sekaligus), gunakan prompt per-fase di bawah ini.

### Phase 1: Monorepo Root & Config

```
Buatkan monorepo root untuk project XSSPLOIT di folder ./xssploit/ dengan:

1. package.json — pnpm workspace root, scripts: dev, build, lint, test, clean
2. pnpm-workspace.yaml — packages: ["packages/*"]
3. turbo.json — pipeline: build (dependsOn ^build), dev (persistent), lint, test
4. tsconfig.base.json — strict: true, target: ES2022, module: ESNext, moduleResolution: bundler
5. .env.example — semua env: DATABASE_URL, REDIS_URL, CLAUDE_API_KEY, ANTHROPIC_API_KEY, ANTIGRAVITY_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL, DISCORD_WEBHOOK_URL, TELEGRAM_BOT_TOKEN, CALLBACK_SERVER_URL, OLLAMA_BASE_URL
6. .gitignore — node_modules, dist, .next, .env, data/scans/*, reports/output/*, payloads/all-the-things/*, payloads/ai-generated/*
7. .eslintrc.js — extends: next/core-web-vitals, @typescript-eslint
8. .prettierrc — semi: true, singleQuote: true, tabWidth: 2, trailingComma: all
9. docker-compose.yaml — services: postgres (port 5432), redis (port 6379)
10. Makefile — targets: dev, build, test, clean, setup, download-payloads
11. LICENSE — MIT
12. README.md — project overview, setup, architecture diagram reference
```

### Phase 2: Shared Package

```
Di dalam xssploit/packages/shared/, buatkan package @xssploit/shared dengan:

1. package.json — name: @xssploit/shared, main: dist/index.js, types: dist/index.d.ts
2. tsconfig.json — extends ../../tsconfig.base.json, outDir: dist, rootDir: src
3. src/index.ts — re-export semua types, constants, dan utils

Types (src/types/):
- scan.ts — interfaces: ScanConfig, ScanStatus (enum: queued/running/paused/done/failed), ScanResult, ScanProgress
- vulnerability.ts — interfaces: Vulnerability, VulnEvidence; enums: VulnType, Severity, VulnStatus
- payload.ts — interfaces: Payload, PayloadCategory, PayloadIndex, PayloadMetadata
- user.ts — interfaces: User, Organization, OrgMember, OrgRole enum
- subscription.ts — enum: SubscriptionTier (free/starter/pro/enterprise), interface: TierFeatures, TierLimits
- webhook.ts — interfaces: WebhookConfig, WebhookEvent; enum: WebhookType (discord/telegram/slack/custom)

Constants (src/constants/):
- tiers.ts — export const TIER_FEATURES: Record<SubscriptionTier, TierFeatures> dengan semua limit per tier (maxScans, maxPayloads, aiTokens, features boolean, dll.)
- limits.ts — export API_RATE_LIMITS, SCAN_LIMITS per tier
- xss-types.ts — export enum XSSType dan deskripsi per type
- scan-profiles.ts — export SCAN_PROFILES dengan config per profile

Utils (src/utils/):
- validators.ts — validateUrl(), validateScope(), validatePayload(), isInScope()
- formatters.ts — formatDuration(), formatBytes(), formatSeverity(), formatCVSS()

Pastikan semua types & constants LENGKAP sesuai tier comparison table di blueprint.
```

### Phase 3: Scanner Engine

```
Di dalam xssploit/packages/engine/, buatkan package @xssploit/engine.

Ini adalah scanner engine utama. Buat SEMUA folder dan file yang ada di daftar packages/engine/ di master prompt.

Setiap class harus punya:
1. Constructor dengan dependency injection
2. Method stubs (async methods dengan TODO comments)
3. Proper TypeScript types (import dari @xssploit/shared)
4. JSDoc comments menjelaskan fungsi

Dependencies: playwright, acorn, js-yaml, pino, undici, better-sqlite3, handlebars

PENTING:
- File di sandbox/hooks/ harus plain JavaScript (.js) karena di-inject ke browser
- File di core/exfiltration/payloads/ juga plain JavaScript
- Semua hook files harus wrap code dalam IIFE: (function(){ ... })();
- Buat config YAML files yang lengkap dengan contoh values
```

### Phase 4: Backend API

```
Di dalam xssploit/packages/api/, buatkan package @xssploit/api.

Backend API menggunakan Fastify + BullMQ + Drizzle ORM.

Buat SEMUA file di daftar packages/api/ di master prompt.

Untuk database schema (db/schema.ts), gunakan Drizzle ORM dan buat tabel:
- users, organizations, org_members
- subscriptions, usage_tracking
- scans, vulnerabilities, scan_endpoints
- blind_xss_callbacks
- api_keys, webhook_configs

Setiap route harus punya:
1. Request/response schema validation (Fastify schema)
2. Auth middleware
3. Feature gate check (tier-based)
4. Usage tracking

Dependencies: fastify, @fastify/cors, @fastify/jwt, bullmq, drizzle-orm, drizzle-kit, pg, ioredis, stripe, zod

Untuk python-services/:
- ai_service.py — FastAPI app dengan endpoints /ai/analyze, /ai/suggest-payload, /ai/classify-vuln, /ai/parse-program
- fuzzer_service.py — FastAPI app dengan endpoints /fuzzer/mutate, /fuzzer/generate, /fuzzer/encode
- requirements.txt — anthropic, google-genai, ollama, fastapi, uvicorn, pydantic
```

### Phase 5: Dashboard Frontend

```
Di dalam xssploit/packages/dashboard/, buatkan Next.js 14 app.

Gunakan: App Router, TypeScript, Tailwind CSS, shadcn/ui.

DESIGN REQUIREMENTS:
- Dark theme (#0a0a0f background, purple/blue accents)
- Glassmorphism pada cards (backdrop-blur, border opacity)
- Smooth animations (framer-motion)
- Premium cybersecurity aesthetic
- Responsive (mobile + desktop)

Install shadcn/ui components: button, card, input, textarea, select, badge, dialog, dropdown-menu, tabs, table, separator, progress, avatar, skeleton, alert, toast

Buat SEMUA pages dan components yang ada di daftar packages/dashboard/ di master prompt.

HALAMAN PALING PENTING — scans/new/page.tsx:
Ini adalah 5-step scan wizard form:
1. Target & Program — textarea untuk paste HackerOne/Bugcrowd description, target URL input, platform selector
2. Scope & Rules — in-scope/out-scope editor, XSS type checkboxes, crawl limits, rate limit slider
3. Authentication — method selector (None/Cookie/Token/Login/OAuth/Record), username/password fields, API key fields, CSS selector fields, "Test Login" button
4. Configuration — scan mode cards, payload category checkboxes, proxy settings, UA rotation, blind XSS toggle, webhook config, AI provider selector, token budget slider
5. Review & Launch — summary of all config, estimates, "Launch Scan" button with confirmation checkbox

Setiap step harus punya form validation, "Back" dan "Next" buttons, dan progress indicator.
```

### Phase 6: Payload Library

```
Di dalam xssploit/payloads/, buatkan folder structure lengkap:

Buat semua subfolder: all-the-things, context-based, encoding, waf-bypass, framework-specific, csp-bypass, protocol-specific, blind-xss, polyglot, dom-clobbering, mxss, ai-generated, custom

Untuk setiap folder:
- Buat .gitkeep jika folder akan diisi nanti (by download script)
- Buat contoh .txt files dengan 5-10 example payloads per file (untuk context-based/)

Buat payload-index.json dengan schema lengkap tapi data kosong (akan di-populate oleh collection script).

Di scripts/payload-collector/:
- collect.sh — bash script yang loop sources.yaml dan jalankan downloaders
- sources.yaml — daftar semua 30+ payload sources (lihat payload_collection_pipeline.md)
- downloaders/github-cloner.sh — git clone --depth 1, extract relevant files, cleanup
- downloaders/web-scraper.py — requests + beautifulsoup, scrape PortSwigger & HTML5sec
- processors/categorizer.py — regex-based + AI fallback categorization
- processors/deduplicator.py — normalize, hash, remove duplicates
- processors/index-builder.py — scan payloads/ folder, build payload-index.json

Setiap .txt payload file di context-based/ harus punya 5-10 contoh payload yang NYATA (bukan placeholder), misalnya:
- html-context.txt: <script>alert(1)</script>, <img src=x onerror=alert(1)>, dll.
- attribute-context.txt: " onfocus=alert(1) autofocus ", dll.
```

### Phase 7: Infrastructure

```
Buat infrastructure files:

infra/docker/:
- Dockerfile.dashboard — multi-stage: build Next.js → serve with node
- Dockerfile.api — Node.js API with pg, redis deps
- Dockerfile.engine — Node.js + Python + Playwright (browsers installed)
- Dockerfile.callback — lightweight Node.js server

infra/nginx/nginx.conf — reverse proxy: / → dashboard, /api → api, /callback → callback

scripts/:
- setup.sh — install node, pnpm, python, uv; pnpm install; pip install
- install-ollama.sh — curl install ollama, pull llama3.1:8b
- build.sh — pnpm build (triggers turbo)

tests/vulnerable-apps/:
- basic-reflected.html — HTML page: form dengan search parameter, reflected unsanitized
- dom-based.html — HTML page: reads location.hash, puts in innerHTML
- filtered-input.html — HTML page: strips <script> but not event handlers
- csp-protected.html — HTML page: has CSP header, tests CSP bypass
- websocket-app.html — HTML page: WebSocket echo server, reflects messages
- stored-xss-server.ts — Express server: comments stored in memory, rendered unsanitized

docs/ — buat semua .md files dengan outline content (headers + brief descriptions)
```

---

## ✅ Post-Scaffold Checklist

Setelah AI selesai scaffolding, verifikasi:

```bash
# 1. Check folder structure
find xssploit -type f | head -50

# 2. Install dependencies
cd xssploit && pnpm install

# 3. Build semua packages
pnpm build

# 4. Check TypeScript errors
pnpm typecheck

# 5. Count files created
find xssploit -type f | wc -l
# Expected: 200+ files

# 6. Check payload folders
ls -la xssploit/payloads/

# 7. Verify docker-compose
docker compose config
```

---

## 🏃 Run Instructions

```bash
# === DEVELOPMENT ===

# 1. Start infrastructure (PostgreSQL + Redis)
docker compose up -d

# 2. Setup database
cd packages/api && pnpm db:migrate && pnpm db:seed

# 3. Start all services (via turbo)
pnpm dev
# Dashboard:  http://localhost:3000
# API:        http://localhost:4000
# Python AI:  http://localhost:5000

# === PAYLOAD DOWNLOAD ===
bash scripts/payload-collector/collect.sh

# === FIRST SCAN ===
# 1. Open http://localhost:3000
# 2. Register account
# 3. Click "New Scan"
# 4. Paste HackerOne program description
# 5. Follow wizard → Launch!
```

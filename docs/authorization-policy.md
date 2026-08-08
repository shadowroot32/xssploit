# Authorization Policy

XSSPLOIT is an **offensive security testing tool**. It injects active payloads
into web applications. Running it against systems without explicit written
permission is illegal in most jurisdictions (CFAA, Computer Misuse Act, UU ITE, …).

## Rules of engagement for every scan

1. **Written authorization** — signed contract, bug bounty program scope page,
   or pentest agreement covering the target.
2. **Scope discipline** — configure `inScope` / `outOfScope` to match the
   program rules exactly. The engine hard-blocks anything outside scope.
3. **Rate respect** — stay within program rate limits; use the `stealth`
   profile where required.
4. **No destructive payloads** — this library intentionally ships only
   `alert`/callback proof primitives. Do not add data-exfiltration beyond
   demonstrating impact to the program owner.
5. **Audit trail** — always pass `--program` so scans are attributable in
   reports and in `AUTHORIZATION_LOG.md`.

## The tool will

- Refuse non-http(s) targets.
- Respect robots.txt when configured.
- Never scan outside the declared scope, even if crawled links point there.

## The tool will NOT protect you from

- Scanning without permission.
- Ignoring program-specific rules (e.g. "no automated scanners").
- Local laws you are responsible for knowing.

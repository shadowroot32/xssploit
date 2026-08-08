'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';

/**
 * 5-step scan launcher per scan_launcher_ui_design.md:
 * 1 Target → 2 Scope → 3 Scan types & profile → 4 Auth & advanced → 5 Review & launch.
 */
const STEPS = ['Target', 'Scope', 'Types & Profile', 'Auth & Advanced', 'Review'] as const;
const PROFILES = ['quick', 'deep', 'stealth', 'dom-only', 'blind', 'api'] as const;

export function NewScanWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    targetUrl: '',
    program: '',
    inScope: '',
    outOfScope: '',
    profile: 'quick' as (typeof PROFILES)[number],
    reflected: true,
    dom: true,
    stored: false,
    blind: false,
    callbackBase: '',
    rateLimit: '20',
    maxPages: '50',
    crawlDepth: '2',
    timeout: '900',
    authMethod: 'none' as 'none' | 'cookie' | 'bearer',
    cookie: '',
    token: '',
    categories: '',
    ai: true,
    respectRobots: true,
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const canNext =
    step === 0 ? /^https?:\/\/.+/.test(form.targetUrl)
    : step === 4 ? true
    : true;

  async function launch() {
    setBusy(true);
    setError(null);
    try {
      const { scanId } = await api.startScan({
        targetUrl: form.targetUrl,
        program: form.program || undefined,
        profile: form.profile,
        types: { reflected: form.reflected, dom: form.dom, stored: form.stored, blind: form.blind },
        inScope: form.inScope.split('\n').map((s) => s.trim()).filter(Boolean),
        outOfScope: form.outOfScope.split('\n').map((s) => s.trim()).filter(Boolean),
        auth:
          form.authMethod === 'cookie'
            ? { method: 'cookie', cookie: form.cookie }
            : form.authMethod === 'bearer'
              ? { method: 'bearer', token: form.token }
              : { method: 'none' },
        rateLimit: Number(form.rateLimit) || 20,
        maxPages: Number(form.maxPages) || 50,
        crawlDepth: Number(form.crawlDepth) || 2,
        timeout: Number(form.timeout) || 900,
        payloadCategories: form.categories.split(',').map((s) => s.trim()).filter(Boolean),
        ai: { enabled: form.ai, maxTokens: 50_000 },
        blindXss: { enabled: form.blind, callbackBase: form.callbackBase || undefined },
        notify: true,
        respectRobots: form.respectRobots,
      });
      router.push(`/scans/${scanId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-6">
      {/* Stepper */}
      <ol className="flex items-center gap-2 text-xs">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${i <= step ? 'border-accent-500 text-accent-400' : 'border-base-700 text-zinc-500'}`}>
              {i + 1}
            </span>
            <span className={i <= step ? 'text-zinc-200' : 'text-zinc-500'}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-base-700" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="label">Target URL *</label>
            <input className="input" placeholder="https://app.example.com" value={form.targetUrl} onChange={(e) => set('targetUrl', e.target.value)} />
            <p className="mt-1 text-xs text-zinc-500">Only scan targets you are authorized to test.</p>
          </div>
          <div>
            <label className="label">Bug bounty program (optional)</label>
            <input className="input" placeholder="acme-corp-h1" value={form.program} onChange={(e) => set('program', e.target.value)} />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="label">In-scope patterns (one per line)</label>
            <textarea className="input h-24" placeholder={'app.example.com\n*.api.example.com'} value={form.inScope} onChange={(e) => set('inScope', e.target.value)} />
            <p className="mt-1 text-xs text-zinc-500">Empty = target host only.</p>
          </div>
          <div>
            <label className="label">Out-of-scope patterns</label>
            <textarea className="input h-24" placeholder={'logout.example.com\n/payments/*'} value={form.outOfScope} onChange={(e) => set('outOfScope', e.target.value)} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="label">Profile</label>
            <div className="grid grid-cols-3 gap-2">
              {PROFILES.map((p) => (
                <button key={p} type="button" onClick={() => set('profile', p)}
                  className={`rounded-lg border px-3 py-2 text-sm ${form.profile === p ? 'border-accent-500 bg-accent-600/20 text-accent-400' : 'border-base-700 text-zinc-400 hover:bg-base-800'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Vulnerability types</label>
            <div className="space-y-2 text-sm">
              {([['reflected', 'Reflected XSS'], ['dom', 'DOM-based XSS'], ['stored', 'Stored XSS (two-phase)'], ['blind', 'Blind XSS (callback)']] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-zinc-300">
                  <input type="checkbox" checked={form[key]} onChange={(e) => set(key, e.target.checked)} className="accent-accent-500" />
                  {label}
                </label>
              ))}
            </div>
          </div>
          {form.blind && (
            <div>
              <label className="label">Callback base URL</label>
              <input className="input" placeholder="http://cb.example.com:5001" value={form.callbackBase} onChange={(e) => set('callbackBase', e.target.value)} />
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className="label">Authentication</label>
            <select className="input" value={form.authMethod} onChange={(e) => set('authMethod', e.target.value as typeof form.authMethod)}>
              <option value="none">None</option>
              <option value="cookie">Cookie header</option>
              <option value="bearer">Bearer token</option>
            </select>
          </div>
          {form.authMethod === 'cookie' && (
            <div><label className="label">Cookie</label><input className="input" placeholder="session=abc123; …" value={form.cookie} onChange={(e) => set('cookie', e.target.value)} /></div>
          )}
          {form.authMethod === 'bearer' && (
            <div><label className="label">Token</label><input className="input" placeholder="eyJ…" value={form.token} onChange={(e) => set('token', e.target.value)} /></div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Rate limit (req/s)</label><input className="input" type="number" value={form.rateLimit} onChange={(e) => set('rateLimit', e.target.value)} /></div>
            <div><label className="label">Max pages</label><input className="input" type="number" value={form.maxPages} onChange={(e) => set('maxPages', e.target.value)} /></div>
            <div><label className="label">Crawl depth</label><input className="input" type="number" value={form.crawlDepth} onChange={(e) => set('crawlDepth', e.target.value)} /></div>
            <div><label className="label">Timeout (s)</label><input className="input" type="number" value={form.timeout} onChange={(e) => set('timeout', e.target.value)} /></div>
          </div>
          <div>
            <label className="label">Payload categories (comma, empty = all)</label>
            <input className="input" placeholder="html-body, html-attribute, js-string" value={form.categories} onChange={(e) => set('categories', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={form.ai} onChange={(e) => set('ai', e.target.checked)} className="accent-accent-500" />
            AI payload tuning & analysis (tiered fallback)
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={form.respectRobots} onChange={(e) => set('respectRobots', e.target.checked)} className="accent-accent-500" />
            Respect robots.txt
          </label>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-2 text-sm">
          <h3 className="font-semibold text-white">Review</h3>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-zinc-300">
            <dt className="text-zinc-500">Target</dt><dd className="break-all">{form.targetUrl}</dd>
            <dt className="text-zinc-500">Profile</dt><dd>{form.profile}</dd>
            <dt className="text-zinc-500">Types</dt><dd>{[form.reflected && 'reflected', form.dom && 'dom', form.stored && 'stored', form.blind && 'blind'].filter(Boolean).join(', ') || 'none'}</dd>
            <dt className="text-zinc-500">Rate limit</dt><dd>{form.rateLimit} req/s</dd>
            <dt className="text-zinc-500">Auth</dt><dd>{form.authMethod}</dd>
            <dt className="text-zinc-500">AI</dt><dd>{form.ai ? 'enabled' : 'disabled'}</dd>
          </dl>
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            ⚠️ By launching you confirm you have written authorization to test this target.
          </p>
          {error && <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</p>}
        </div>
      )}

      <div className="flex justify-between">
        <button className="btn-ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>← Back</button>
        {step < STEPS.length - 1 ? (
          <button className="btn-primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Next →</button>
        ) : (
          <button className="btn-primary" disabled={busy} onClick={launch}>{busy ? 'Launching…' : '🚀 Launch Scan'}</button>
        )}
      </div>
    </div>
  );
}

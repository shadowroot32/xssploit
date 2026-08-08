'use client';

import { useState } from 'react';

/**
 * Webhook management (Discord / Telegram notifications).
 * Env-var note: TELEGRAM_* keys are server-side only; Discord webhooks can be stored here.
 */
export function SettingsForm() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
      const res = await fetch(`${base}/api/webhooks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'discord', url }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setStatus('✅ Discord webhook saved — scan events will be posted there.');
      setUrl('');
    } catch (err) {
      setStatus(`❌ ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-white">Notifications</h3>
      <div>
        <label className="label">Discord webhook URL</label>
        <input className="input" placeholder="https://discord.com/api/webhooks/…" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <button className="btn-primary" disabled={busy || !url.startsWith('http')} onClick={save}>
        {busy ? 'Saving…' : 'Save webhook'}
      </button>
      {status && <p className="text-sm text-zinc-300">{status}</p>}
    </div>
  );
}

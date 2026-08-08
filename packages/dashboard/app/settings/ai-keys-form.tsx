'use client';

import { useEffect, useState } from 'react';
import { api, type AISettingsView } from '@/lib/api';

type SecretKey = 'anthropicApiKey' | 'antigravityApiKey' | 'deepseekApiKey';
type PlainKey = 'antigravityBaseUrl' | 'deepseekBaseUrl' | 'ollamaBaseUrl' | 'ollamaModel';

const SECRET_FIELDS: { key: SecretKey; label: string; hint: string }[] = [
  { key: 'anthropicApiKey', label: 'Claude (Anthropic) API key', hint: 'tier 1 — console.anthropic.com' },
  { key: 'antigravityApiKey', label: 'Antigravity API key', hint: 'tier 2 — OpenAI-compatible' },
  { key: 'deepseekApiKey', label: 'DeepSeek API key', hint: 'tier 3 — platform.deepseek.com' },
];

const PLAIN_FIELDS: { key: PlainKey; label: string }[] = [
  { key: 'antigravityBaseUrl', label: 'Antigravity base URL' },
  { key: 'deepseekBaseUrl', label: 'DeepSeek base URL' },
  { key: 'ollamaBaseUrl', label: 'Ollama base URL (tier 4)' },
  { key: 'ollamaModel', label: 'Ollama model' },
];

const EMPTY: AISettingsView = {
  anthropicApiKey: { set: false, preview: null, source: 'unset' },
  antigravityApiKey: { set: false, preview: null, source: 'unset' },
  deepseekApiKey: { set: false, preview: null, source: 'unset' },
  antigravityBaseUrl: { value: '', source: 'default' },
  deepseekBaseUrl: { value: '', source: 'default' },
  ollamaBaseUrl: { value: '', source: 'default' },
  ollamaModel: { value: '', source: 'default' },
  updatedAt: null,
};

function SourceBadge({ source }: { source: string }) {
  const color =
    source === 'settings' ? 'border-emerald-500 text-emerald-400'
    : source === 'env' ? 'border-sky-500 text-sky-400'
    : 'border-base-700 text-zinc-500';
  return <span className={`badge ${color}`}>{source}</span>;
}

/**
 * AI provider key management. Secrets are write-only from the browser:
 * the API returns masked previews, never the raw key.
 */
export function AIKeysForm() {
  const [view, setView] = useState<AISettingsView>(EMPTY);
  const [secrets, setSecrets] = useState<Record<SecretKey, string>>({
    anthropicApiKey: '',
    antigravityApiKey: '',
    deepseekApiKey: '',
  });
  const [plains, setPlains] = useState<Record<PlainKey, string>>({
    antigravityBaseUrl: '',
    deepseekBaseUrl: '',
    ollamaBaseUrl: '',
    ollamaModel: '',
  });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getSettings()
      .then(({ ai }) => {
        setView(ai);
        setPlains({
          antigravityBaseUrl: ai.antigravityBaseUrl.value,
          deepseekBaseUrl: ai.deepseekBaseUrl.value,
          ollamaBaseUrl: ai.ollamaBaseUrl.value,
          ollamaModel: ai.ollamaModel.value,
        });
      })
      .catch((e: Error) => setStatus(`❌ ${e.message}`));
  }, []);

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const body: Record<string, string> = {};
      for (const f of SECRET_FIELDS) if (secrets[f.key].trim()) body[f.key] = secrets[f.key].trim();
      for (const f of PLAIN_FIELDS) if (plains[f.key].trim()) body[f.key] = plains[f.key].trim();
      const { ai } = await api.saveAISettings(body);
      setView(ai);
      setSecrets({ anthropicApiKey: '', antigravityApiKey: '', deepseekApiKey: '' });
      setStatus('✅ Saved — active on the next AI request (no restart needed).');
    } catch (err) {
      setStatus(`❌ ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function clearKey(key: SecretKey | PlainKey) {
    setBusy(true);
    setStatus(null);
    try {
      const { ai } = await api.saveAISettings({ [key]: '' });
      setView(ai);
      if (key in plains) setPlains((p) => ({ ...p, [key]: (ai[key as PlainKey] as { value: string }).value }));
      setStatus('✅ Cleared — falling back to env var / default.');
    } catch (err) {
      setStatus(`❌ ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">AI provider keys</h3>
        {view.updatedAt && <span className="text-xs text-zinc-500">saved {new Date(view.updatedAt).toLocaleString()}</span>}
      </div>
      <p className="text-xs text-zinc-500">
        Stored server-side in the data volume (<code>xssploit-settings.json</code>, mode 0600). Values here override env vars.
        Keys are never sent back to the browser — only masked previews.
      </p>

      {SECRET_FIELDS.map((f) => (
        <div key={f.key} className="space-y-1">
          <div className="flex items-center gap-2">
            <label className="label mb-0">{f.label}</label>
            <SourceBadge source={view[f.key].source} />
            {view[f.key].set && <span className="text-xs text-zinc-500">{view[f.key].preview}</span>}
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              className="input flex-1"
              placeholder={view[f.key].set ? 'saved — paste new key to replace' : `paste key… (${f.hint})`}
              value={secrets[f.key]}
              onChange={(e) => setSecrets((s) => ({ ...s, [f.key]: e.target.value }))}
              autoComplete="off"
            />
            {view[f.key].source === 'settings' && (
              <button className="btn-ghost text-xs" disabled={busy} onClick={() => clearKey(f.key)}>clear</button>
            )}
          </div>
        </div>
      ))}

      <div className="grid gap-3 sm:grid-cols-2">
        {PLAIN_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <div className="flex items-center gap-2">
              <label className="label mb-0">{f.label}</label>
              <SourceBadge source={view[f.key].source} />
            </div>
            <input
              className="input"
              value={plains[f.key]}
              onChange={(e) => setPlains((p) => ({ ...p, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save AI settings'}</button>
        {status && <p className="text-sm text-zinc-300">{status}</p>}
      </div>
    </div>
  );
}

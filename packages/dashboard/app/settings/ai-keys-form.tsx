'use client';

import { useEffect, useState } from 'react';
import { api, AISettingsView, PlainField } from '../../lib/api';

const SECRET_KEYS = ['anthropicApiKey', 'antigravityApiKey', 'deepseekApiKey'] as const;
type SecretKey = (typeof SECRET_KEYS)[number];

const LABEL: Record<string, string> = {
  anthropicApiKey: 'Anthropic (Claude)',
  antigravityApiKey: 'Antigravity',
  deepseekApiKey: 'DeepSeek',
};

/** Known model presets shown in the per-provider pickers; custom values stay editable. */
const MODEL_PRESETS: Record<string, string[]> = {
  anthropicModel: ['claude-sonnet-4-20250514', 'claude-opus-4-1', 'claude-haiku-4-5'],
  antigravityModel: ['antigravity-pro', 'antigravity-flash'],
  deepseekModel: ['deepseek-chat', 'deepseek-reasoner'],
};

const PREFERRED = [
  { value: 'auto', label: 'Auto — tiered fallback (Claude → Antigravity → DeepSeek → Ollama)' },
  { value: 'claude', label: 'Claude only' },
  { value: 'antigravity', label: 'Antigravity only' },
  { value: 'deepseek', label: 'DeepSeek only' },
  { value: 'ollama', label: 'Ollama (local) only' },
  { value: 'none', label: 'None — rule-based scan, no AI' },
];

function SourceBadge({ source }: { source: PlainField['source'] | 'unset' | 'default' }) {
  const style =
    source === 'settings'
      ? 'bg-emerald-900/50 text-emerald-300'
      : source === 'env'
        ? 'bg-sky-900/50 text-sky-300'
        : 'bg-zinc-800 text-zinc-400';
  return <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${style}`}>{source}</span>;
}

export function AIKeysForm() {
  const [view, setView] = useState<AISettingsView | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [ollamaModels, setOllamaModels] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSettings().then((r) => setView(r.ai)).catch((e) => setError(String(e)));
    api.getOllamaModels().then((r) => setOllamaModels(r.reachable ? r.models : [])).catch(() => setOllamaModels([]));
  }, []);

  if (!view) return <p className="text-zinc-400">{error || 'Loading…'}</p>;

  const val = (k: string) => draft[k] ?? '';
  const setVal = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const modelValue = (k: 'anthropicModel' | 'antigravityModel' | 'deepseekModel' | 'ollamaModel') =>
    draft[k] !== undefined && draft[k] !== '' ? draft[k]! : (view[k].value ?? '');

  async function save() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const patch: Record<string, string> = {};
      for (const [k, v] of Object.entries(draft)) if (v.trim() !== '') patch[k] = v.trim();
      if (Object.keys(patch).length === 0) {
        setMessage('Nothing to save.');
        return;
      }
      const r = await api.saveAISettings(patch);
      setView(r.ai);
      setDraft({});
      setMessage('✅ Saved — active on the next AI request (no restart needed).');
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function clearField(k: string) {
    setSaving(true);
    setError('');
    try {
      const r = await api.saveAISettings({ [k]: '' });
      setView(r.ai);
      setDraft((d) => {
        const { [k]: _drop, ...rest } = d;
        return rest;
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const modelPicker = (
    k: 'anthropicModel' | 'antigravityModel' | 'deepseekModel' | 'ollamaModel',
    label: string,
    presets: string[] | null,
    hint: string,
  ) => (
    <div className="flex items-center gap-2">
      <label className="w-44 shrink-0 text-sm text-zinc-300">{label}</label>
      <input
        list={`models-${k}`}
        value={modelValue(k)}
        onChange={(e) => setVal(k, e.target.value)}
        placeholder={hint}
        className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600"
      />
      <datalist id={`models-${k}`}>
        {(presets ?? []).map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <SourceBadge source={view[k].source} />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Provider selection — like the Antigravity model picker. */}
      <div className="flex items-center gap-2">
        <label className="w-44 shrink-0 text-sm font-medium text-zinc-200">AI provider</label>
        <select
          value={val('preferred') || view.preferred.value}
          onChange={(e) => setVal('preferred', e.target.value)}
          className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100"
        >
          {PREFERRED.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <SourceBadge source={view.preferred.source} />
      </div>

      {/* Model pickers */}
      {modelPicker('anthropicModel', 'Claude model', MODEL_PRESETS.anthropicModel ?? [], 'claude-sonnet-4-20250514')}
      {modelPicker('antigravityModel', 'Antigravity model', MODEL_PRESETS.antigravityModel ?? [], 'antigravity-pro')}
      {modelPicker('deepseekModel', 'DeepSeek model', MODEL_PRESETS.deepseekModel ?? [], 'deepseek-chat')}
      {modelPicker(
        'ollamaModel',
        'Ollama model',
        ollamaModels,
        ollamaModels === null ? 'checking local Ollama…' : ollamaModels.length === 0 ? 'llama3.1:8b' : 'pick installed model',
      )}

      <hr className="border-zinc-800" />

      {/* API keys */}
      {SECRET_KEYS.map((k: SecretKey) => {
        const f = view[k];
        return (
          <div key={k} className="flex items-center gap-2">
            <label className="w-44 shrink-0 text-sm text-zinc-300">{LABEL[k]}</label>
            <input
              type="password"
              value={val(k)}
              onChange={(e) => setVal(k, e.target.value)}
              placeholder={f.set ? (f.preview ?? 'set') : 'not set'}
              className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600"
            />
            <SourceBadge source={f.source} />
            {f.source === 'settings' && (
              <button
                onClick={() => clearField(k)}
                className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-red-700 hover:text-red-400"
              >
                Clear
              </button>
            )}
          </div>
        );
      })}

      {/* Base URLs + ollama URL */}
      {(['antigravityBaseUrl', 'deepseekBaseUrl', 'ollamaBaseUrl'] as const).map((k) => (
        <div key={k} className="flex items-center gap-2">
          <label className="w-44 shrink-0 text-sm text-zinc-300">
            {k === 'ollamaBaseUrl' ? 'Ollama URL' : LABEL[k.replace('BaseUrl', 'ApiKey')] + ' base URL'}
          </label>
          <input
            value={val(k)}
            onChange={(e) => setVal(k, e.target.value)}
            placeholder={view[k].value}
            className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600"
          />
          <SourceBadge source={view[k].source} />
        </div>
      ))}

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {message && <span className="text-sm text-emerald-400">{message}</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}

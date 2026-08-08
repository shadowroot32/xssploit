import { SettingsForm } from './settings-form';

export const metadata = { title: 'Settings — XSSPLOIT' };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h2 className="text-2xl font-bold text-white">Settings</h2>
      <div className="card space-y-3 text-sm text-zinc-300">
        <h3 className="font-semibold text-white">AI providers</h3>
        <p className="text-zinc-400">
          Tiered fallback order: <b>Claude → Antigravity → DeepSeek → Ollama → rules-only</b>.
          Keys are read from the API server environment:
        </p>
        <ul className="list-inside list-disc space-y-1 text-zinc-400">
          <li><code>ANTHROPIC_API_KEY</code> — Claude analysis</li>
          <li><code>ANTIGRAVITY_API_KEY</code> / <code>ANTIGRAVITY_BASE_URL</code></li>
          <li><code>DEEPSEEK_API_KEY</code> — OpenAI-compatible fallback</li>
          <li><code>OLLAMA_BASE_URL</code> — local model, default http://127.0.0.1:11434</li>
        </ul>
      </div>
      <SettingsForm />
    </div>
  );
}

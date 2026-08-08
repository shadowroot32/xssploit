import { SettingsForm } from './settings-form';
import { AIKeysForm } from './ai-keys-form';

export const metadata = { title: 'Settings — XSSPLOIT' };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h2 className="text-2xl font-bold text-white">Settings</h2>
      <div className="card space-y-3 text-sm text-zinc-300">
        <h3 className="font-semibold text-white">AI providers</h3>
        <p className="text-zinc-400">
          Tiered fallback order: <b>Claude → Antigravity → DeepSeek → Ollama → rules-only</b>.
          Providers without a key are skipped automatically; Ollama needs no key, just a reachable URL.
        </p>
      </div>
      <AIKeysForm />
      <SettingsForm />
    </div>
  );
}

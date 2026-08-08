import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function CallbacksPage() {
  const { callbacks } = await api.listCallbacks().catch(() => ({ callbacks: [] }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Blind-XSS Callbacks</h2>
        <span className="badge border-accent-500 text-accent-400">{callbacks.length} captured</span>
      </div>
      <p className="text-sm text-zinc-400">
        Payloads fired on admin panels and other out-of-reach pages report back here.
      </p>
      <div className="space-y-3">
        {callbacks.map((c, i) => (
          <div key={String(c['id'] ?? i)} className="card">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>{String(c['received_at'] ?? '')}</span>
              <span>token {String(c['token'] ?? '').slice(0, 12)}…</span>
            </div>
            <p className="mt-1 break-all text-sm text-zinc-200">
              🎯 {String(c['origin_url'] ?? c['location'] ?? 'unknown origin')}
            </p>
            {c['title'] ? <p className="text-xs text-zinc-400">page: {String(c['title'])}</p> : null}
            {c['cookies'] ? (
              <pre className="mt-2 overflow-x-auto rounded bg-base-950 p-2 text-xs text-amber-200">{String(c['cookies'])}</pre>
            ) : null}
            <p className="mt-1 text-xs text-zinc-500">{String(c['user_agent'] ?? '')}</p>
          </div>
        ))}
        {callbacks.length === 0 && (
          <div className="card text-center text-zinc-500">
            No callbacks yet. Start the listener with <code>xssploit callback serve</code> and run a scan with blind mode enabled.
          </div>
        )}
      </div>
    </div>
  );
}

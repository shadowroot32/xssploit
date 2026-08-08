import Link from 'next/link';
import { api } from '@/lib/api';

const SEV_STYLE: Record<string, string> = {
  critical: 'border-fuchsia-400 text-fuchsia-300',
  high: 'border-rose-400 text-rose-300',
  medium: 'border-amber-400 text-amber-300',
  low: 'border-emerald-400 text-emerald-300',
  info: 'border-sky-400 text-sky-300',
};

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  let scans: Awaited<ReturnType<typeof api.listScans>>['scans'] = [];
  let vulns: Awaited<ReturnType<typeof api.listVulns>>['vulnerabilities'] = [];
  let apiError: string | null = null;
  try {
    [scans, vulns] = await Promise.all([
      api.listScans().then((r) => r.scans),
      api.listVulns().then((r) => r.vulnerabilities),
    ]);
  } catch (err) {
    apiError = (err as Error).message;
  }

  const bySeverity = vulns.reduce<Record<string, number>>((acc, v) => {
    acc[v.severity] = (acc[v.severity] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Overview</h2>
        <Link href="/scans/new" className="btn-primary">+ New Scan</Link>
      </div>

      {apiError && (
        <div className="card border-rose-500/40 text-sm text-rose-300">
          API unreachable: {apiError} — start it with <code>pnpm dev --filter @xssploit/api</code>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card"><p className="label">Scans</p><p className="text-3xl font-bold text-white">{scans.length}</p></div>
        <div className="card"><p className="label">Findings</p><p className="text-3xl font-bold text-white">{vulns.length}</p></div>
        <div className="card"><p className="label">Critical/High</p><p className="text-3xl font-bold text-rose-300">{(bySeverity.critical ?? 0) + (bySeverity.high ?? 0)}</p></div>
        <div className="card"><p className="label">Running</p><p className="text-3xl font-bold text-accent-400">{scans.filter((s) => s.status === 'running').length}</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 font-semibold text-white">Recent scans</h3>
          <ul className="divide-y divide-base-700 text-sm">
            {scans.slice(0, 8).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <Link href={`/scans/${s.id}`} className="truncate text-zinc-200 hover:text-accent-400">
                  {s.target_url}
                </Link>
                <span className={`badge ml-2 ${s.status === 'done' ? 'border-emerald-500 text-emerald-300' : s.status === 'running' ? 'border-accent-500 text-accent-400' : 'border-zinc-500 text-zinc-400'}`}>
                  {s.status} · {s.vulnerabilities} vulns
                </span>
              </li>
            ))}
            {scans.length === 0 && <li className="py-4 text-zinc-500">No scans yet — launch your first one.</li>}
          </ul>
        </div>

        <div className="card">
          <h3 className="mb-3 font-semibold text-white">Latest findings</h3>
          <ul className="divide-y divide-base-700 text-sm">
            {vulns.slice(0, 8).map((v) => (
              <li key={v.id} className="py-2">
                <span className={`badge mr-2 ${SEV_STYLE[v.severity] ?? ''}`}>{v.severity}</span>
                <span className="text-zinc-200">{v.title}</span>
                <p className="mt-0.5 truncate text-xs text-zinc-500">{v.url}</p>
              </li>
            ))}
            {vulns.length === 0 && <li className="py-4 text-zinc-500">No vulnerabilities found yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

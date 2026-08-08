import { api } from '@/lib/api';
import { CancelButton } from './cancel-button';
import { ProgressPoller } from './progress-poller';

export const dynamic = 'force-dynamic';

const SEV_STYLE: Record<string, string> = {
  critical: 'border-fuchsia-400 text-fuchsia-300',
  high: 'border-rose-400 text-rose-300',
  medium: 'border-amber-400 text-amber-300',
  low: 'border-emerald-400 text-emerald-300',
  info: 'border-sky-400 text-sky-300',
};

export default async function ScanDetailPage({ params }: { params: { id: string } }) {
  const [{ scan }, { vulnerabilities }] = await Promise.all([
    api.getScan(params.id),
    api.scanVulns(params.id),
  ]);
  const progress = JSON.parse(scan.progress_json || '{}') as { percent?: number; currentActivity?: string };
  const stats = JSON.parse(scan.stats_json || '{}') as Record<string, number>;
  const isRunning = scan.status === 'running';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{scan.target_url}</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {scan.profile} · started {scan.created_at}
            {scan.program ? ` · program: ${scan.program}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${isRunning ? 'border-accent-500 text-accent-400' : scan.status === 'done' ? 'border-emerald-500 text-emerald-300' : 'border-rose-500 text-rose-300'}`}>
            {scan.status}
          </span>
          {isRunning && <CancelButton scanId={scan.id} />}
        </div>
      </div>

      {isRunning && (
        <div className="card">
          <ProgressPoller scanId={scan.id} initialPercent={progress.percent ?? 0} activity={progress.currentActivity ?? ''} />
        </div>
      )}

      {scan.error && <div className="card border-rose-500/40 text-sm text-rose-300">{scan.error}</div>}

      {stats.durationMs != null && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="card"><p className="label">Requests</p><p className="text-2xl font-bold text-white">{stats.requestsSent ?? 0}</p></div>
          <div className="card"><p className="label">Pages</p><p className="text-2xl font-bold text-white">{stats.pagesCrawled ?? 0}</p></div>
          <div className="card"><p className="label">Duration</p><p className="text-2xl font-bold text-white">{Math.round((stats.durationMs ?? 0) / 1000)}s</p></div>
          <div className="card"><p className="label">AI tokens</p><p className="text-2xl font-bold text-white">{stats.aiTokensUsed ?? 0}</p></div>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-lg font-semibold text-white">Findings ({vulnerabilities.length})</h3>
        <div className="space-y-3">
          {vulnerabilities.map((v) => (
            <div key={v.id} className="card">
              <div className="flex items-center gap-2">
                <span className={`badge ${SEV_STYLE[v.severity] ?? ''}`}>{v.severity}</span>
                <span className="badge border-base-700 text-zinc-400">{v.type}</span>
                <span className="badge border-base-700 text-zinc-400">{v.confidence}</span>
                <span className="ml-auto text-xs text-zinc-500">score {v.score.toFixed(1)}</span>
              </div>
              <h4 className="mt-2 font-semibold text-white">{v.title}</h4>
              <p className="mt-1 text-sm text-zinc-400">{v.description}</p>
              <p className="mt-2 break-all text-xs text-zinc-500">{v.url} — param: {v.evidence.parameter}</p>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-base-700 bg-base-950 p-3 text-xs text-amber-200">{v.evidence.payload}</pre>
              {v.aiAnalysis && <p className="mt-2 text-sm text-accent-400">🤖 {v.aiAnalysis}</p>}
              <p className="mt-2 text-sm text-zinc-300"><b>Fix:</b> {v.remediation}</p>
            </div>
          ))}
          {vulnerabilities.length === 0 && (
            <div className="card text-center text-zinc-500">No findings recorded for this scan.</div>
          )}
        </div>
      </div>
    </div>
  );
}

import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const { reports } = await api.listReports().catch(() => ({ reports: [] }));

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Reports</h2>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-base-700 text-xs uppercase text-zinc-400">
            <tr>
              <th className="px-4 py-3">Scan</th>
              <th className="px-4 py-3">Format</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-700">
            {reports.map((r) => (
              <tr key={r.id} className="hover:bg-base-800/50">
                <td className="px-4 py-2 font-mono text-xs text-zinc-400">{r.scan_id.slice(0, 8)}…</td>
                <td className="px-4 py-2"><span className="badge border-accent-500 text-accent-400">{r.format}</span></td>
                <td className="px-4 py-2 text-zinc-500">{r.created_at}</td>
                <td className="px-4 py-2 text-right">
                  <a className="text-accent-400 hover:underline" href={api.reportDownloadUrl(r.id)}>download ↓</a>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">Reports appear after scans complete.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

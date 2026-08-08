import Link from 'next/link';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  done: 'border-emerald-500 text-emerald-300',
  running: 'border-accent-500 text-accent-400',
  failed: 'border-rose-500 text-rose-300',
  cancelled: 'border-zinc-500 text-zinc-400',
  queued: 'border-sky-500 text-sky-300',
};

export default async function ScansPage() {
  const { scans } = await api.listScans().catch(() => ({ scans: [] }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Scans</h2>
        <Link href="/scans/new" className="btn-primary">+ New Scan</Link>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-base-700 text-xs uppercase text-zinc-400">
            <tr>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Profile</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Findings</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-700">
            {scans.map((s) => (
              <tr key={s.id} className="hover:bg-base-800/50">
                <td className="max-w-xs truncate px-4 py-2 text-zinc-200">{s.target_url}</td>
                <td className="px-4 py-2 text-zinc-400">{s.profile}</td>
                <td className="px-4 py-2"><span className={`badge ${STATUS_STYLE[s.status] ?? ''}`}>{s.status}</span></td>
                <td className="px-4 py-2 text-zinc-200">{s.vulnerabilities}</td>
                <td className="px-4 py-2 text-zinc-500">{s.created_at}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/scans/${s.id}`} className="text-accent-400 hover:underline">details →</Link>
                </td>
              </tr>
            ))}
            {scans.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No scans recorded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

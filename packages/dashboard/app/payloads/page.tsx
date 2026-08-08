import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function PayloadsPage() {
  const [{ categories, total }, { preview }] = await Promise.all([
    api.payloadStats().catch(() => ({ categories: [] as { category: string; count: number }[], total: 0 })),
    api.payloadPreview().catch(() => ({ preview: {} as Record<string, string[]>, loaded: 0 })),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Payload Library</h2>
        <span className="badge border-accent-500 text-accent-400">{total} payloads · {categories.length} categories</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((c) => (
          <div key={c.category} className="card">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">{c.category}</h3>
              <span className="text-xs text-zinc-500">{c.count} payloads</span>
            </div>
            <ul className="mt-2 space-y-1">
              {(preview[c.category] ?? []).map((p: string, i: number) => (
                <li key={i}>
                  <code className="block truncate rounded bg-base-950 px-2 py-1 text-xs text-amber-200">{p}</code>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="card text-zinc-500">No payloads found — run the collector or check the payloads/ directory.</div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

/**
 * "Add payloads" panel — paste a payload list or upload a .txt file.
 * Lines are appended to payloads/custom/<category>.txt on the server and
 * picked up live by the next scan (PayloadLoader reads from disk).
 */
export function AddPayloads({ existingCategories }: { existingCategories: string[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const categoryValid = /^[a-z0-9][a-z0-9-]{0,49}$/.test(category.trim().toLowerCase());
  const lineCount = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).length;

  async function submit() {
    setBusy(true);
    setStatus(null);
    try {
      const payloads = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
      const res = await api.addPayloads(category.trim().toLowerCase(), payloads);
      setStatus(`✅ ${res.added} added, ${res.skipped} duplicate(s) skipped → ${res.file}`);
      setText('');
      setCategory('');
      router.refresh();
    } catch (err) {
      setStatus(`❌ ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      setStatus('❌ file too large (max 512 KB)');
      return;
    }
    file.text().then((content) => {
      setText((prev) => (prev.trim() ? `${prev}\n${content}` : content));
      if (!category) setCategory(file.name.replace(/\.txt$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '-'));
    });
    e.target.value = '';
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>+ Add payloads</button>
    );
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Add payloads</h3>
        <button className="btn-ghost text-xs" onClick={() => setOpen(false)}>close</button>
      </div>

      <div>
        <label className="label">Category</label>
        <input
          className="input"
          list="payload-categories"
          placeholder="e.g. waf-bypass, react-custom, blind-xss"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <datalist id="payload-categories">
          {existingCategories.map((c) => <option key={c} value={c} />)}
        </datalist>
        <p className="mt-1 text-xs text-zinc-500">
          Lowercase letters/digits/dashes. A new name creates payloads/custom/&lt;name&gt;.txt; an existing name appends to it.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="label mb-0">Payloads (one per line)</label>
          <button className="btn-ghost text-xs" onClick={() => fileRef.current?.click()}>📂 import .txt</button>
          <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={onFile} />
        </div>
        <textarea
          className="input mt-1 min-h-[7rem] font-mono text-xs"
          placeholder={'<img src=x onerror=alert(1)>\n"><svg onload=alert(1)>\njavascript:alert(1)'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="mt-1 text-xs text-zinc-500">{lineCount} payload line(s) · duplicates are skipped automatically</p>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy || !categoryValid || lineCount === 0} onClick={submit}>
          {busy ? 'Adding…' : `Add ${lineCount || ''} payload${lineCount === 1 ? '' : 's'}`}
        </button>
        {status && <p className="text-sm text-zinc-300">{status}</p>}
      </div>
    </div>
  );
}

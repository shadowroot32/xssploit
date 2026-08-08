'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';

export function CancelButton({ scanId }: { scanId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-ghost text-rose-300"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api.cancelScan(scanId);
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Cancelling…' : 'Cancel'}
    </button>
  );
}

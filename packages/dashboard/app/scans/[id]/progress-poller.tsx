'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function ProgressPoller({ scanId, initialPercent, activity }: { scanId: string; initialPercent: number; activity: string }) {
  const [percent, setPercent] = useState(initialPercent);
  const [current, setCurrent] = useState(activity);
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const { scan } = await api.getScan(scanId);
        const p = JSON.parse(scan.progress_json || '{}') as { percent?: number; currentActivity?: string };
        setPercent(p.percent ?? 0);
        setCurrent(p.currentActivity ?? '');
        if (scan.status !== 'running') {
          clearInterval(timer);
          router.refresh();
        }
      } catch {
        /* keep polling — transient API errors are fine */
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [scanId, router]);

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-zinc-400">
        <span>{current}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-base-800">
        <div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

import { NewScanWizard } from './wizard';

export const metadata = { title: 'New Scan — XSSPLOIT' };

export default function NewScanPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold text-white">Launch New Scan</h2>
      <NewScanWizard />
    </div>
  );
}

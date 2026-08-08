import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'XSSPLOIT — Personal Edition',
  description: 'Authorized XSS hunting dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-base-950 text-zinc-200 antialiased">
        <div className="flex min-h-screen">
          <aside className="w-56 shrink-0 border-r border-base-700 bg-base-900 p-4">
            <h1 className="mb-6 text-lg font-bold text-accent-400">🛡️ XSSPLOIT</h1>
            <nav className="space-y-1 text-sm">
              {[
                ['Overview', '/'],
                ['Scans', '/scans'],
                ['New Scan', '/scans/new'],
                ['Payloads', '/payloads'],
                ['Blind Callbacks', '/callbacks'],
                ['Reports', '/reports'],
                ['Settings', '/settings'],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  className="block rounded-md px-3 py-2 text-zinc-300 transition hover:bg-base-800 hover:text-white"
                >
                  {label}
                </a>
              ))}
            </nav>
            <p className="mt-8 px-3 text-xs text-zinc-500">v5.0 Personal — authorized use only</p>
          </aside>
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}

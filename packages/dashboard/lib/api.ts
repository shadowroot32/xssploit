const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const TOKEN = process.env.NEXT_PUBLIC_LOCAL_AUTH_TOKEN ?? '';

function headers(): HeadersInit {
  return TOKEN ? { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' } : { 'content-type': 'application/json' };
}

export interface ScanRow {
  id: string;
  target_url: string;
  program: string | null;
  profile: string;
  status: string;
  config_json: string;
  progress_json: string;
  stats_json: string;
  error: string | null;
  created_at: string;
  finished_at: string | null;
  vulnerabilities: number;
}

export interface VulnerabilityRow {
  id: string;
  scanId: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence: string;
  url: string;
  title: string;
  description: string;
  evidence: { payload: string; parameter: string; context?: string };
  score: number;
  remediation: string;
  aiAnalysis?: string;
  discoveredAt: string;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers(), cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `API ${res.status}`);
  return data;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `API ${res.status}`);
  return data;
}

export interface SecretField {
  set: boolean;
  preview: string | null;
  source: 'settings' | 'env' | 'unset';
}

export interface PlainField {
  value: string;
  source: 'settings' | 'env' | 'default';
}

export interface AISettingsView {
  anthropicApiKey: SecretField;
  antigravityApiKey: SecretField;
  deepseekApiKey: SecretField;
  antigravityBaseUrl: PlainField;
  deepseekBaseUrl: PlainField;
  ollamaBaseUrl: PlainField;
  ollamaModel: PlainField;
  updatedAt: string | null;
}

export const api = {
  listScans: () => get<{ scans: ScanRow[] }>('/api/scans'),
  getScan: (id: string) => get<{ scan: ScanRow }>(`/api/scans/${id}`),
  startScan: (config: Record<string, unknown>) => post<{ scanId: string }>('/api/scans', config),
  cancelScan: (id: string) => post<{ cancelled: boolean }>(`/api/scans/${id}/cancel`, {}),
  scanVulns: (id: string) => get<{ vulnerabilities: VulnerabilityRow[] }>(`/api/scans/${id}/vulnerabilities`),
  listVulns: () => get<{ vulnerabilities: VulnerabilityRow[] }>('/api/vulnerabilities'),
  payloadStats: () => get<{ categories: { category: string; count: number }[]; total: number }>('/api/payloads'),
  payloadPreview: (cats?: string[]) =>
    get<{ preview: Record<string, string[]>; loaded: number }>(
      `/api/payloads/preview${cats?.length ? `?categories=${encodeURIComponent(cats.join(','))}` : ''}`,
    ),
  addPayloads: (category: string, payloads: string[]) =>
    post<{ ok: boolean; added: number; skipped: number; file: string }>('/api/payloads', { category, payloads }),
  getSettings: () => get<{ ai: AISettingsView }>('/api/settings'),
  saveAISettings: (patch: Record<string, string>) =>
    put<{ ok: boolean; ai: AISettingsView }>('/api/settings/ai', patch),
  listCallbacks: () =>
    get<{ callbacks: Record<string, unknown>[] }>('/api/callbacks'),
  listReports: (scanId?: string) =>
    get<{ reports: { id: string; scan_id: string; format: string; path: string; created_at: string }[] }>(
      `/api/reports${scanId ? `?scanId=${scanId}` : ''}`,
    ),
  reportDownloadUrl: (id: string) => `${BASE}/api/reports/${id}/download`,
};

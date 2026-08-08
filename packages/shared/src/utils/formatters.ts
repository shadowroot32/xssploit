import type { Severity } from '../types/vulnerability.js';

/** Format milliseconds as a compact human duration ("1h 2m 3s"). */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = Math.floor(ms / 1000);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'] as const;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export function severityRank(severity: Severity): number {
  return SEVERITY_ORDER.length - 1 - SEVERITY_ORDER.indexOf(severity);
}

export function formatSeverity(severity: Severity): string {
  return severity.toUpperCase();
}

/** Clamp + round a CVSS-ish score to one decimal. */
export function formatScore(score: number): string {
  return Math.max(0, Math.min(10, score)).toFixed(1);
}

/** Deterministic short id for payloads/findings. */
export function shortId(input: string, length = 12): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, length);
}

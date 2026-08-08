import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Scanner,
  NotificationManager,
  ReportBuilder,
  defaultScanConfig,
  type ScannerOptions,
} from '@xssploit/engine';
import type { ScanConfig, ScanProgress, Vulnerability } from '@xssploit/shared';
import { getDb } from '../db/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('scan-service');

interface ScanRow {
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
}

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
}

/**
 * Owns scan lifecycle: persists config, runs the engine in-process
 * (single-user → no job queue needed), streams progress into SQLite,
 * and generates report artifacts on completion.
 */
export class ScanService {
  private readonly running = new Map<string, Scanner>();
  private readonly notifier = new NotificationManager({
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
  });

  /** Create + start a scan. Returns immediately; poll progress via GET. */
  startScan(input: Partial<ScanConfig> & { targetUrl: string }): { scanId: string } {
    const config = defaultScanConfig(input);
    const callbacksEnabled =
      config.blindXss.enabled && Boolean(process.env.CALLBACK_DOMAIN);
    if (config.blindXss.enabled && !callbacksEnabled) {
      logger.warn('blindXss requested but CALLBACK_DOMAIN unset — disabling blind payloads');
      config.blindXss.enabled = false;
    }

    const options: ScannerOptions = {
      payloadsDir: path.join(repoRoot(), 'payloads'),
      callbackBase: process.env.CALLBACK_DOMAIN
        ? `${process.env.CALLBACK_DOMAIN.startsWith('http') ? '' : 'http://'}${process.env.CALLBACK_DOMAIN}`
        : undefined,
      notifier: this.notifier,
      onProgress: (p) => this.saveProgress(p),
      onVulnerability: (v) => this.saveVulnerability(v),
    };

    const scanner = new Scanner(config, options);
    this.running.set(scanner.scanId, scanner);

    const db = getDb();
    db.prepare(
      `INSERT INTO scans (id, target_url, program, profile, status, config_json) VALUES (?, ?, ?, ?, 'running', ?)`,
    ).run(scanner.scanId, config.targetUrl, config.program ?? null, config.profile, JSON.stringify(config));

    scanner
      .run()
      .then((result) => {
        this.running.delete(scanner.scanId);
        this.finalize(result.scanId, result.status, JSON.stringify(result.stats));
        this.buildReports(scanner.scanId);
        if (config.notify) {
          void this.notifier.notify({
            kind: 'scan-finished',
            scanId: scanner.scanId,
            message: `Scan ${result.status}: ${result.vulnerabilityIds.length} findings on ${config.targetUrl}`,
            timestamp: new Date().toISOString(),
          });
        }
      })
      .catch((err: Error) => {
        this.running.delete(scanner.scanId);
        this.finalize(scanner.scanId, 'failed', '{}', err.message);
      });

    return { scanId: scanner.scanId };
  }

  cancelScan(scanId: string): boolean {
    const scanner = this.running.get(scanId);
    if (!scanner) return false;
    scanner.cancel();
    return true;
  }

  getScan(scanId: string): (ScanRow & { vulnerabilities: number }) | null {
    const db = getDb();
    const row = db.prepare(`SELECT * FROM scans WHERE id = ?`).get(scanId) as ScanRow | undefined;
    if (!row) return null;
    const count = db
      .prepare(`SELECT COUNT(*) AS n FROM vulnerabilities WHERE scan_id = ?`)
      .get(scanId) as { n: number };
    return { ...row, vulnerabilities: count.n };
  }

  listScans(limit = 50): unknown[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT s.*, (SELECT COUNT(*) FROM vulnerabilities v WHERE v.scan_id = s.id) AS vulnerabilities
         FROM scans s ORDER BY created_at DESC LIMIT ?`,
      )
      .all(limit);
    return rows;
  }

  listVulnerabilities(scanId?: string): Vulnerability[] {
    const db = getDb();
    const rows = (
      scanId
        ? db.prepare(`SELECT * FROM vulnerabilities WHERE scan_id = ? ORDER BY discovered_at DESC`).all(scanId)
        : db.prepare(`SELECT * FROM vulnerabilities ORDER BY discovered_at DESC LIMIT 500`).all()
    ) as Record<string, unknown>[];
    return rows.map(rowToVuln);
  }

  private saveProgress(p: ScanProgress): void {
    getDb()
      .prepare(`UPDATE scans SET progress_json = ?, status = ? WHERE id = ?`)
      .run(JSON.stringify(p), p.status, p.scanId);
  }

  private saveVulnerability(v: Vulnerability): void | Promise<void> {
    getDb()
      .prepare(
        `INSERT OR IGNORE INTO vulnerabilities
         (id, scan_id, type, severity, confidence, url, title, description, evidence_json, score, remediation, ai_analysis, discovered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        v.id,
        v.scanId,
        v.type,
        v.severity,
        v.confidence,
        v.url,
        v.title,
        v.description,
        JSON.stringify(v.evidence),
        v.score,
        v.remediation,
        v.aiAnalysis ?? null,
        v.discoveredAt,
      );
  }

  private finalize(scanId: string, status: string, statsJson: string, error?: string): void {
    getDb()
      .prepare(`UPDATE scans SET status = ?, stats_json = ?, error = ?, finished_at = datetime('now') WHERE id = ?`)
      .run(status, statsJson, error ?? null, scanId);
  }

  private buildReports(scanId: string): void {
    try {
      const scan = this.getScan(scanId);
      if (!scan) return;
      const reportsDir = path.join(repoRoot(), 'reports', 'output');
      const builder = new ReportBuilder(reportsDir);
      const artifacts = builder.buildAll({
        scan: {
          scanId,
          config: JSON.parse(scan.config_json) as ScanConfig,
          status: scan.status as never,
          startedAt: scan.created_at,
          finishedAt: scan.finished_at ?? undefined,
          stats: JSON.parse(scan.stats_json || '{}'),
          vulnerabilityIds: [],
        },
        vulnerabilities: this.listVulnerabilities(scanId),
        generatedAt: new Date().toISOString(),
      });
      const db = getDb();
      const insert = db.prepare(
        `INSERT INTO reports (id, scan_id, format, path) VALUES (lower(hex(randomblob(8))), ?, ?, ?)`,
      );
      for (const [format, p] of Object.entries(artifacts)) insert.run(scanId, format, p);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'report generation failed');
    }
  }
}

function rowToVuln(row: Record<string, unknown>): Vulnerability {
  return {
    id: row['id'] as string,
    scanId: row['scan_id'] as string,
    type: row['type'] as Vulnerability['type'],
    severity: row['severity'] as Vulnerability['severity'],
    confidence: row['confidence'] as Vulnerability['confidence'],
    url: row['url'] as string,
    title: row['title'] as string,
    description: row['description'] as string,
    evidence: JSON.parse((row['evidence_json'] as string) || '{}'),
    score: row['score'] as number,
    remediation: row['remediation'] as string,
    aiAnalysis: (row['ai_analysis'] as string | null) ?? undefined,
    discoveredAt: row['discovered_at'] as string,
  };
}

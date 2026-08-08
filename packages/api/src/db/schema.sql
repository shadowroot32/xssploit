-- XSSPLOIT Personal Edition — SQLite schema (single user, no tenants/billing).

CREATE TABLE IF NOT EXISTS scans (
  id            TEXT PRIMARY KEY,
  target_url    TEXT NOT NULL,
  program       TEXT,
  profile       TEXT NOT NULL DEFAULT 'quick',
  status        TEXT NOT NULL DEFAULT 'queued',
  config_json   TEXT NOT NULL,
  progress_json TEXT NOT NULL DEFAULT '{}',
  stats_json    TEXT NOT NULL DEFAULT '{}',
  error         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at   TEXT
);

CREATE TABLE IF NOT EXISTS vulnerabilities (
  id            TEXT PRIMARY KEY,
  scan_id       TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  severity      TEXT NOT NULL,
  confidence    TEXT NOT NULL,
  url           TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  score         REAL NOT NULL DEFAULT 0,
  remediation   TEXT NOT NULL DEFAULT '',
  ai_analysis   TEXT,
  discovered_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vulns_scan ON vulnerabilities(scan_id);
CREATE INDEX IF NOT EXISTS idx_vulns_severity ON vulnerabilities(severity);

CREATE TABLE IF NOT EXISTS scan_endpoints (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id     TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  method      TEXT NOT NULL DEFAULT 'GET',
  params_json TEXT NOT NULL DEFAULT '[]',
  source      TEXT NOT NULL DEFAULT 'crawl'
);
CREATE INDEX IF NOT EXISTS idx_endpoints_scan ON scan_endpoints(scan_id);

CREATE TABLE IF NOT EXISTS blind_xss_callbacks (
  id           TEXT PRIMARY KEY,
  token        TEXT NOT NULL,
  scan_id      TEXT,
  origin_url   TEXT,
  referer      TEXT,
  user_agent   TEXT,
  cookies      TEXT,
  location     TEXT,
  title        TEXT,
  dom_snippet  TEXT,
  screenshot   TEXT,
  extra_json   TEXT NOT NULL DEFAULT '{}',
  remote_addr  TEXT,
  received_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_callbacks_scan ON blind_xss_callbacks(scan_id);

CREATE TABLE IF NOT EXISTS webhook_configs (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  url        TEXT,
  enabled    INTEGER NOT NULL DEFAULT 1,
  events     TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,
  scan_id     TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  format      TEXT NOT NULL,
  path        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

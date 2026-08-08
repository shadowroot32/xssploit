import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type DB = Database.Database;

let db: DB | null = null;

/**
 * Open (and lazily create) the local SQLite database. WAL mode for
 * concurrent reads while a scan writes findings.
 */
export function getDb(): DB {
  if (db) return db;
  const url = process.env.DATABASE_URL ?? './data/xssploit.db';
  const file = url.replace(/^sqlite:(\/\/)?/, '');
  mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

/** Apply schema.sql — idempotent (CREATE TABLE IF NOT EXISTS). */
export function migrate(): void {
  const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');
  getDb().exec(readFileSync(schemaPath, 'utf8'));
}

/**
 * CLI migration entry: `pnpm db:migrate`.
 */
import { migrate, getDb } from './index.js';

migrate();
const tables = getDb()
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all() as { name: string }[];
console.log('✅ database migrated. tables:', tables.map((t) => t.name).join(', '));

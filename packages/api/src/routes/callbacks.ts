import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';

export async function callbackRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (req) => {
    const { scanId, limit = '100' } = req.query as { scanId?: string; limit?: string };
    const db = getDb();
    const rows = scanId
      ? db.prepare(`SELECT * FROM blind_xss_callbacks WHERE scan_id = ? ORDER BY received_at DESC LIMIT ?`).all(scanId, Number(limit))
      : db.prepare(`SELECT * FROM blind_xss_callbacks ORDER BY received_at DESC LIMIT ?`).all(Number(limit));
    return { callbacks: rows };
  });
}

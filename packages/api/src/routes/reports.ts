import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';

const MIME: Record<string, string> = {
  html: 'text/html',
  markdown: 'text/markdown',
  sarif: 'application/sarif+json',
  junit: 'application/xml',
};

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (req) => {
    const { scanId } = req.query as { scanId?: string };
    const db = getDb();
    const rows = scanId
      ? db.prepare(`SELECT * FROM reports WHERE scan_id = ? ORDER BY created_at DESC`).all(scanId)
      : db.prepare(`SELECT * FROM reports ORDER BY created_at DESC LIMIT 200`).all();
    return { reports: rows };
  });

  app.get('/:id/download', async (req, reply) => {
    const row = getDb()
      .prepare(`SELECT * FROM reports WHERE id = ?`)
      .get((req.params as { id: string }).id) as { path: string; format: string } | undefined;
    if (!row || !existsSync(row.path)) return reply.code(404).send({ error: 'report not found' });
    reply.header('content-type', MIME[row.format] ?? 'application/octet-stream');
    reply.header('content-disposition', `attachment; filename="${path.basename(row.path)}"`);
    return reply.send(createReadStream(row.path));
  });
}

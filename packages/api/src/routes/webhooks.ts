import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';

const VALID_TYPES = new Set(['discord', 'telegram', 'custom']);

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => ({
    webhooks: getDb().prepare(`SELECT * FROM webhook_configs ORDER BY created_at DESC`).all(),
  }));

  app.post('/', async (req, reply) => {
    const body = req.body as { type?: string; url?: string; events?: string[]; enabled?: boolean };
    if (!body?.type || !VALID_TYPES.has(body.type)) {
      return reply.code(400).send({ error: `type must be one of: ${[...VALID_TYPES].join(', ')}` });
    }
    if (body.type !== 'telegram' && !body.url?.startsWith('http')) {
      return reply.code(400).send({ error: 'url is required and must be http(s)' });
    }
    const id = randomUUID();
    getDb()
      .prepare(`INSERT INTO webhook_configs (id, type, url, enabled, events) VALUES (?, ?, ?, ?, ?)`)
      .run(id, body.type, body.url ?? null, body.enabled === false ? 0 : 1, JSON.stringify(body.events ?? ['vuln-found', 'scan-finished']));
    return reply.code(201).send({ id });
  });

  app.delete('/:id', async (req, reply) => {
    const res = getDb().prepare(`DELETE FROM webhook_configs WHERE id = ?`).run((req.params as { id: string }).id);
    if (res.changes === 0) return reply.code(404).send({ error: 'webhook not found' });
    return { deleted: true };
  });
}

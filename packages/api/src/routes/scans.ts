import type { FastifyInstance } from 'fastify';
import type { ScanConfig } from '@xssploit/shared';
import { SCAN_PROFILES } from '@xssploit/shared';
import type { ScanService } from '../services/scan-service.js';

const TARGET_RE = /^https?:\/\/.+/;

export function scanRoutes(service: ScanService) {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.get('/', async () => ({ scans: service.listScans() }));

    app.get('/profiles', async () => ({ profiles: SCAN_PROFILES }));

    app.get('/:id', async (req, reply) => {
      const scan = service.getScan((req.params as { id: string }).id);
      if (!scan) return reply.code(404).send({ error: 'scan not found' });
      return { scan };
    });

    app.post('/', async (req, reply) => {
      const body = req.body as Partial<ScanConfig> & { targetUrl?: string };
      if (!body?.targetUrl || !TARGET_RE.test(body.targetUrl)) {
        return reply.code(400).send({ error: 'targetUrl must be an http(s) URL' });
      }
      if (body.profile && !(body.profile in SCAN_PROFILES)) {
        return reply.code(400).send({ error: `unknown profile; use one of: ${Object.keys(SCAN_PROFILES).join(', ')}` });
      }
      if (body.userPrompt !== undefined) {
        if (typeof body.userPrompt !== 'string' || body.userPrompt.length > 2000) {
          return reply.code(400).send({ error: 'userPrompt must be a string of at most 2000 chars' });
        }
        body.userPrompt = body.userPrompt.trim() || undefined;
      }
      const { scanId } = service.startScan(body as ScanConfig);
      return reply.code(201).send({ scanId, status: 'running' });
    });

    app.post('/:id/cancel', async (req, reply) => {
      const ok = service.cancelScan((req.params as { id: string }).id);
      if (!ok) return reply.code(409).send({ error: 'scan not running (already finished?)' });
      return { cancelled: true };
    });

    app.get('/:id/vulnerabilities', async (req) => ({
      vulnerabilities: service.listVulnerabilities((req.params as { id: string }).id),
    }));
  };
}

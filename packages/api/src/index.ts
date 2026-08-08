import Fastify from 'fastify';
import cors from '@fastify/cors';
import { migrate } from './db/index.js';
import { localAuth } from './middleware/auth.js';
import { ScanService } from './services/scan-service.js';
import { scanRoutes } from './routes/scans.js';
import { vulnerabilityRoutes } from './routes/vulnerabilities.js';
import { payloadRoutes } from './routes/payloads.js';
import { callbackRoutes } from './routes/callbacks.js';
import { reportRoutes } from './routes/reports.js';
import { webhookRoutes } from './routes/webhooks.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('api');

export async function buildServer() {
  migrate();

  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    trustProxy: false,
  });

  await app.register(cors, {
    origin: [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/],
    credentials: false,
  });

  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'xssploit-api',
    version: '5.0.0',
    time: new Date().toISOString(),
  }));

  // Everything below requires the local token when configured.
  app.register(async (protected_) => {
    protected_.addHook('preHandler', localAuth);
    const service = new ScanService();
    await protected_.register(scanRoutes(service), { prefix: '/api/scans' });
    await protected_.register(vulnerabilityRoutes(service), { prefix: '/api/vulnerabilities' });
    await protected_.register(payloadRoutes, { prefix: '/api/payloads' });
    await protected_.register(callbackRoutes, { prefix: '/api/callbacks' });
    await protected_.register(reportRoutes, { prefix: '/api/reports' });
    await protected_.register(webhookRoutes, { prefix: '/api/webhooks' });
  });

  return app;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''));
if (isMain) {
  const host = process.env.API_HOST ?? '127.0.0.1';
  const port = Number(process.env.API_PORT ?? 4000);
  buildServer()
    .then((app) => app.listen({ host, port }))
    .then(() => logger.info(`🛡️  XSSPLOIT API listening on http://${host}:${port}`))
    .catch((err) => {
      logger.error(err);
      process.exit(1);
    });
}

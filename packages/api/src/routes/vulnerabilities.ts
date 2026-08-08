import type { FastifyInstance } from 'fastify';
import type { ScanService } from '../services/scan-service.js';

export function vulnerabilityRoutes(service: ScanService) {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.get('/', async (req) => {
      const { scanId } = req.query as { scanId?: string };
      return { vulnerabilities: service.listVulnerabilities(scanId) };
    });
  };
}

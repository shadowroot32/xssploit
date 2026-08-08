import { pino, type Logger } from 'pino';

/**
 * Create a namespaced structured logger. LOG_LEVEL env controls verbosity
 * (debug during development, info in normal runs).
 */
export function createLogger(name: string): Logger {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? 'info',
    base: { component: name },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Single-user guard. When LOCAL_AUTH_TOKEN is set, every /api/* route
 * requires `Authorization: Bearer <token>`. When unset (default), the API
 * is assumed to be bound to localhost only and the check passes through.
 *
 * This is deliberately NOT multi-user auth — v5 is a personal tool.
 */
export async function localAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const required = process.env.LOCAL_AUTH_TOKEN;
  if (!required) return;

  const header = request.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  // Constant-time-ish comparison without leaking length.
  const a = Buffer.from(token.padEnd(128).slice(0, 128));
  const b = Buffer.from(required.padEnd(128).slice(0, 128));
  if (a.length !== b.length || !a.equals(b)) {
    await reply.code(401).send({ error: 'unauthorized', message: 'invalid or missing LOCAL_AUTH_TOKEN' });
  }
}

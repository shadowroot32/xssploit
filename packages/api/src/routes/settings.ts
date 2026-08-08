import type { FastifyInstance } from 'fastify';
import {
  loadSettings,
  saveAISettings,
  resolveAISettings,
  hasFileValue,
  type AISettings,
} from '@xssploit/engine';

const MASK = '••••••••';
const ALLOWED_KEYS = [
  'anthropicApiKey',
  'antigravityApiKey',
  'antigravityBaseUrl',
  'deepseekApiKey',
  'deepseekBaseUrl',
  'ollamaBaseUrl',
  'ollamaModel',
] as const;

type AIKey = (typeof ALLOWED_KEYS)[number];

function maskSecret(v: string): string {
  return v.length <= 4 ? MASK : `${v.slice(0, 4)}${MASK}`;
}

/** Public view: secrets are masked; `source` tells the UI where the value comes from. */
function publicView() {
  const resolved = resolveAISettings();
  const secret = (k: AIKey) => ({
    set: resolved[k].length > 0,
    preview: resolved[k] ? maskSecret(resolved[k]) : null,
    source: hasFileValue(k) ? 'settings' : process.env[envName(k)] ? 'env' : 'unset',
  });
  const plain = (k: AIKey) => ({
    value: resolved[k],
    source: hasFileValue(k) ? 'settings' : process.env[envName(k)] ? 'env' : 'default',
  });
  return {
    anthropicApiKey: secret('anthropicApiKey'),
    antigravityApiKey: secret('antigravityApiKey'),
    deepseekApiKey: secret('deepseekApiKey'),
    antigravityBaseUrl: plain('antigravityBaseUrl'),
    deepseekBaseUrl: plain('deepseekBaseUrl'),
    ollamaBaseUrl: plain('ollamaBaseUrl'),
    ollamaModel: plain('ollamaModel'),
    updatedAt: loadSettings().updatedAt || null,
  };
}

function envName(k: AIKey): string {
  return (
    {
      anthropicApiKey: 'ANTHROPIC_API_KEY',
      antigravityApiKey: 'ANTIGRAVITY_API_KEY',
      antigravityBaseUrl: 'ANTIGRAVITY_BASE_URL',
      deepseekApiKey: 'DEEPSEEK_API_KEY',
      deepseekBaseUrl: 'DEEPSEEK_BASE_URL',
      ollamaBaseUrl: 'OLLAMA_BASE_URL',
      ollamaModel: 'OLLAMA_MODEL',
    } as Record<AIKey, string>
  )[k];
}

/**
 * AI provider settings. Keys saved here override env vars and persist in
 * the api-data volume (./data/xssploit-settings.json, mode 0600).
 */
export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => ({ ai: publicView() }));

  app.put('/ai', async (req, reply) => {
    const body = req.body as Partial<Record<AIKey, string | null>> | null;
    if (!body || typeof body !== 'object') {
      return reply.code(400).send({ error: 'body must be an object of AI settings' });
    }
    const patch: AISettings = {};
    for (const k of ALLOWED_KEYS) {
      const v = body[k];
      if (v === undefined) continue;
      if (v === null || v === '') {
        patch[k] = undefined; // explicit clear
        continue;
      }
      if (typeof v !== 'string' || v.length > 500) {
        return reply.code(400).send({ error: `${k} must be a string of at most 500 chars` });
      }
      if (k.toLowerCase().includes('apikey') && v.includes(MASK)) continue; // unchanged masked value
      patch[k] = v.trim();
    }
    // undefined fields must actually remove the key → rebuild the file
    const current = loadSettings().ai;
    const next: AISettings = { ...current };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete next[k as AIKey];
      else next[k as AIKey] = v;
    }
    // wipe-and-save so deletions stick
    saveAISettings(Object.fromEntries(ALLOWED_KEYS.map((k) => [k, undefined])) as AISettings);
    saveAISettings(next);
    return { ok: true, ai: publicView() };
  });
}

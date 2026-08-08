import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Persisted operator settings (AI provider keys/config) stored server-side.
 * Resolution order at read time: file value → process.env → built-in default.
 *
 * The file lives next to the SQLite DB by default (./data/xssploit-settings.json)
 * so the Docker `api-data` volume persists it across rebuilds.
 */
export interface AISettings {
  anthropicApiKey?: string;
  antigravityApiKey?: string;
  antigravityBaseUrl?: string;
  deepseekApiKey?: string;
  deepseekBaseUrl?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}

export interface SettingsFile {
  ai: AISettings;
  updatedAt: string;
}

const FILE_NAME = 'xssploit-settings.json';

function settingsPath(): string {
  const dir = process.env.SETTINGS_DIR
    ?? path.dirname((process.env.DATABASE_URL ?? './data/xssploit.db').replace(/^sqlite:(\/\/)?/, ''));
  return path.join(path.resolve(dir), FILE_NAME);
}

let cache: SettingsFile | null = null;

export function loadSettings(): SettingsFile {
  if (cache) return cache;
  const file = settingsPath();
  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<SettingsFile>;
      cache = { ai: parsed.ai ?? {}, updatedAt: parsed.updatedAt ?? '' };
      return cache;
    } catch {
      // corrupted file → start fresh, don't crash the API
    }
  }
  cache = { ai: {}, updatedAt: '' };
  return cache;
}

export function saveAISettings(ai: AISettings): SettingsFile {
  const current = loadSettings();
  const next: SettingsFile = {
    ai: { ...current.ai, ...ai },
    updatedAt: new Date().toISOString(),
  };
  const file = settingsPath();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(next, null, 2), { mode: 0o600 });
  cache = next;
  return next;
}

/** True when a non-empty value came from the settings file (not env). */
export function hasFileValue(key: keyof AISettings): boolean {
  const v = loadSettings().ai[key];
  return typeof v === 'string' && v.length > 0;
}

function pick(fileVal: string | undefined, envVal: string | undefined, fallback: string): string {
  if (fileVal && fileVal.length > 0) return fileVal;
  if (envVal && envVal.length > 0) return envVal;
  return fallback;
}

/** Resolved AI config — what the providers should use right now. */
export function resolveAISettings(): Required<AISettings> {
  const ai = loadSettings().ai;
  return {
    anthropicApiKey: pick(ai.anthropicApiKey, process.env.ANTHROPIC_API_KEY, ''),
    antigravityApiKey: pick(ai.antigravityApiKey, process.env.ANTIGRAVITY_API_KEY, ''),
    antigravityBaseUrl: pick(ai.antigravityBaseUrl, process.env.ANTIGRAVITY_BASE_URL, 'https://api.antigravity.ai/v1'),
    deepseekApiKey: pick(ai.deepseekApiKey, process.env.DEEPSEEK_API_KEY, ''),
    deepseekBaseUrl: pick(ai.deepseekBaseUrl, process.env.DEEPSEEK_BASE_URL, 'https://api.deepseek.com/v1'),
    ollamaBaseUrl: pick(ai.ollamaBaseUrl, process.env.OLLAMA_BASE_URL ?? process.env.OLLAMA_HOST, 'http://localhost:11434'),
    ollamaModel: pick(ai.ollamaModel, process.env.OLLAMA_MODEL, 'llama3.1:8b'),
  };
}

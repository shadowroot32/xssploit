/**
 * Finds likely leaked secrets in JavaScript files. Informational findings —
 * they enrich the report but are not XSS by themselves.
 */
const PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'aws-access-key', re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'gcp-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'generic-api-key', re: /api[_-]?key["'\s:=]+["'][0-9a-zA-Z_-]{20,}["']/i },
  { name: 'bearer-token', re: /authorization["'\s:=]+["']bearer\s+[0-9a-zA-Z._-]{20,}["']/i },
  { name: 'slack-token', re: /\bxox[baprs]-[0-9a-zA-Z-]{10,}\b/ },
  { name: 'private-key', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'github-token', re: /\bgh[pousr]_[0-9a-zA-Z]{36,}\b/ },
];

export interface SecretFinding {
  name: string;
  match: string;
  line: number;
}

export function findSecrets(js: string): SecretFinding[] {
  const out: SecretFinding[] = [];
  const lines = js.split('\n');
  lines.forEach((line, i) => {
    for (const { name, re } of PATTERNS) {
      const m = line.match(re);
      if (m) out.push({ name, match: m[0].slice(0, 12) + '…', line: i + 1 });
    }
  });
  return out;
}

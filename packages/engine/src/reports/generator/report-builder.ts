import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import Handlebars from 'handlebars';
import type { ScanResult, Vulnerability } from '@xssploit/shared';
import { formatDuration, XSS_TYPE_INFO } from '@xssploit/shared';

export interface ReportData {
  scan: ScanResult;
  vulnerabilities: Vulnerability[];
  generatedAt: string;
}

/**
 * Renders scan findings into shareable report artifacts:
 * HTML (self-contained, styled), Markdown, SARIF (CI), JUnit (CI).
 */
export class ReportBuilder {
  private readonly outDir: string;

  constructor(outDir: string) {
    this.outDir = outDir;
    mkdirSync(outDir, { recursive: true });
    Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
    Handlebars.registerHelper('typeLabel', (t: string) => XSS_TYPE_INFO[t as keyof typeof XSS_TYPE_INFO]?.label ?? t);
    Handlebars.registerHelper('duration', (ms: number) => formatDuration(ms));
  }

  buildAll(data: ReportData): Record<string, string> {
    return {
      html: this.buildHtml(data),
      markdown: this.buildMarkdown(data),
      sarif: this.buildSarif(data),
      junit: this.buildJunit(data),
    };
  }

  private render(templateFile: string, data: ReportData, outFile: string): string {
    const templatePath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      '..',
      'templates',
      templateFile,
    );
    const source = existsSync(templatePath)
      ? readFileSync(templatePath, 'utf8')
      : FALLBACK_TEMPLATES[templateFile] ?? '';
    const out = path.join(this.outDir, outFile);
    writeFileSync(out, Handlebars.compile(source)(data), 'utf8');
    return out;
  }

  buildHtml(data: ReportData): string {
    return this.render('html-report.hbs', data, `xssploit-${data.scan.scanId}.html`);
  }

  buildMarkdown(data: ReportData): string {
    const out = path.join(this.outDir, `xssploit-${data.scan.scanId}.md`);
    writeFileSync(out, renderMarkdown(data), 'utf8');
    return out;
  }

  buildSarif(data: ReportData): string {
    const sarif = {
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'XSSPLOIT',
              version: '5.0.0',
              informationUri: 'https://localhost',
              rules: data.vulnerabilities.map((v) => ({
                id: v.id,
                name: v.title,
                shortDescription: { text: v.title },
                fullDescription: { text: v.description },
                help: { text: v.remediation },
                properties: { 'security-severity': String(v.score) },
              })),
            },
          },
          results: data.vulnerabilities.map((v) => ({
            ruleId: v.id,
            level: v.severity === 'critical' || v.severity === 'high' ? 'error' : v.severity === 'medium' ? 'warning' : 'note',
            message: { text: `${v.title} — payload: ${v.evidence.payload}` },
            locations: [{ physicalLocation: { artifactLocation: { uri: v.url } } }],
          })),
        },
      ],
    };
    const out = path.join(this.outDir, `xssploit-${data.scan.scanId}.sarif`);
    writeFileSync(out, JSON.stringify(sarif, null, 2), 'utf8');
    return out;
  }

  buildJunit(data: ReportData): string {
    const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
    const cases = data.vulnerabilities
      .map(
        (v) => `  <testcase classname="${esc(v.type)}" name="${esc(v.title)}" time="0">
    <failure message="${esc(v.severity.toUpperCase())}: ${esc(v.title)}">${esc(v.description)}\nPayload: ${esc(v.evidence.payload)}</failure>
  </testcase>`,
      )
      .join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="xssploit" tests="${data.vulnerabilities.length}" failures="${data.vulnerabilities.length}" time="${(data.scan.stats.durationMs / 1000).toFixed(2)}">
${cases}
</testsuite>
`;
    const out = path.join(this.outDir, `xssploit-${data.scan.scanId}.xml`);
    writeFileSync(out, xml, 'utf8');
    return out;
  }
}

function renderMarkdown(data: ReportData): string {
  const { scan, vulnerabilities } = data;
  const lines: string[] = [
    `# XSSPLOIT Report — ${scan.config.targetUrl}`,
    '',
    `- **Program:** ${scan.config.program ?? '—'}`,
    `- **Profile:** ${scan.config.profile}`,
    `- **Date:** ${data.generatedAt}`,
    `- **Duration:** ${formatDuration(scan.stats.durationMs)}`,
    `- **Requests:** ${scan.stats.requestsSent} | **Endpoints tested:** ${scan.stats.endpointsTested}`,
    `- **Findings:** ${vulnerabilities.length}`,
    ...(scan.config.userPrompt ? [`- **AI directives:** ${scan.config.userPrompt}`] : []),
    '',
    '---',
    '',
  ];
  vulnerabilities.forEach((v, i) => {
    lines.push(
      `## ${i + 1}. ${v.title}`,
      '',
      `- **Type:** ${XSS_TYPE_INFO[v.type]?.label ?? v.type}`,
      `- **Severity:** ${v.severity.toUpperCase()} (score ${v.score.toFixed(1)}, ${v.confidence})`,
      `- **URL:** ${v.url}`,
      `- **Parameter:** ${v.evidence.parameter}`,
      `- **Context:** ${v.evidence.context}`,
      '',
      '**Payload**',
      '```',
      v.evidence.payload,
      '```',
      '',
      v.description,
      '',
      `**Remediation:** ${v.remediation}`,
      v.aiAnalysis ? `\n**AI analysis:** ${v.aiAnalysis}` : '',
      '',
      '---',
      '',
    );
  });
  return lines.join('\n');
}

/** Inline fallbacks so reports work even before template files exist. */
const FALLBACK_TEMPLATES: Record<string, string> = {
  'html-report.hbs': `<!doctype html><html><head><meta charset="utf-8"><title>XSSPLOIT Report</title>
<style>body{font-family:system-ui;background:#0a0a0f;color:#e5e5ef;padding:2rem} .vuln{border:1px solid #333;border-radius:8px;padding:1rem;margin:1rem 0} .sev-critical,.sev-high{color:#f43f5e}.sev-medium{color:#f59e0b}pre{background:#14141c;padding:.75rem;overflow:auto}</style>
</head><body><h1>🛡️ XSSPLOIT Report</h1><p>Target: {{scan.config.targetUrl}} · Findings: {{vulnerabilities.length}}</p>
{{#each vulnerabilities}}<div class="vuln"><h3 class="sev-{{severity}}">{{title}}</h3><p>{{description}}</p><pre>{{evidence.payload}}</pre><p><b>Remediation:</b> {{remediation}}</p></div>{{/each}}
</body></html>`,
};

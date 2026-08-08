import { describe, expect, it } from 'vitest';
import { CSPAnalyzer } from '../src/core/analyzer/csp-analyzer.js';

describe('CSPAnalyzer', () => {
  const analyzer = new CSPAnalyzer();

  it('flags missing policy', () => {
    const report = analyzer.analyze(undefined);
    expect(report.present).toBe(false);
    expect(report.allowsInlineScript).toBe(true);
  });

  it('flags unsafe-inline in script-src', () => {
    const report = analyzer.analyze("default-src 'self'; script-src 'self' 'unsafe-inline'");
    expect(report.present).toBe(true);
    expect(report.allowsInlineScript).toBe(true);
    expect(report.findings.some((f) => f.issue.includes('unsafe-inline'))).toBe(true);
  });

  it('flags wildcard sources', () => {
    const report = analyzer.analyze('default-src *');
    expect(report.findings.some((f) => f.severity === 'high')).toBe(true);
  });

  it('recognizes a strict policy', () => {
    const report = analyzer.analyze("default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'");
    expect(report.allowsInlineScript).toBe(false);
  });
});

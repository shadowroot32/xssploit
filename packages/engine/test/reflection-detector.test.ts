import { describe, expect, it } from 'vitest';
import { ReflectionDetector } from '../src/core/analyzer/reflection-detector.js';

describe('ReflectionDetector', () => {
  const detector = new ReflectionDetector();
  const CANARY = 'xssAB12';

  it('locates exact reflections with html-body context', () => {
    const body = `<html><body>results for: ${CANARY}</body></html>`;
    const hits = detector.find(body, CANARY);
    expect(hits.length).toBe(1);
    expect(hits[0]!.context).toBe('html-body');
  });

  it('detects attribute context', () => {
    const body = `<input value="${CANARY}">`;
    const hits = detector.find(body, CANARY);
    expect(hits.length).toBe(1);
    expect(hits[0]!.context).toBe('html-attribute');
  });

  it('detects javascript string context', () => {
    const body = `<script>var q = '${CANARY}';</script>`;
    const hits = detector.find(body, CANARY);
    expect(hits.length).toBe(1);
    expect(hits[0]!.context).toBe('javascript-string');
  });

  it('finds multiple reflections', () => {
    const body = `${CANARY} and <input value="${CANARY}">`;
    expect(detector.find(body, CANARY).length).toBe(2);
  });

  it('returns empty when no reflection', () => {
    expect(detector.find('<p>nothing</p>', CANARY)).toEqual([]);
  });
});

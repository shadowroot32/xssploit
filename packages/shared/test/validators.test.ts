import { describe, expect, it } from 'vitest';
import { isInScope, isOutOfScope, parseHttpUrl, validatePayload } from '../src/utils/validators.js';

describe('parseHttpUrl', () => {
  it('accepts http(s) URLs', () => {
    expect(parseHttpUrl('https://example.com')?.hostname).toBe('example.com');
    expect(parseHttpUrl('http://127.0.0.1:9999/x')?.port).toBe('9999');
  });
  it('rejects non-http schemes and garbage', () => {
    expect(parseHttpUrl('ftp://example.com')).toBeNull();
    expect(parseHttpUrl('not a url')).toBeNull();
    expect(parseHttpUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('scope matching', () => {
  const scope = ['example.com', '*.api.example.com'];
  it('matches exact and wildcard subdomains', () => {
    expect(isInScope('https://example.com/x', scope)).toBe(true);
    expect(isInScope('https://a.api.example.com/x', scope)).toBe(true);
  });
  it('rejects out-of-scope hosts', () => {
    expect(isInScope('https://evil.com', scope)).toBe(false);
    expect(isInScope('https://apiexample.com', scope)).toBe(false);
  });
  it('out-of-scope overrides', () => {
    expect(isOutOfScope('https://example.com/logout', ['/logout'])).toBe(true);
    expect(isOutOfScope('https://example.com/home', ['/logout'])).toBe(false);
  });
});

describe('validatePayload', () => {
  it('accepts sane payloads', () => {
    expect(validatePayload('<script>alert(1)</script>')).toBe(true);
  });
  it('rejects empty and absurdly long payloads', () => {
    expect(validatePayload('')).toBe(false);
    expect(validatePayload('x'.repeat(10_001))).toBe(false);
  });
});

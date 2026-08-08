import { describe, expect, it } from 'vitest';
import { decodeOnce, encoders } from '../src/utils/encoder.js';

describe('encoders', () => {
  it('url-encodes reserved characters', () => {
    const out = encoders.url('<script>alert(1)</script>');
    expect(out).toContain('%3C');
    expect(decodeOnce(out)).toBe('<script>alert(1)</script>');
  });

  it('double-url-encodes (double decode restores)', () => {
    const once = encoders.url('<');
    expect(once).toBe('%3C');
    const twice = encoders.doubleUrl('<');
    expect(twice).toBe(encodeURIComponent(once));
    expect(decodeOnce(decodeOnce(twice))).toBe('<');
  });

  it('html-entity encodes angle brackets', () => {
    expect(encoders.htmlEntities('<b>')).toBe('&lt;b&gt;');
  });

  it('htmlDecimalAll produces decimal entities that decodeOnce reverses', () => {
    const out = encoders.htmlDecimalAll('<a>');
    expect(out).toMatch(/^(&#\d+;)+$/);
    expect(decodeOnce(out)).toBe('<a>');
  });
});

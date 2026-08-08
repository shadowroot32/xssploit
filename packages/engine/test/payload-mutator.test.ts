import { describe, expect, it } from 'vitest';
import { PayloadMutator } from '../src/core/injector/payload-mutator.js';

describe('PayloadMutator', () => {
  const mutator = new PayloadMutator();
  const base = '<script>alert(1)</script>';

  it('produces deduplicated mutations', () => {
    const a = mutator.mutate(base, 8);
    expect(new Set(a).size).toBe(a.length);
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toContain(base);
  });

  it('respects the max cap', () => {
    expect(mutator.mutate(base, 2).length).toBeLessThanOrEqual(2);
  });

  it('keeps recognizable primitives across mutations', () => {
    for (const m of mutator.mutate(base, 8)) {
      expect(m.length).toBeGreaterThan(0);
      expect(/alert|&#|%3|<scr|scr<!--/i.test(m)).toBe(true);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { ScopeManager } from '../src/core/scope/scope-manager.js';

describe('ScopeManager', () => {
  it('defaults to target host when no in-scope list', () => {
    const sm = new ScopeManager('https://app.example.com', [], []);
    expect(sm.isAllowed('https://app.example.com/x')).toBe(true);
    expect(sm.isAllowed('https://other.com/x')).toBe(false);
  });

  it('in-scope widens, out-of-scope overrides', () => {
    const sm = new ScopeManager('https://app.example.com', ['*.example.com'], ['/admin']);
    expect(sm.isAllowed('https://api.example.com/x')).toBe(true);
    expect(sm.isAllowed('https://app.example.com/admin/panel')).toBe(false);
  });
});

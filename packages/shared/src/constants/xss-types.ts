import type { VulnType } from '../types/vulnerability.js';

/** Human-readable metadata per XSS class, used in reports and the dashboard. */
export const XSS_TYPE_INFO: Record<VulnType, { label: string; description: string }> = {
  'reflected-xss': {
    label: 'Reflected XSS',
    description:
      'Payload is reflected in the immediate HTTP response without proper encoding and executed by the browser.',
  },
  'stored-xss': {
    label: 'Stored XSS',
    description:
      'Payload is persisted server-side (comment, profile field, …) and served to other pages/users.',
  },
  'dom-xss': {
    label: 'DOM-based XSS',
    description:
      'Client-side JavaScript flows attacker-controlled data from a source (location.hash, postMessage, …) into an executable sink.',
  },
  'blind-xss': {
    label: 'Blind XSS',
    description:
      'Payload executes in a context the tester cannot see directly (admin panel, support tool) and reports back via the callback server.',
  },
  mxss: {
    label: 'Mutation XSS',
    description:
      'Markup that is inert as written but becomes executable after the browser/parser mutates it (innerHTML round-trip).',
  },
  'dom-clobbering': {
    label: 'DOM Clobbering',
    description:
      'Injected HTML named/id attributes shadow global variables or DOM properties relied upon by scripts.',
  },
  'csp-bypass': {
    label: 'CSP Bypass',
    description:
      'Content-Security-Policy is present but misconfigured (unsafe-inline, wildcard, JSONP-allowed host) so injected script still runs.',
  },
  'open-redirect': {
    label: 'Open Redirect',
    description:
      'User-controlled URL is used in a redirect; often chained into XSS via javascript: URLs or phishing.',
  },
};

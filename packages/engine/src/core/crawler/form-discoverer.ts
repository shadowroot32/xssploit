import { parseHTML } from 'linkedom';
import type { DiscoveredEndpoint } from '@xssploit/shared';

export interface DiscoveredForm {
  action: string;
  method: 'GET' | 'POST';
  inputs: { name: string; type: string; value: string }[];
  contentType: 'form' | 'json';
}

/**
 * Discover <form> elements and standalone inputs, and turn them into
 * testable endpoints. File inputs and CSRF-looking hidden fields are kept
 * (hidden fields are submitted with their original value, never fuzzed).
 */
export class FormDiscoverer {
  discover(html: string, pageUrl: string): DiscoveredForm[] {
    const { document } = parseHTML(html);
    const forms: DiscoveredForm[] = [];

    for (const form of document.querySelectorAll('form')) {
      const actionAttr = form.getAttribute('action') ?? pageUrl;
      let action: string;
      try {
        action = new URL(actionAttr, pageUrl).toString();
      } catch {
        continue;
      }
      const method = (form.getAttribute('method') ?? 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET';
      const enctype = form.getAttribute('enctype') ?? 'application/x-www-form-urlencoded';

      const inputs: DiscoveredForm['inputs'] = [];
      for (const el of form.querySelectorAll('input, textarea, select')) {
        const name = el.getAttribute('name');
        if (!name) continue;
        const type = (el.getAttribute('type') ?? 'text').toLowerCase();
        if (['submit', 'button', 'file', 'image', 'reset'].includes(type)) continue;
        inputs.push({ name, type, value: el.getAttribute('value') ?? '' });
      }

      if (inputs.length > 0) {
        forms.push({
          action,
          method,
          inputs,
          contentType: enctype.includes('json') ? 'json' : 'form',
        });
      }
    }

    return forms;
  }

  /** Convert discovered forms into endpoints with fuzzable param names. */
  toEndpoints(forms: DiscoveredForm[]): DiscoveredEndpoint[] {
    return forms.map((f) => ({
      url: f.action,
      method: f.method,
      params: f.inputs.filter((i) => i.type !== 'hidden').map((i) => i.name),
      source: 'form' as const,
      contentType: f.contentType,
    }));
  }
}

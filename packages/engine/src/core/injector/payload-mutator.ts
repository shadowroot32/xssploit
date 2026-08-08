import { encoders, type EncoderName } from '../../utils/encoder.js';

/**
 * Generates payload variants to evade naive filters: encoding passes,
 * case randomization, keyword splitting and null-byte/comment tricks.
 * The engine only escalates to mutations after the plain payload was
 * filtered, keeping noise low on cooperative targets.
 */
export class PayloadMutator {
  /** Produce up to `max` mutated variants, cheapest transformations first. */
  mutate(payload: string, max = 12): string[] {
    const variants = new Set<string>();

    // 1. Case randomization (bypasses case-sensitive keyword blocklists).
    variants.add(randomCase(payload));

    // 2. Encoding passes.
    for (const enc of ['url', 'doubleUrl', 'htmlDecimalAll'] as EncoderName[]) {
      variants.add(encoders[enc](payload));
    }

    // 3. Keyword splitting with HTML comments / tabs (classic WAF bypass).
    variants.add(payload.replace(/<script/gi, '<scr<!-- -->ipt'));
    variants.add(payload.replace(/alert\(/gi, 'alert/**/('));
    variants.add(payload.replace(/on(\w+)=/gi, 'on$1%09='.replace('%09', '\t')));

    // 4. Whitespace substitution.
    variants.add(payload.replace(/ /g, '/**/'));
    variants.add(payload.replace(/</g, '%0a<'));

    // 5. Protocol-relative javascript: obfuscation for URL contexts.
    if (/javascript:/i.test(payload)) {
      variants.add(payload.replace(/javascript:/gi, 'java\tscript:'));
      variants.add(payload.replace(/javascript:/gi, '&#106;avascript:'));
    }

    variants.delete(payload);
    return [...variants].slice(0, max);
  }
}

function randomCase(s: string): string {
  return [...s].map((c) => (Math.random() > 0.5 ? c.toUpperCase() : c.toLowerCase())).join('');
}

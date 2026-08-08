/**
 * Encoding helpers used by the payload mutator and analyzer.
 */

export const encoders = {
  url: (s: string): string => encodeURIComponent(s),

  doubleUrl: (s: string): string => encodeURIComponent(encodeURIComponent(s)),

  htmlEntities: (s: string): string =>
    s.replace(/[&<>"']/g, (c) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return map[c] ?? c;
    }),

  /** Decimal HTML entities — sometimes slips past naive keyword filters. */
  htmlDecimalAll: (s: string): string =>
    [...s].map((c) => `&#${c.codePointAt(0)};`).join(''),

  unicodeEscapes: (s: string): string =>
    [...s].map((c) => `\\u${(c.codePointAt(0) ?? 0).toString(16).padStart(4, '0')}`).join(''),

  base64: (s: string): string => Buffer.from(s, 'utf8').toString('base64'),

  hex: (s: string): string =>
    [...s].map((c) => `\\x${(c.codePointAt(0) ?? 0).toString(16).padStart(2, '0')}`).join(''),
} as const;

export type EncoderName = keyof typeof encoders;

/** Decode one layer of common encoding (used when analyzing reflections). */
export function decodeOnce(s: string): string {
  let out = s;
  try {
    out = decodeURIComponent(out);
  } catch {
    /* not url-encoded */
  }
  out = out
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
  return out;
}

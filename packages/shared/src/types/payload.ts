/**
 * Payload library types.
 */

export type PayloadCategory =
  | 'html-context'
  | 'attribute-context'
  | 'javascript-context'
  | 'url-context'
  | 'css-context'
  | 'svg-context'
  | 'template-context'
  | 'waf-bypass'
  | 'csp-bypass'
  | 'encoding'
  | 'polyglot'
  | 'blind-xss'
  | 'dom-clobbering'
  | 'mxss'
  | 'framework-specific'
  | 'custom'
  | 'ai-generated';

export interface Payload {
  /** Stable id (sha256 of the payload string, truncated). */
  id: string;
  payload: string;
  category: PayloadCategory;
  /** Origin file / repository / generator. */
  source: string;
  /** Contexts this payload is designed for. */
  contexts: InjectionContextLike[];
  /** Free-form tags: event-handler, svg, quote-break, ... */
  tags: string[];
  /** True if this payload needs the blind-XSS callback server. */
  requiresCallback: boolean;
}

/** Mirrors vulnerability.InjectionContext without a circular import. */
export type InjectionContextLike =
  | 'html-body'
  | 'html-attribute'
  | 'html-attribute-unquoted'
  | 'javascript-string'
  | 'javascript-code'
  | 'url'
  | 'css'
  | 'svg'
  | 'unknown';

/** payload-index.json root structure built by scripts/payload-collector. */
export interface PayloadIndex {
  version: string;
  generatedAt: string;
  total: number;
  categories: Record<string, { count: number; files: string[] }>;
  sources: { name: string; url: string; collectedAt: string; count: number }[];
}

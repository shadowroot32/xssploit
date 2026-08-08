import type { InjectionContext } from '@xssploit/shared';

export interface Reflection {
  /** Index in the response body where the marker appears. */
  index: number;
  context: InjectionContext;
  /** Which syntax chars survived unencoded around the marker. */
  intactSyntax: { angleBrackets: boolean; quotes: boolean; singleQuotes: boolean; parentheses: boolean };
}

/**
 * Locates a canary marker inside a response body and classifies the HTML
 * context it landed in. The injector sends payloads wrapped in a unique
 * canary (xss<hex>) so we can find reflections even when the payload
 * itself was transformed by a filter.
 */
export class ReflectionDetector {
  find(body: string, canary: string): Reflection[] {
    const out: Reflection[] = [];
    let idx = body.indexOf(canary);
    while (idx !== -1) {
      out.push({ index: idx, context: this.classifyContext(body, idx), intactSyntax: this.syntaxAround(body, idx, canary) });
      idx = body.indexOf(canary, idx + canary.length);
    }
    return out;
  }

  /** Walk backwards from the reflection to determine the enclosing context. */
  private classifyContext(body: string, index: number): InjectionContext {
    const before = body.slice(Math.max(0, index - 2000), index);

    // Inside <script> … </script> (last script open not yet closed)?
    const lastScriptOpen = before.lastIndexOf('<script');
    const lastScriptClose = before.lastIndexOf('</script');
    if (lastScriptOpen > lastScriptClose) {
      const scriptChunk = before.slice(lastScriptOpen);
      return /["'`][^"'`]*$/.test(scriptChunk) ? 'javascript-string' : 'javascript-code';
    }

    // Inside <style>?
    const lastStyleOpen = before.lastIndexOf('<style');
    const lastStyleClose = before.lastIndexOf('</style');
    if (lastStyleOpen > lastStyleClose) return 'css';

    // Inside an open tag (attribute zone)?
    const lastLt = before.lastIndexOf('<');
    const lastGt = before.lastIndexOf('>');
    if (lastLt > lastGt) {
      const tagChunk = before.slice(lastLt);
      if (/svg/i.test(tagChunk.slice(0, 10))) return 'svg';
      const quoted = /=\s*"[^"]*$/.test(tagChunk) || /=\s*'[^']*$/.test(tagChunk);
      if (quoted) return 'html-attribute';
      if (/=\s*[^\s>]*$/.test(tagChunk)) return 'html-attribute-unquoted';
      return 'html-attribute';
    }

    // URL contexts (href="/search?q=MARKER" is attribute; javascript: URLs handled by payload)
    if (/=\s*["']?(?:https?:)?\/[^>]*$/i.test(before.slice(-300))) return 'url';

    return 'html-body';
  }

  private syntaxAround(body: string, index: number, canary: string): Reflection['intactSyntax'] {
    const window = body.slice(Math.max(0, index - 64), index + canary.length + 64);
    return {
      angleBrackets: /<[a-zA-Z!/]/.test(window),
      quotes: window.includes('"'),
      singleQuotes: window.includes("'"),
      parentheses: window.includes('(') && window.includes(')'),
    };
  }
}

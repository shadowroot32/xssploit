import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

export interface TaintFlow {
  source: string;
  sink: string;
  /** The variable carrying tainted data (when statically resolvable). */
  via?: string;
  line: number;
  snippet: string;
  confidence: 'high' | 'medium';
}

/** DOM sources that an attacker can influence. */
const SOURCES = new Set([
  'location.hash',
  'location.search',
  'location.href',
  'location.pathname',
  'document.URL',
  'document.documentURI',
  'document.referrer',
  'window.name',
]);

/** Sinks that turn strings into code/markup. */
const SINKS = new Set([
  'innerHTML',
  'outerHTML',
  'document.write',
  'document.writeln',
  'eval',
  'setTimeout',
  'setInterval',
  'Function',
  'location',
  'location.href',
  'srcdoc',
  'insertAdjacentHTML',
]);

/**
 * Static taint analysis over inline/external scripts using the Acorn AST.
 * Tracks simple flows: assignment from a SOURCE into a variable, then that
 * variable (or the source directly) reaching a SINK. This is the fast,
 * browserless layer of DOM-XSS detection; the sandbox confirms exploitability.
 */
export class JSStaticAnalyzer {
  analyze(script: string, scriptName = 'inline'): TaintFlow[] {
    let ast: acorn.Node;
    try {
      ast = acorn.parse(script, { ecmaVersion: 'latest', locations: true, allowHashBang: true });
    } catch {
      return []; // unparseable (minifier quirks) — sandbox layer still covers it
    }

    const flows: TaintFlow[] = [];
    const tainted = new Set<string>();

    const sourceName = (node: acorn.Node): string | null => {
      const n = node as acorn.AnyNode;
      if (n.type === 'MemberExpression') {
        const path = memberPath(n);
        return path && SOURCES.has(path) ? path : null;
      }
      return null;
    };

    const sinkName = (node: acorn.AnyNode): string | null => {
      if (node.type === 'MemberExpression') {
        const path = memberPath(node);
        if (path && SINKS.has(path)) return path;
        const last = path?.split('.').pop();
        if (last && SINKS.has(last)) return last;
      }
      if (node.type === 'Identifier' && SINKS.has(node.name)) return node.name;
      return null;
    };

    const lineOf = (node: acorn.Node) => (node as acorn.AnyNode & { loc?: { start: { line: number } } }).loc?.start.line ?? 0;
    const snippetOf = (node: acorn.Node) =>
      script.slice(node.start, Math.min(node.end, node.start + 120)).replace(/\s+/g, ' ').trim();

    // Pass 1: collect tainted variables.
    walk.simple(ast, {
      VariableDeclarator(node) {
        const init = node.init;
        if (init && node.id.type === 'Identifier') {
          const src = sourceName(init);
          if (src) tainted.add(node.id.name);
        }
      },
      AssignmentExpression(node) {
        if (node.left.type === 'Identifier') {
          const src = sourceName(node.right);
          if (src) tainted.add(node.left.name);
          // assignment into a sink property with tainted right side
          const sink = sinkName(node.left);
          const rightTainted =
            sourceName(node.right) ||
            (node.right.type === 'Identifier' && tainted.has(node.right.name)) ||
            exprContainsTainted(node.right, tainted, sourceName);
          if (sink && rightTainted) {
            flows.push({
              source: sourceName(node.right) ?? 'tainted-variable',
              sink,
              via: node.right.type === 'Identifier' ? node.right.name : undefined,
              line: lineOf(node),
              snippet: snippetOf(node),
              confidence: sourceName(node.right) ? 'high' : 'medium',
            });
          }
        }
      },
    });

    // Pass 2: direct source → sink calls (eval(location.hash), document.write(...)).
    walk.simple(ast, {
      CallExpression(node) {
        const callee = node.callee;
        const sink = sinkName(callee);
        if (!sink) return;
        for (const arg of node.arguments) {
          const direct = sourceName(arg);
          const viaVar = arg.type === 'Identifier' && tainted.has(arg.name) ? arg.name : undefined;
          if (direct || viaVar || exprContainsTainted(arg, tainted, sourceName)) {
            flows.push({
              source: direct ?? 'tainted-variable',
              sink,
              via: viaVar,
              line: lineOf(node),
              snippet: snippetOf(node),
              confidence: direct ? 'high' : 'medium',
            });
            break;
          }
        }
      },
    });

    void scriptName;
    return dedupe(flows);
  }
}

function exprContainsTainted(
  node: acorn.AnyNode,
  tainted: Set<string>,
  sourceName: (n: acorn.Node) => string | null,
): boolean {
  let hit = false;
  walk.simple(node as acorn.Node, {
    Identifier(n) {
      if (tainted.has(n.name)) hit = true;
    },
    MemberExpression(n) {
      if (sourceName(n as unknown as acorn.Node)) hit = true;
    },
  });
  return hit;
}

function memberPath(node: acorn.AnyNode): string | null {
  const parts: string[] = [];
  let cur: acorn.AnyNode | undefined = node;
  while (cur && cur.type === 'MemberExpression') {
    if (cur.property.type === 'Identifier') parts.unshift(cur.property.name);
    cur = cur.object;
  }
  if (cur && cur.type === 'Identifier') parts.unshift(cur.name);
  return parts.length > 0 ? parts.join('.') : null;
}

function dedupe(flows: TaintFlow[]): TaintFlow[] {
  const seen = new Set<string>();
  return flows.filter((f) => {
    const key = `${f.source}→${f.sink}@${f.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

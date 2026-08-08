import { isInScope, isOutOfScope, parseHttpUrl } from '@xssploit/shared';

/**
 * Decides what the scanner may touch. The hard rule of the whole tool:
 * nothing leaves the engine unless this manager allows it.
 */
export class ScopeManager {
  private readonly scope: string[];
  private readonly outPatterns: string[];

  constructor(
    targetUrl: string,
    inScope: string[] = [],
    outOfScope: string[] = [],
  ) {
    // Store the full origin ("http://host:port") — isInScope compares origins
    // exactly when given a URL, so localhost targets on non-standard ports
    // (test servers, staging) stay in scope.
    const origin = parseHttpUrl(targetUrl)?.origin ?? '';
    this.scope = inScope.length > 0 ? inScope : [origin];
    this.outPatterns = [...DEFAULT_OUT_OF_SCOPE, ...outOfScope];
  }

  isAllowed(url: string): boolean {
    return isInScope(url, this.scope) && !isOutOfScope(url, this.outPatterns);
  }

  getScope(): string[] {
    return [...this.scope];
  }
}

/** Destructive endpoints are never requested, even when in scope. */
const DEFAULT_OUT_OF_SCOPE = [
  '/logout',
  '/signout',
  '/sign-out',
  '/delete',
  '/remove',
  '/deactivate',
  'action=delete',
];

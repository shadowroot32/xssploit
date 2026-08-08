import type { HttpResponse } from '../../utils/http-client.js';
import { ReflectionDetector, type Reflection } from './reflection-detector.js';

export interface AnalysisResult {
  reflected: boolean;
  reflections: Reflection[];
  /** True when the response encodes the payload (safe behavior). */
  encoded: boolean;
  /** Detected blocking (403/406 + WAF-ish body). */
  blocked: boolean;
}

/**
 * Decides whether an injected payload came back executable, encoded, or
 * blocked. This is the oracle for reflected XSS findings.
 */
export class ResponseAnalyzer {
  private readonly detector = new ReflectionDetector();

  analyze(response: HttpResponse, canary: string, rawPayload: string): AnalysisResult {
    const reflections = this.detector.find(response.body, canary);
    const blocked =
      response.status === 403 ||
      response.status === 406 ||
      /request blocked|web application firewall|access denied/i.test(response.body.slice(0, 2000));

    if (reflections.length === 0) {
      // Payload may have been fully encoded — check for the encoded canary.
      const encodedCanary = canary.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const encoded = encodedCanary !== canary && response.body.includes(encodedCanary);
      return { reflected: false, reflections: [], encoded, blocked };
    }

    return { reflected: true, reflections, encoded: false, blocked };
  }
}

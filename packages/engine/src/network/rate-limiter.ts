/**
 * Token-bucket rate limiter with optional jitter (stealth profile).
 * Shared by crawler + injector so the whole scan respects one ceiling.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill = Date.now();

  constructor(
    private readonly requestsPerSecond: number,
    private readonly jitterMs = 0,
  ) {
    this.tokens = requestsPerSecond;
  }

  /** Wait until one request slot is available. */
  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.requestsPerSecond, this.tokens + elapsed * this.requestsPerSecond);
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitMs = ((1 - this.tokens) / this.requestsPerSecond) * 1000;
      await sleep(waitMs);
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }

    if (this.jitterMs > 0) {
      await sleep(Math.random() * this.jitterMs);
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

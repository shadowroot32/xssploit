import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../src/network/rate-limiter.js';

describe('RateLimiter', () => {
  it('paces requests at the configured rate', async () => {
    const limiter = new RateLimiter(20); // 20 rps → 50ms per token
    // Burn through the initial burst allowance so pacing kicks in.
    for (let i = 0; i < 20; i++) await limiter.acquire();
    const start = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    expect(Date.now() - start).toBeGreaterThanOrEqual(90);
  });

  it('applies jitter when configured', async () => {
    const limiter = new RateLimiter(100, 40);
    for (let i = 0; i < 100; i++) await limiter.acquire();
    const start = Date.now();
    await limiter.acquire();
    expect(Date.now() - start).toBeGreaterThanOrEqual(5);
  });
});

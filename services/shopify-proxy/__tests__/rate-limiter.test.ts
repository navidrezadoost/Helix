import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../src/services/rate-limiter';

describe('RateLimiter', () => {
  it('allows requests within limits', () => {
    const limiter = new RateLimiter(2, 60000);
    expect(limiter.check('test').allowed).toBe(true);
    expect(limiter.check('test').allowed).toBe(true);
  });

  it('blocks requests exceeding limits', () => {
    const limiter = new RateLimiter(2, 60000);
    limiter.check('test');
    limiter.check('test');
    const result = limiter.check('test');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });
});
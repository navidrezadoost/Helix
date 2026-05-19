interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private store: Map<string, RateLimitRecord> = new Map();
  private readonly requestsPerMinute: number;
  private readonly windowMs: number;
  
  constructor(requestsPerMinute: number = 60, windowMs: number = 60000) {
    this.requestsPerMinute = requestsPerMinute;
    this.windowMs = windowMs;
  }
  
  check(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const record = this.store.get(key);
    
    if (!record || record.resetAt < now) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true };
    }
    
    if (record.count >= this.requestsPerMinute) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return { allowed: false, retryAfter };
    }
    
    record.count++;
    return { allowed: true };
  }
  
  cleanup(intervalMs: number = 60000): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.store.entries()) {
        if (record.resetAt < now) {
          this.store.delete(key);
        }
      }
    }, intervalMs);
  }
}
interface CacheEntry {
  data: any;
  expiresAt: number;
}

export class AsyncCache {
  private sessionCache: Map<string, CacheEntry> = new Map();
  private requestCache: Map<string, Promise<any>> = new Map();

  setSession(key: string, data: any, ttlMs: number = 3600000): void {
    this.sessionCache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  getSession(key: string): any | null {
    const entry = this.sessionCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.sessionCache.delete(key);
      return null;
    }
    return entry.data;
  }

  clearSession(): void {
    this.sessionCache.clear();
  }

  // Request deduplication: returns pending promise or null
  getPendingRequest(key: string): Promise<any> | null {
    return this.requestCache.get(key) || null;
  }

  setPendingRequest(key: string, promise: Promise<any>): void {
    this.requestCache.set(key, promise);
    promise.finally(() => {
      if (this.requestCache.get(key) === promise) {
        this.requestCache.delete(key);
      }
    });
  }

  clear(): void {
    this.sessionCache.clear();
    this.requestCache.clear();
  }
}

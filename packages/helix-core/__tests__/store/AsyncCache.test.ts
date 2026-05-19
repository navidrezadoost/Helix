import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AsyncCache } from '../../src/store/AsyncCache';

describe('AsyncCache', () => {
  let cache: AsyncCache;

  beforeEach(() => {
    cache = new AsyncCache();
  });

  describe('session cache', () => {
    it('should store and retrieve data with TTL', () => {
      const data = { states: ['CA', 'NY', 'TX'] };
      cache.setSession('/api/states?country=US', data, 3600000);
      
      const retrieved = cache.getSession('/api/states?country=US');
      expect(retrieved).toEqual(data);
    });

    it('should return null for expired entries', async () => {
      const data = { states: ['CA', 'NY', 'TX'] };
      // 1ms TTL
      cache.setSession('/api/states?country=US', data, 1);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const retrieved = cache.getSession('/api/states?country=US');
      expect(retrieved).toBeNull();
    });

    it('should return null for non-existent keys', () => {
      const retrieved = cache.getSession('/nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('request deduplication', () => {
    it('should store and retrieve pending promises', () => {
      const promise = Promise.resolve({ data: 'test' });
      cache.setPendingRequest('/api/test', promise);
      
      const retrieved = cache.getPendingRequest('/api/test');
      expect(retrieved).toBe(promise);
    });

    it('should return null for non-existent pending requests', () => {
      const retrieved = cache.getPendingRequest('/nonexistent');
      expect(retrieved).toBeNull();
    });

    it('should auto-clear promise after resolution', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      
      cache.setPendingRequest('/api/test', promise);
      expect(cache.getPendingRequest('/api/test')).toBe(promise);
      
      resolvePromise!({ data: 'test' });
      await promise;
      
      // Small delay for microtask queue
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(cache.getPendingRequest('/api/test')).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear both session cache and pending requests', () => {
      cache.setSession('/api/test', { data: 'test' }, 3600000);
      cache.setPendingRequest('/api/pending', Promise.resolve());
      
      expect(cache.getSession('/api/test')).not.toBeNull();
      expect(cache.getPendingRequest('/api/pending')).not.toBeNull();
      
      cache.clear();
      
      expect(cache.getSession('/api/test')).toBeNull();
      expect(cache.getPendingRequest('/api/pending')).toBeNull();
    });
  });
});

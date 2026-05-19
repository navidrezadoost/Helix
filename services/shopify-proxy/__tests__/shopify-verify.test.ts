import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { verifyShopifyToken } from '../src/middleware/shopify-verify';

type VerifyImplementation = (...args: Parameters<typeof jwt.verify>) => void;

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}));

vi.mock('jwks-rsa', () => {
    return {
        default: vi.fn(() => ({
      getSigningKey: vi.fn((kid: string, cb: (error: Error | null, key: { getPublicKey: () => string }) => void) => cb(null, { getPublicKey: () => 'mock-key' }))
        }))
    }
});

describe('verifyShopifyToken', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('rejects without Authorization header', async () => {
    await verifyShopifyToken(req as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid Authorization header', code: 'UNAUTHORIZED' });
  });

  it('rejects with expired token', async () => {
    req.headers!.authorization = 'Bearer expired-token';
    vi.mocked(jwt.verify).mockImplementation(((...args) => {
      const cb = args[3];
      if (typeof cb === 'function') {
        const err = Object.assign(new Error('jwt expired'), {
          name: 'TokenExpiredError',
          expiredAt: new Date(),
          inner: new Error('expired'),
        }) as unknown as jwt.TokenExpiredError;
        cb(err, undefined);
      }
    }) as VerifyImplementation);

    await verifyShopifyToken(req as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Session token expired', code: 'TOKEN_EXPIRED' });
  });
  
  it('accepts valid token and calls next', async () => {
    req.headers!.authorization = 'Bearer valid-token';
    const mockPayload = { dest: 'https://test-shop.myshopify.com', sub: 'user-123' };
    
    vi.mocked(jwt.verify).mockImplementation(((...args) => {
      const cb = args[3];
      if (typeof cb === 'function') {
        cb(null, mockPayload);
      }
    }) as VerifyImplementation);

    await verifyShopifyToken(req as any, res as any, next);
    expect((req as any).shopifySession).toBeDefined();
    expect((req as any).shopifySession.shopDomain).toBe('test-shop.myshopify.com');
    expect(next).toHaveBeenCalled();
  });
});
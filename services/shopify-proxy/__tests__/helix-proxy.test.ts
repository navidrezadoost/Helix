import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { proxyHelixSubmission } from '../src/controllers/helix-proxy';

const mockApp = express();
mockApp.use(express.json());

// Mock middleware to inject a session
mockApp.post('/test', (req: any, res: any, next: any) => {
  req.shopifySession = { shopDomain: 'test.myshopify.com', userId: '123' };
  next();
}, proxyHelixSubmission as any);

describe('proxyHelixSubmission', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(mockApp)
      .post('/test')
      .send({ schema_id: 'test' });
    
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FIELD');
  });

  it('verifies integrity (valid)', async () => {
    // A proper mock of global fetch
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'success' })
    });
    
    const validBody = {
        schema_id: "product-config-v2",
        schema_hash: "sha256:abc123",
        schema_version: 3,
        submission_id: "test_123",
        timestamp: 1234567890,
        data: { a: 1 },
        meta: {},
        validation: {},
        integrity: {
            algorithm: 'sha256',
            value: 'sha256:49c0d7ad818f99e4ccfcb674b3d75c6dcb199de25dd14d17ecce3d973ff53907'
        }
    };

    const res = await request(mockApp).post('/test').send(validBody);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects invalid integrity', async () => {
    const invalidBody = {
        schema_id: "product-config-v2",
        schema_hash: "sha256:abc123",
        schema_version: 3,
        submission_id: "test_123",
        timestamp: 1234567890,
        data: { a: 1 },
        meta: {},
        validation: {},
        integrity: {
            algorithm: 'sha256',
            value: 'sha256:invalid'
        }
    };

    const res = await request(mockApp).post('/test').send(invalidBody);
    
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INTEGRITY_FAILED');
  });
});
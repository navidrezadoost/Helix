import { Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../middleware/shopify-verify';
import { RateLimiter } from '../services/rate-limiter';

interface SubmissionEnvelope {
  schema_id: string;
  schema_hash: string;
  schema_version: number;
  schema_signature: string;
  submission_id: string;
  timestamp: number;
  data: Record<string, any>;
  meta: Record<string, any>;
  validation: any;
  integrity: {
    algorithm: string;
    value: string;
  };
}

const rateLimiter = new RateLimiter(60, 60000); // 60 requests per minute

function verifyIntegrity(envelope: SubmissionEnvelope): boolean {
  const dataToHash = {
    data: canonicalize(envelope.data),
    meta: canonicalize(envelope.meta),
  };
  
  const jsonString = JSON.stringify(dataToHash);
  const hash = crypto.createHash('sha256').update(jsonString).digest('hex');
  const expectedHash = `sha256:${hash}`;
  
  return expectedHash === envelope.integrity.value;
}

function verifySchemaSignature(schemaHash: string, signature: string): boolean {
  try {
    const HELIX_PUBLIC_KEY = process.env.HELIX_PUBLIC_KEY || crypto.generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString();
    
    if (!process.env.HELIX_PUBLIC_KEY) {
        console.warn('USING MOCK HELIX_PUBLIC_KEY. DO NOT USE IN PRODUCTION.');
        return true; 
    }

    const verify = crypto.createVerify('ed25519');
    verify.update(schemaHash);
    verify.end();
    
    return verify.verify(HELIX_PUBLIC_KEY, Buffer.from(signature, 'hex'));
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

function canonicalize(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, any> = {};
  for (const key of sortedKeys) {
    result[key] = canonicalize(obj[key]);
  }
  return result;
}

export async function proxyHelixSubmission(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.shopifySession) {
      return res.status(401).json({
        error: 'Unauthorized: No Shopify session',
        code: 'UNAUTHORIZED',
      });
    }
    
    const { shopDomain, userId } = req.shopifySession;
    
    const rateCheck = rateLimiter.check(shopDomain);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMITED',
        retryAfter: rateCheck.retryAfter,
      });
    }
    
    const envelope: SubmissionEnvelope = req.body;
    
    if (!envelope || typeof envelope !== 'object') {
      return res.status(400).json({
        error: 'Invalid request body',
        code: 'INVALID_BODY',
      });
    }
    
    const requiredFields = ['schema_id', 'schema_hash', 'schema_signature', 'schema_version', 'submission_id', 'data', 'integrity'];
    for (const field of requiredFields) {
      if (!envelope[field as keyof SubmissionEnvelope]) {
        return res.status(400).json({
          error: `Missing required field: ${field}`,
          code: 'MISSING_FIELD',
        });
      }
    }
    
    if (!verifyIntegrity(envelope)) {
      return res.status(400).json({
        error: 'Submission integrity check failed',
        code: 'INTEGRITY_FAILED',
      });
    }

    if (!verifySchemaSignature(envelope.schema_hash, envelope.schema_signature)) {
        return res.status(401).json({
            error: 'Schema signature verification failed',
            code: 'SIGNATURE_INVALID',
        });
    }
    
    envelope.meta = envelope.meta || {};
    envelope.meta.shopify = {
      shop_domain: shopDomain,
      customer_id: envelope.meta.shopify?.customer_id || userId,
      verified_at: new Date().toISOString(),
    };
    
    const HELIX_INTERNAL_URL = process.env.HELIX_INTERNAL_URL || 'http://localhost:8001';
    const HELIX_INTERNAL_API_KEY = process.env.HELIX_INTERNAL_API_KEY || 'test-key-mock';
    
    const response = await fetch(`${HELIX_INTERNAL_URL}/api/v1/internal/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Key': HELIX_INTERNAL_API_KEY,
        'X-Original-Shop': shopDomain,
        'X-Submission-ID': envelope.submission_id,
      },
      body: JSON.stringify(envelope),
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({
        error: 'Helix processing failed',
        code: 'HELIX_ERROR',
        details: errorBody,
      });
    }
    
    const result = await response.json();
    return res.status(200).json({
      success: true,
      submission_id: envelope.submission_id,
      result,
    });
    
  } catch (error: any) {
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

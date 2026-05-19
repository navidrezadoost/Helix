import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

interface ShopifySessionPayload {
  iss: string;
  dest: string;
  aud: string;
  sub: string;
  exp: number;
  nbf: number;
  iat: number;
  jti: string;
  sid: string;
}

export interface AuthenticatedRequest extends Request {
  shopifySession?: {
    payload: ShopifySessionPayload;
    shopDomain: string;
    userId: string;
  };
}

// JWKS client for Shopify public keys (cached)
export const client = jwksClient({
  jwksUri: 'https://accounts.shopify.com/.well-known/jwks.json',
  cache: true,
  cacheMaxEntries: 100,
  cacheMaxAge: 3600000, // 1 hour
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

export function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export async function verifyShopifyToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // 1. Extract Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing or invalid Authorization header',
        code: 'UNAUTHORIZED',
      });
    }

    const token = authHeader.substring(7);

    // 2. Verify JWT with Shopify's public keys
    const payload = await new Promise<ShopifySessionPayload>((resolve, reject) => {
      jwt.verify(token, getKey, {
        algorithms: ['RS256'],
      }, (err: jwt.VerifyErrors | null, decoded: string | jwt.JwtPayload | undefined) => {
        if (err) reject(err);
        else resolve(decoded as ShopifySessionPayload);
      });
    });

    const issuer = payload.iss ?? '';
    if (!/^https:\/\/[a-zA-Z0-9\-]+\.myshopify\.com\/admin$/.test(issuer)) {
      throw new jwt.JsonWebTokenError('Invalid issuer');
    }

    // 3. Extract shop domain from 'dest' or 'iss'
    let shopDomain: string;
    if (payload.dest) {
      shopDomain = new URL(payload.dest).hostname;
    } else if (payload.iss) {
      shopDomain = new URL(payload.iss).hostname;
    } else {
      throw new Error('Cannot determine shop domain from token');
    }

    // 4. Attach verified session to request
    req.shopifySession = {
      payload,
      shopDomain,
      userId: payload.sub,
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Session token expired',
        code: 'TOKEN_EXPIRED',
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid session token',
        code: 'INVALID_TOKEN',
      });
    }
    
    return res.status(500).json({
      error: 'Token verification failed',
      code: 'VERIFICATION_ERROR',
    });
  }
}
# Security & Trust Chain

## Cryptographic Verification

Helix implements a **zero-trust, end-to-end verified** architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRUST CHAIN                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Schema Signing (Ed25519)                                     │
│     └── Schema hash signed with private key during publish      │
│                                                                  │
│  2. Client-Side Integrity (SHA256)                              │
│     └── Submission envelope hashed with canonical JSON          │
│                                                                  │
│  3. Shopify JWT (RS256)                                         │
│     └── Session token verified against Shopify JWKS             │
│                                                                  │
│  4. Internal API Key (X-Internal-API-Key)                       │
│     └── Laravel endpoint protected by shared secret             │
│                                                                  │
│  5. Server-Side Re-validation                                   │
│     └── All relational rules re-evaluated (no trust in client) │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Ed25519 Key Management

### Generate Keys (Production)

```bash
openssl genpkey -algorithm ed25519 -out helix_private.pem
openssl pkey -in helix_private.pem -pubout -out helix_public.pem
```

### Sign Schema (During Publish)

```php
use Sodium;

$signature = sodium_crypto_sign_detached(
  $schemaHash, 
  sodium_base642bin($privateKey, SODIUM_BASE64_VARIANT_ORIGINAL)
);
```

### Verify Signature (Node.js Proxy)

```typescript
const verify = crypto.createVerify('ed25519');
verify.update(envelope.schema_hash);
verify.end();
const isValid = verify.verify(publicKey, Buffer.from(signature, 'hex'));
```

## Security Checklist

- [ ] `HELIX_PUBLIC_KEY` set in production (no mock fallback)
- [ ] `HELIX_INTERNAL_API_KEY` stored in secrets manager
- [ ] Ed25519 private key never committed to repository
- [ ] All submissions re-validated server-side
- [ ] Rate limiting enabled (60 req/min per shop)

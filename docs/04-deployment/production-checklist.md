# Production Deployment Checklist

## Pre-Deployment Verification

### Database
- [ ] PostgreSQL 15+ installed with JSONB support
- [ ] Partitions created for next 6 months (`php artisan helix:create-partitions --months=6`)
- [ ] GIN indexes on `compiled_graph` and `data` columns
- [ ] Unique constraint on `submission_id` across partitions
- [ ] Row-level security (RLS) enabled for multi-tenancy

### Security
- [ ] `HELIX_PUBLIC_KEY` set in environment (no mock fallback)
- [ ] `HELIX_INTERNAL_API_KEY` stored in secrets manager (AWS Secrets Manager / Vault)
- [ ] Ed25519 private key never in repository
- [ ] HTTPS enforced (SSL/TLS certificates installed)
- [ ] CORS configured for allowed origins only

### Application
- [ ] All migrations run (`php artisan migrate --force`)
- [ ] Queue worker configured (`php artisan queue:work`)
- [ ] Horizon/Supervisor process manager installed
- [ ] Health check endpoint responding (`/health`)
- [ ] Logging configured (structured JSON logs)

### Performance
- [ ] Redis configured for queue and rate limiting
- [ ] OPcache enabled for PHP
- [ ] Browser caching headers configured for CDN assets
- [ ] Benchmark suite passed (`npm run bench`)

### Monitoring
- [ ] Prometheus metrics endpoint secured
- [ ] Alerts configured:
  - Submission failure rate > 5%
  - Signature verification failures > 0 (critical)
  - Queue size > 1000
  - API latency p99 > 500ms

## Go-Live Command Sequence

```bash
# 1. Deploy database migrations
php artisan migrate --force

# 2. Create partitions
php artisan helix:create-partitions --months=6

# 3. Clear caches
php artisan optimize:clear

# 4. Start queue workers
php artisan queue:work --daemon

# 5. Start Node.js proxy
cd services/shopify-proxy && npm start

# 6. Verify health
curl https://helix.yourdomain.com/health
# Expected: {"status":"ok","database":"connected"}

# 7. Run smoke test
./scripts/smoke-test.sh
```

## Rollback Plan

```bash
# Database rollback
php artisan migrate:rollback --step=1

# Code rollback
git checkout previous-tag
npm run build

# Cache clear
php artisan optimize:clear
```

## Post-Deployment Validation

- [ ] Submit test form via API
- [ ] Verify submission appears in correct partition
- [ ] Check webhook delivery to n8n
- [ ] Monitor error logs for 30 minutes
- [ ] Validate prefetching works (browser DevTools network tab)

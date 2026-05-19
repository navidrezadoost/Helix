# Troubleshooting Guide

## Common Errors & Solutions

### "Schema hash mismatch"

**Error:** `SCHEMA_HASH_MISMATCH` during submission

**Cause:** Client schema version doesn't match server

**Solution:**
```bash
# Clear client cache
localStorage.clear()

# Update schema version in form attributes
form.setAttribute('schema-version', 'latest-version')
```

### "Signature verification failed"

**Error:** `SIGNATURE_INVALID` from Node.js proxy

**Cause:** Ed25519 public key mismatch or unsigned schema

**Solution:**
```bash
# Regenerate keys
openssl genpkey -algorithm ed25519 -out helix_private.pem
openssl pkey -in helix_private.pem -pubout -out helix_public.pem

# Re-publish schema with new signature
php artisan helix:publish --schema-id=my-form --sign
```

### Async select not loading options

**Symptoms:** Spinner never disappears or empty dropdown

**Debug steps:**
1. Check browser DevTools Network tab for API calls
2. Verify URL interpolation: `/api/states?country={{country}}`
3. Test API endpoint directly with curl
4. Check CORS headers on API response

**Fix:** Enable CORS on your API:
```nginx
add_header 'Access-Control-Allow-Origin' 'https://helix.yourdomain.com';
```

### Memory leak in long-running forms

**Symptoms:** Browser tab slows down after 50+ submissions

**Fix:** Destroy store on unmount
```javascript
// React
useEffect(() => {
  return () => store?.destroy();
}, []);

// Web Component (auto-handled, but verify)
form.remove(); // Triggers disconnectedCallback
```

### Rate limiting too aggressive

**Error:** `RATE_LIMITED` (429)

**Adjust limits:**
```bash
# Node.js proxy
RATE_LIMIT_REQUESTS=120  # Default: 60
RATE_LIMIT_WINDOW_MS=60000
```

### Partition not found

**Error:** `relation "submissions_y2026m05" does not exist`

**Fix:** Create missing partition
```sql
CREATE TABLE submissions_y2026m05 PARTITION OF submissions
FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
```

## Logging & Debugging

### Enable debug mode

```bash
# Node.js proxy
DEBUG=helix:* npm start

# Laravel
APP_DEBUG=true php artisan serve

# React SDK
localStorage.setItem('helix-debug', 'true');
```

### View logs

```bash
# Node.js
tail -f logs/helix-proxy.log

# Laravel
tail -f storage/logs/laravel.log

# PostgreSQL
tail -f /var/log/postgresql/postgresql.log
```

## Support Matrix

| Issue | Contact |
|-------|---------|
| Schema validation | `#helix-schema` on Slack |
| Performance | `#helix-performance` |
| Security | `security@helix.com` |
| General | `github.com/helix/issues` |

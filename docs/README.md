# Helix Dynamic Form Builder

**Version:** 1.0.0  
**Status:** Production Ready  
**Architecture:** I/O Neutral Reactive Form Engine

---

## What is Helix?

Helix is a **high-performance, declarative dynamic form engine** that transforms web forms into reactive, rule-driven systems using `data-*` attributes and JSON schemas.

### Core Principles

| Principle | Description |
|-----------|-------------|
| **I/O Neutral** | Same runtime works on React, Web Components, Shopify, WordPress |
| **DAG-Based** | Topological execution ensures deterministic rule evaluation |
| **Two-Phase Async** | Synchronous rules + deferred async actions with prefetching |
| **Cryptographic Trust** | Ed25519 signatures + JWT + SHA256 integrity |

### Quick Start (30 seconds)

```html
<!-- Web Component -->
<helix-form 
  schema-id="address-form" 
  endpoint="https://api.helix.com"
></helix-form>

<script type="module">
  import 'https://cdn.helix.com/webcomponents.js';
</script>
```

```tsx
// React SDK
import { HelixForm } from '@helix/react';

function App() {
  return (
    <HelixForm 
      schemaId="address-form" 
      endpoint="https://api.helix.com"
      shopifyAuth={true}
    />
  );
}
```

---

## Documentation Navigation

| Section | Description |
|---------|-------------|
| [Architecture](./01-architecture/overview.md) | DAG execution, async prefetch, security |
| [Integration](./02-integration/react-sdk.md) | React, Web Components, Shopify guides |
| [API Reference](./03-api/schema-format.md) | JSON schema, submission envelopes |
| [Deployment](./04-deployment/production-checklist.md) | Docker, environment, monitoring |
| [Testing](./05-testing/unit-tests.md) | Running benchmarks & test suites |
| [FAQ](./06-faq/troubleshooting.md) | Common issues & solutions |

---

## System Requirements

| Component | Version |
|-----------|---------|
| PHP | 8.2+ |
| PostgreSQL | 15+ (with JSONB support) |
| Node.js | 20+ |
| React | 18+ (for SDK) |
| Shopify | App Bridge 2.0+ (optional) |

---

## License

MIT © Helix Contributors

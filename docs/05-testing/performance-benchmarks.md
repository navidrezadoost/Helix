# Performance Benchmarking Guide

## Running Benchmarks

```bash
cd packages/helix-benchmark
npm install
npm run bench
```

## Interpreting Results

### Key Metrics

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Render time (50 fields) | < 100ms | 200ms |
| Field change propagation | < 16ms | 32ms |
| Cascade completion | < 400ms | 800ms |
| Submission envelope extraction | < 5ms | 10ms |
| Memory per field | < 1KB | 2KB |

### Benchmark Output Example

```
📊 medium-cascade (Country → States → Cities)
   ├── React render: 85ms ✅
   ├── Web Component render: 62ms ✅
   ├── Without prefetch: 450ms ❌
   ├── With prefetch: 180ms ✅
   └── Memory footprint: React 2.4MB | WC 1.8MB

✨ Prefetch Optimization Summary:
   - Latency reduction: 60% ✅
   - Perceived UX: "Instant" cascade
```

## CI/CD Integration

```yaml
# .github/workflows/benchmark.yml
name: Performance Benchmark

on:
  pull_request:
    branches: [main]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci && npm run build
      - run: npm run bench --workspace=@helix/benchmark
      - name: Check performance regression
        run: |
          if grep -q "❌" benchmark-report.md; then
            echo "Performance regression detected!"
            exit 1
          fi
```

## Custom Benchmark Scenarios

Create `custom-scenarios.json`:

```json
[
  {
    "name": "my-form",
    "fieldCount": 25,
    "ruleCount": 10,
    "asyncFields": 3,
    "dependencyDepth": 2
  }
]
```

Run with:

```bash
npm run bench -- --scenarios=custom-scenarios.json
```

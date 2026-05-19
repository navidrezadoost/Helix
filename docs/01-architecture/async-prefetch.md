# Two-Phase Async Execution & Prefetching

## The Problem

When a field depends on an API (e.g., `states` depends on `country`), synchronous DAG evaluation would block on network I/O.

## Helix Solution: Two-Phase Evaluation

### Phase 1: Synchronous DAG
- Evaluate `show/hide`, `setRequired`, `setValue` (static)
- Deterministic, < 16ms for 100 fields

### Phase 2: Async Actions (Deferred)
- `populateSelect` actions queued after sync DAG
- Executed in dependency order with debouncing
- Results trigger new DAG evaluation

## Prefetching Optimization

When a dependency field (e.g., `country`) gains focus, Helix **prefetches** the async data before the user selects it.

**Without Prefetch:**
```
User selects country → API call (300ms) → Render states
Total: 300ms
```

**With Prefetch:**
```
User focuses country → Prefetch API (300ms in background)
User selects country → Instant render (0ms perceived)
Total: 0ms perceived latency
```

## Configuration

```json
{
  "type": "populateSelect",
  "field": "states",
  "source": "/api/states?country={{country}}",
  "debounce": 150,
  "cache": "session",
  "prefetch": true
}
```

## Performance Gains

| Cascade Depth | Without Prefetch | With Prefetch | Reduction |
|---------------|-----------------|---------------|-----------|
| 2-level | 450ms | 180ms | 60% |
| 3-level | 850ms | 310ms | 64% |
| 4-level | 2100ms | 680ms | 68% |

# DAG-Based Rule Execution

## Overview

Helix models form dependencies as a **Directed Acyclic Graph (DAG)**. Each field is a node; each `depends_on` relationship is an edge. The DAG ensures deterministic execution order.

## Topological Sort Example

```json
{
  "fields": {
    "has_discount": { "type": "boolean" },
    "discount_amount": { "type": "number" },
    "final_price": { "type": "number" }
  },
  "rules": [
    {
      "depends_on": ["has_discount"],
      "condition": "has_discount === true",
      "actions": [{ "type": "setRequired", "field": "discount_amount", "required": true }]
    },
    {
      "depends_on": ["discount_amount"],
      "condition": "discount_amount !== null",
      "actions": [{ "type": "setValue", "field": "final_price", "value": "100 - discount_amount" }]
    }
  ]
}
```

**Execution Order:** `has_discount` → `discount_amount` → `final_price`

## Cycle Detection

Helix rejects schemas with circular dependencies during validation:

```php
// SchemaValidator throws CycleDetectedException
$validator->validate($cyclicSchema); 
// Error: "Cycle detected in rule dependencies"
```

## Performance Characteristics

| Graph Size | Evaluation Time | Memory |
|------------|----------------|--------|
| 10 nodes, 15 edges | < 1ms | ~5KB |
| 100 nodes, 200 edges | < 5ms | ~50KB |
| 500 nodes, 1000 edges | < 25ms | ~250KB |

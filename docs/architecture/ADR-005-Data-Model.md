# ADR-005: High-Performance Data Model & Storage

**Status:** Accepted
**Date:** 2026-05-13

**Context:** 
We need a robust storage strategy for the Schema Registry and Form Submissions that prevents I/O bottlenecks and scales to thousands of concurrent complex forms. 

**Decision:**
1. **PostgreSQL JSONB + GIN Indexes**: All dynamic form configurations and submissions are stored as JSONB to allow deep indexing and native querying.
2. **DAG Pre-computation**: Topologically sorted dependency maps (`dag_evaluation_order`) are pre-calculated upon schema save and stored natively to bypass runtime Graph traversal.
3. **Partitioning**: Submissions and Audit Trails will be partitioned by `created_at`.
4. **Multi-Tenancy**: A strict `tenant_id` namespace is enforced at the database layer.

**Consequences:**
- O(1) reads for schema execution order.
- Highly scalable, but requires strong migrations and potentially complex JSON querying syntax for standard analytics.

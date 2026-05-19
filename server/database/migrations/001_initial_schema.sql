-- Phase 0: Task 0.1 - Database Schema & Partitioning
-- Execution Order: Initial Migrations

-- 1. Tenants Table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Schemas Table
CREATE TABLE schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    schema_id VARCHAR(255) NOT NULL,
    version INT NOT NULL,
    dag_hash VARCHAR(64) NOT NULL,
    dag_evaluation_order JSONB NOT NULL,
    compiled_graph JSONB NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (tenant_id, schema_id, version)
);

-- GIN index for native JSON querying inside compiled_graph
CREATE INDEX idx_schemas_compiled_graph ON schemas USING GIN (compiled_graph);

-- 3. Submissions Table (Partitioned by RANGE on created_at)
-- Note: UUID primary keys conflict with partition keys unless the partition key is included in the PK.
-- We use a compound primary key (id, created_at) to satisfy PostgreSQL partitioning requirements.
CREATE TABLE submissions (
    id UUID DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    schema_id VARCHAR(255) NOT NULL,
    schema_version INT NOT NULL,
    submission_id VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    integrity_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, created_at),
    UNIQUE (submission_id, created_at)
) PARTITION BY RANGE (created_at);

-- GIN index on submission data for high-performance querying
CREATE INDEX idx_submissions_data ON submissions USING GIN (data);

-- B-Tree index for quick submission_id lookups
CREATE INDEX idx_submissions_lookup ON submissions (submission_id);

-- Create initial monthly partition (Current month: May 2026)
CREATE TABLE submissions_y2026m05 PARTITION OF submissions 
    FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');

-- Create next monthly partition (June 2026)
CREATE TABLE submissions_y2026m06 PARTITION OF submissions 
    FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

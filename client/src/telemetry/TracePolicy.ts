export interface TraceRetentionPolicy {
    maxTraces: number;
    maxEventsPerTrace: number;
    maxTraceDurationMs: number;
    evictionStrategy: 'fifo' | 'lru';
}

export const DefaultRuntimeTracePolicy: TraceRetentionPolicy = {
    maxTraces: 50,
    maxEventsPerTrace: 10000,
    maxTraceDurationMs: 10000, // Drop traces running longer than 10s
    evictionStrategy: 'fifo'
};

export const DefaultAuditTracePolicy: TraceRetentionPolicy = {
    // Audit traces are typically synced to storage, bounded mostly for memory protection during failures
    maxTraces: 1000,
    maxEventsPerTrace: 50000, 
    maxTraceDurationMs: 60000,
    evictionStrategy: 'fifo'
};

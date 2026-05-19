export enum TraceLevel {
    NONE = 0,
    ERRORS = 1,
    BASIC = 2,
    DETAILED = 3,
    FULL = 4
}

export enum TraceEventType {
    FIELD_MUTATION = 'FIELD_MUTATION',
    NODE_INVALIDATED = 'NODE_INVALIDATED',
    NODE_ENQUEUED = 'NODE_ENQUEUED',
    NODE_EVALUATED = 'NODE_EVALUATED',
    EFFECT_PRODUCED = 'EFFECT_PRODUCED',
    EFFECT_COMMITTED = 'EFFECT_COMMITTED',
    NOTIFICATION_SENT = 'NOTIFICATION_SENT',
    EVALUATION_SKIPPED = 'EVALUATION_SKIPPED',
    PROPAGATION_COMPLETE = 'PROPAGATION_COMPLETE'
}

export interface TraceEvent {
    id: string;             // Unique identifier for the event
    sequence: number;       // Monotonic sequence number within the trace
    timestamp: number;      // High-resolution timestamp
    type: TraceEventType;   // Semantic type
    nodeId?: string;        // Node ID context
    causedBy?: string;      // ID of the event that caused this one (Causal Link)
    payload?: any;          // Additional structured data (oldValue, newValue, specific effects)
}

export interface TraceMetrics {
    totalNodesVisited: number;
    totalEvaluations: number;
    totalEffectsCommitted: number;
    maxPropagationDepth: number;
    executionDurationMs: number;
}

export interface ExecutionTrace {
    traceId: string;
    sessionId?: string; // Links multiple traces to one user action, lifecycle or deployment
    startedAt: number;
    endedAt: number;
    trigger?: TraceEvent;
    events: TraceEvent[];
    metrics: TraceMetrics;
}

import { TraceEvent, ExecutionTrace, TraceEventType, TraceLevel, TraceMetrics } from './TraceIR';
import { RingBuffer } from './RingBuffer';
import { TraceRetentionPolicy, DefaultRuntimeTracePolicy } from './TracePolicy';
import { GlobalTraceExporter } from './TraceExporter';

export class TraceCollector {
    private level: TraceLevel = TraceLevel.DETAILED;
    private policy: TraceRetentionPolicy;
    private currentTrace: ExecutionTrace | null = null;
    private sequence: number = 0;
    
    // A bounded ring buffer replacing the unbounded array, preventing memory leaks
    private completedTraces: RingBuffer<ExecutionTrace>;

    // Global session to correlate subsequent traces
    private currentSessionId: string | undefined;

    constructor(policy: TraceRetentionPolicy = DefaultRuntimeTracePolicy) {
        this.policy = policy;
        this.completedTraces = new RingBuffer<ExecutionTrace>(policy.maxTraces);
    }

    public setLevel(level: TraceLevel) {
        this.level = level;
    }

    public setPolicy(policy: TraceRetentionPolicy) {
        this.policy = policy;
        // Re-initialize buffer if capacity changed
        const newBuffer = new RingBuffer<ExecutionTrace>(policy.maxTraces);
        for (const t of this.completedTraces.toArray()) newBuffer.push(t);
        this.completedTraces = newBuffer;
    }

    public startSession(sessionId: string) {
        this.currentSessionId = sessionId;
    }

    public endSession() {
        this.currentSessionId = undefined;
    }

    public beginTrace(triggerNodeId: string, payload?: any): string | null {
        if (this.level === TraceLevel.NONE) return null;

        const traceId = 'trace_' + Math.random().toString(36).substr(2, 9);
        this.sequence = 0;

        const triggerEvent = this.createEvent(TraceEventType.FIELD_MUTATION, triggerNodeId, undefined, payload);

        this.currentTrace = {
            traceId,
            sessionId: this.currentSessionId,
            startedAt: performance.now(),
            endedAt: 0,
            trigger: triggerEvent,
            events: [triggerEvent],
            metrics: {
                totalNodesVisited: 0,
                totalEvaluations: 0,
                totalEffectsCommitted: 0,
                maxPropagationDepth: 0,
                executionDurationMs: 0
            }
        };

        return triggerEvent.id;
    }

    public recordEvent(
        type: TraceEventType, 
        nodeId?: string, 
        causedBy?: string, 
        payload?: any
    ): string | null {
        // Evaluate Trace Policy restrictions
        if (this.level === TraceLevel.NONE || !this.currentTrace) return null;
        if (this.currentTrace.events.length >= this.policy.maxEventsPerTrace) {
            // Drop excessive events to protect memory boundaries
            return null;
        }

        const event = this.createEvent(type, nodeId, causedBy, payload);
        this.currentTrace.events.push(event);

        // Update active metrics dynamically
        this.updateMetrics(type);

        return event.id;
    }

    public endTrace(causedBy?: string): ExecutionTrace | null {
        if (!this.currentTrace) return null;

        this.recordEvent(TraceEventType.PROPAGATION_COMPLETE, undefined, causedBy);

        this.currentTrace.endedAt = performance.now();
        this.currentTrace.metrics.executionDurationMs = this.currentTrace.endedAt - this.currentTrace.startedAt;

        const finalizedTrace = this.currentTrace;
        this.currentTrace = null;

        // Retention Policy: Discard aberrant long running traces (likely hung states missing cleanup)
        if (finalizedTrace.metrics.executionDurationMs > this.policy.maxTraceDurationMs) {
            console.warn(`[TraceCollector] Trace ${finalizedTrace.traceId} exceeded maximum duration constraints and was discarded.`);
            return null;
        }

        // Push Trace to bounded ring buffer synchronously.
        this.completedTraces.push(finalizedTrace);
        
        // Asynchronously dispatch to export sinks (Performance Isolation)
        GlobalTraceExporter.dispatchFinishedTrace(finalizedTrace);

        return finalizedTrace;
    }

    private createEvent(type: TraceEventType, nodeId?: string, causedBy?: string, payload?: any): TraceEvent {
        return {
            id: 'evt_' + Math.random().toString(36).substr(2, 9),
            sequence: ++this.sequence,
            timestamp: performance.now(),
            type,
            nodeId,
            causedBy,
            payload
        };
    }

    private updateMetrics(type: TraceEventType) {
        if (!this.currentTrace) return;
        const metrics = this.currentTrace.metrics;

        switch (type) {
            case TraceEventType.NODE_INVALIDATED:
                metrics.totalNodesVisited++;
                break;
            case TraceEventType.NODE_EVALUATED:
                metrics.totalEvaluations++;
                break;
            case TraceEventType.EFFECT_COMMITTED:
                metrics.totalEffectsCommitted++;
                break;
        }
    }
    
    public getCompletedTraces(): ExecutionTrace[] {
        return this.completedTraces.toArray();
    }

    // Useful for debugging in tests or development mode
    public getLastTrace(): ExecutionTrace | null {
        const traces = this.completedTraces.toArray();
        return traces.length > 0 ? traces[traces.length - 1] : null;
    }
}

// Global Singleton configured safely for runtime boundaries
export const TraceCollectorInstance = new TraceCollector();

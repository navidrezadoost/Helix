import { ExecutionTrace, TraceEvent } from './TraceIR';

export class TraceSerializer {
    
    /**
     * Serializes an ExecutionTrace into a deterministic JSON string.
     * Guaranteed to produce identical output for identical traces regardless of JavaScript engine iteration order.
     */
    public static serialize(trace: ExecutionTrace): string {
        const canonicalTrace = this.canonicalizeTrace(trace);
        return JSON.stringify(canonicalTrace, null, 2);
    }

    /**
     * Deserializes a stable JSON string back into an ExecutionTrace.
     */
    public static deserialize(json: string): ExecutionTrace {
        const parsed = JSON.parse(json);
        // Simple validation could go here
        return parsed as ExecutionTrace;
    }

    /**
     * Creates a structurally sorted and sanitized clone of the trace.
     */
    private static canonicalizeTrace(trace: ExecutionTrace): ExecutionTrace {
        // Enforce deterministic event ordering based on sequence
        const sortedEvents = [...trace.events].sort((a, b) => a.sequence - b.sequence);

        return {
            traceId: trace.traceId,
            sessionId: trace.sessionId || 'default',
            startedAt: trace.startedAt,
            endedAt: trace.endedAt,
            metrics: this.sortObject(trace.metrics),
            trigger: trace.trigger ? this.canonicalizeEvent(trace.trigger) : undefined,
            events: sortedEvents.map(e => this.canonicalizeEvent(e))
        } as ExecutionTrace;
    }

    /**
     * Returns a new event with keys exactly ordered and pure-data values.
     */
    private static canonicalizeEvent(event: TraceEvent): TraceEvent {
        return this.sortObject({
            id: event.id,
            sequence: event.sequence,
            timestamp: event.timestamp,
            type: event.type,
            nodeId: event.nodeId,
            causedBy: event.causedBy,
            payload: event.payload ? this.sanitizePayload(event.payload) : undefined
        }) as TraceEvent;
    }

    /**
     * Recursively sort object keys for deterministic serialization.
     * Prevents differences in V8 Map/Object layout from breaking determinism.
     */
    private static sortObject(obj: any): any {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.sortObject(item));
        }

        const sortedKeys = Object.keys(obj).sort();
        const result: Record<string, any> = {};
        for (const key of sortedKeys) {
            const val = obj[key];
            if (val !== undefined) {
                result[key] = this.sortObject(val);
            }
        }
        return result;
    }

    /**
     * Strips anything that isn't simple JSON data (e.g. DOM elements, functions)
     */
    private static sanitizePayload(payload: any): any {
        try {
            // Very blunt pure-data enforcement + breaks cycles
            // In a highly optimized system, we'd traverse and drop functions manually rather than double-parse.
            const stringified = JSON.stringify(payload, (key, value) => {
                if (typeof value === 'function') return undefined; // Drop functions
                if (typeof value === 'symbol') return undefined; // Drop symbols
                // Note: Cyclic refs throw during stringify, could be caught and replaced with "[Circular]" if needed.
                return value;
            });
            if (!stringified) return undefined;
            return JSON.parse(stringified);
        } catch (e) {
            return { $error: "Payload serialization failed (cycle or non-serializable type)" };
        }
    }
}

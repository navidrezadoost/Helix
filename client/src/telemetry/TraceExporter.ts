import { ExecutionTrace } from './TraceIR';
import { TraceSerializer } from './TraceSerializer';

export interface TraceSink {
    name: string;
    export(trace: ExecutionTrace, serialized: string): void | Promise<void>;
}

export class ConsoleTraceSink implements TraceSink {
    name = 'ConsoleSink';
    export(trace: ExecutionTrace, serialized: string) {
        // Output clean profiling summaries to the console
        console.group(`[Trace: ${trace.traceId}] Execution Complete (${trace.metrics.executionDurationMs.toFixed(2)}ms)`);
        console.log(`Events: ${trace.events.length}`);
        console.log(`Metrics:`, trace.metrics);
        // Using JSON.parse to allow standard browser object expansion interactively in DevTools
        console.log(`Payload:`, JSON.parse(serialized));
        console.groupEnd();
    }
}

export class TraceExporter {
    private sinks: TraceSink[] = [];
    
    public addSink(sink: TraceSink) {
        this.sinks.push(sink);
    }

    public removeSink(name: string) {
        this.sinks = this.sinks.filter(s => s.name !== name);
    }

    public clearSinks() {
        this.sinks = [];
    }

    /**
     * Dispatches trace export asynchronously to preserve performance isolation.
     * Guaranteed not to block the synchronous reactive propagation cycle.
     */
    public dispatchFinishedTrace(trace: ExecutionTrace) {
        if (this.sinks.length === 0) return;

        // microtask batching ensuring tracing is observationally pure
        queueMicrotask(() => {
            try {
                // Perform expensive serialization outside the reactive critical path
                const serialized = TraceSerializer.serialize(trace);
                for (const sink of this.sinks) {
                    try {
                        sink.export(trace, serialized);
                    } catch (e) {
                        console.error(`[TraceExporter] Sink ${sink.name} failed:`, e);
                    }
                }
            } catch (serializeError) {
                console.error('[TraceExporter] Serialization failed', serializeError);
            }
        });
    }
}

// Global Singleton for the Runtime
export const GlobalTraceExporter = new TraceExporter();

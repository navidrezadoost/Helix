import { ExecutionTrace, TraceEvent } from './TraceIR';

export interface ReplayFrame {
    description: string;
    expectedEvents: Partial<TraceEvent>[]; // Stripped of non-deterministic ids/timestamps
    expectedMetrics?: Partial<Record<string, number>>;
}

export class ReplayValidator {
    /**
     * Consumes an actual execution trace and affirms it perfectly matches the expected logical behavior,
     * proving runtime causality reproducibility.
     */
    public static validateCausality(actualTrace: ExecutionTrace, frame: ReplayFrame): void {
        const expectedEvents = frame.expectedEvents;

        if (actualTrace.events.length !== expectedEvents.length) {
            this.throwDivergence(
                `Trace length mismatch: Expected ${expectedEvents.length} events, got ${actualTrace.events.length}.`,
                actualTrace,
                frame
            );
        }

        // 1. Verify Event Sequence, Evaluation Order, and Effects deterministically
        for (let i = 0; i < expectedEvents.length; i++) {
            const expected = expectedEvents[i];
            const actual = actualTrace.events[i];

            if (expected.type && expected.type !== actual.type) {
                this.throwDivergence(`Event [${i}] type mismatch: Expected ${expected.type}, got ${actual.type}.`, actualTrace, frame, i);
            }

            if (expected.nodeId && expected.nodeId !== actual.nodeId) {
                this.throwDivergence(`Event [${i}] nodeId mismatch: Expected ${expected.nodeId}, got ${actual.nodeId}.`, actualTrace, frame, i);
            }

            if (expected.sequence !== undefined && expected.sequence !== actual.sequence) {
                this.throwDivergence(`Event [${i}] sequence mismatch: Expected ${expected.sequence}, got ${actual.sequence}.`, actualTrace, frame, i);
            }

            if (expected.payload !== undefined) {
                const expectedPayload = JSON.stringify(expected.payload);
                const actualPayload = JSON.stringify(actual.payload || {});
                if (expectedPayload !== actualPayload) {
                    this.throwDivergence(`Event [${i}] payload structural mismatch. Expected ${expectedPayload}, got ${actualPayload}.`, actualTrace, frame, i);
                }
            }
        }

        // 2. Verify Output Metrics (Performance Isolation side-effects)
        if (frame.expectedMetrics) {
            for (const [key, expectedValue] of Object.entries(frame.expectedMetrics)) {
                const actualValue = (actualTrace.metrics as any)[key];
                if (actualValue !== expectedValue) {
                    this.throwDivergence(`Metric mismatch [${key}]. Expected ${expectedValue}, got ${actualValue}.`, actualTrace, frame);
                }
            }
        }
    }

    private static throwDivergence(reason: string, trace: ExecutionTrace, frame: ReplayFrame, eventIndex?: number): never {
        console.group(`[ReplayValidator] Causal Divergence Detected`);
        console.error(`Reason: ${reason}`);
        if (eventIndex !== undefined) {
            console.error(`Expected Event:`, frame.expectedEvents[eventIndex]);
            console.error(`Actual Event:`, trace.events[eventIndex]);
        }
        console.groupEnd();
        
        throw new Error(`ReplayDivergenceError: ${reason}`);
    }
}

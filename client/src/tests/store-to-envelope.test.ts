import { beforeEach, describe, expect, it } from 'vitest';
import { ReactiveStore } from '../store/ReactiveStore';
import { SafeExpressionEngine, CompiledGraph } from '../runtime/SafeExpressionEngine';
import { StoreToEnvelopeAdapter } from '../protocol/StoreToEnvelopeAdapter';

describe('Store-to-Envelope Integration: Runtime → Network Bridge', () => {
    let store: ReactiveStore;
    let compiledGraph: CompiledGraph;
    let adapter: StoreToEnvelopeAdapter;

    beforeEach(() => {
        // Use the SafeExpressionEngine's compiled Diamond Dependency graph
        compiledGraph = SafeExpressionEngine.getCompiledGraph();
        
        store = new ReactiveStore({
            evaluateFieldRules: (fieldId, bindings) => SafeExpressionEngine.evaluate(fieldId, bindings)
        });

        store.setContext(compiledGraph);

        adapter = new StoreToEnvelopeAdapter(
            store,
            compiledGraph,
            {
                schemaId: 'diamond-test',
                schemaVersion: 1,
                schemaHash: compiledGraph.dagHash || 'test-hash-123',
                platform: 'jest',
                sdkVersion: '1.0.0',
                locale: 'en-US'
            }
        );
    });

    it('Proof #1: Calculated fields (B, C, D) are excluded from envelope data', () => {
        store.setValue('A', 10);
        
        const envelope = adapter.extract();
        
        // Only field_a (the raw input) should be in data
        expect(envelope.data['A']).toBe(10);
        expect(envelope.data['B']).toBeUndefined();
        expect(envelope.data['C']).toBeUndefined();
        expect(envelope.data['D']).toBeUndefined();
    });

    it('Proof #2: Envelope contains exactly user input, nothing derived', () => {
        store.setValue('A', 5);
        
        const envelope = adapter.extract();
        const keys = Object.keys(envelope.data);
        
        expect(keys).toEqual(['A']);
        expect(keys.length).toBe(1);
    });

    it('Proof #3: Schema hash binds payload to exact OPcache artifact', () => {
        store.setValue('A', 10);
        
        const envelope = adapter.extract();
        
        expect(envelope.schemaHash).toBe(compiledGraph.dagHash || 'test-hash-123');
        expect(envelope.schemaId).toBe('diamond-test');
    });

    it('Proof #4: Integrity hash changes when raw input changes', () => {
        store.setValue('A', 10);
        const envelope1 = adapter.extract();
        
        // Reset and change input
        store.setValue('A', 20);
        const envelope2 = adapter.extract();
        
        expect(envelope1.data['A']).toBe(10);
        expect(envelope2.data['A']).toBe(20);
        
        // Integrity MUST differ
        expect(envelope2.integrity.value).not.toBe(envelope1.integrity.value);
    });

    it('Proof #5: Integrity stable regardless of derived value changes', () => {
        store.setValue('A', 10);
        const envelope1 = adapter.extract();
        
        // Same raw input = same integrity, even if internal DAG recomputed
        store.setValue('A', 10);
        const envelope2 = adapter.extract();
        
        expect(envelope1.integrity.value).toBe(envelope2.integrity.value);
    });

    it('Proof #6: Validation boundary respects Server Authority', () => {
        store.setValue('A', 10);
        
        const envelope = adapter.extract();
        
        // Client attestation is informational only
        expect(envelope.validation.clientPassed).toBeDefined();
        
        // Server validation is ALWAYS required (never trust client)
        expect(envelope.validation.serverRequired).toBe(true);
    });

    it('Proof #7: Hidden/removed fields are excluded from submission', () => {
        store.setValue('A', 10);
        
        // Simulate hiding field A
        const state = store.getAllState();
        const fieldState = state.get('A');
        if (fieldState) {
            (fieldState as any).visible = false;
        }
        
        const envelope = adapter.extract();
        
        // Hidden field should not appear
        expect(envelope.data['A']).toBeUndefined();
    });

    it('Proof #8: Submission ID follows schema-bound traceability pattern', () => {
        store.setValue('A', 10);
        
        const envelope = adapter.extract();
        
        expect(envelope.submissionId).toMatch(/^sub_diamond-test_\d+_[a-z0-9]{6}$/);
    });

    it('Proof #9: Host capabilities are detected for runtime negotiation', () => {
        store.setValue('A', 10);
        
        const envelope = adapter.extract();
        
        expect(envelope.meta.hostCapabilities).toBeDefined();
        expect(typeof envelope.meta.hostCapabilities?.indexeddb).toBe('boolean');
        expect(typeof envelope.meta.hostCapabilities?.serviceworkers).toBe('boolean');
    });

    it('Proof #10: Envelope metadata captures platform context', () => {
        store.setValue('A', 10);
        
        const envelope = adapter.extract();
        
        expect(envelope.meta.platform).toBe('jest');
        expect(envelope.meta.sdkVersion).toBe('1.0.0');
        expect(envelope.meta.locale).toBe('en-US');
    });

    it('Proof #11 (CRITICAL): Bit-identical outputs for identical inputs', () => {
        // User A
        const storeA = new ReactiveStore({
            evaluateFieldRules: (fieldId, bindings) => SafeExpressionEngine.evaluate(fieldId, bindings)
        });
        storeA.setContext(compiledGraph);
        const adapterA = new StoreToEnvelopeAdapter(storeA, compiledGraph, {
            schemaId: 'diamond-test',
            schemaVersion: 1,
            schemaHash: compiledGraph.dagHash || 'test-hash-123',
            platform: 'jest',
            sdkVersion: '1.0.0',
            locale: 'en-US'
        });
        storeA.setValue('A', 10);
        const envelopeA = adapterA.extract();

        // User B (fresh session, identical input)
        const storeB = new ReactiveStore({
            evaluateFieldRules: (fieldId, bindings) => SafeExpressionEngine.evaluate(fieldId, bindings)
        });
        storeB.setContext(compiledGraph);
        const adapterB = new StoreToEnvelopeAdapter(storeB, compiledGraph, {
            schemaId: 'diamond-test',
            schemaVersion: 1,
            schemaHash: compiledGraph.dagHash || 'test-hash-123',
            platform: 'jest',
            sdkVersion: '1.0.0',
            locale: 'en-US'
        });
        storeB.setValue('A', 10);
        const envelopeB = adapterB.extract();

        // These MUST be identical (excluding timestamp/submissionId which are inherently different)
        expect(envelopeB.data).toEqual(envelopeA.data);
        expect(envelopeB.schemaHash).toBe(envelopeA.schemaHash);
        
        // The critical assertion: integrity hash is pure function of (raw_input, schema_hash)
        expect(envelopeB.integrity.value).toBe(envelopeA.integrity.value);
    });
});

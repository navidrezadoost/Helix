// client/src/store/ReactiveStore.ts

import { JsonLogicEvaluatorInstance } from '../evaluator/JsonLogicEvaluator';
import { RuntimeEffect } from '../runtime/effects';
import { TraceCollectorInstance } from '../telemetry/TraceCollector';
import { TraceEventType } from '../telemetry/TraceIR';

export interface FieldEffectState {
    value: any;
    visible: boolean;
    required: boolean;
    errors: string[];
    isValid: boolean;
}

type Subscriber = (state: FieldEffectState) => void;

interface RelationalConfig {
    visibility?: any;
    required?: any;
    rules?: any[];
}

interface ReactiveState {
    values: Map<string, any>;
    visibility: Map<string, boolean>;
    required: Map<string, boolean>;
    errors: Map<string, string[]>;
}

interface EvaluateFieldRulesConfig {
    evaluateFieldRules: (fieldId: string, bindings: Record<string, any>) => any;
}

export class ReactiveStore {
    public state: ReactiveState;

    /**
     * DAG structures
     */
    private dependencies: Map<string, Set<string>>;
    private reverseDependencies: Map<string, Set<string>>;

    /**
     * Topological execution order
     */
    private topoOrder: string[];

    /**
     * Field relational rules
     */
    private relationalRules: Map<string, RelationalConfig>;

    /**
     * Subscribers
     */
    private subscribers: Map<string, Set<Subscriber>>;

    /**
     * Dirty fields queue
     */
    private dirtyQueue: Set<string>;

    /**
     * Evaluation config (injected)
     */
    private evaluateConfig?: EvaluateFieldRulesConfig;

    constructor(config?: EvaluateFieldRulesConfig) {
        this.state = {
            values: new Map(),
            visibility: new Map(),
            required: new Map(),
            errors: new Map(),
        };

        this.dependencies = new Map();
        this.reverseDependencies = new Map();
        this.relationalRules = new Map();
        this.subscribers = new Map();
        this.dirtyQueue = new Set();
        this.topoOrder = [];
        this.evaluateConfig = config;

        JsonLogicEvaluatorInstance.connectToStore(this);
    }

    /**
     * Initialize the store from a CompiledGraph (used by React SDK)
     */
    public setContext(graph: any): void {
        // Initialize nodes from compiled graph
        if (graph.nodes) {
            for (const [nodeId, node] of Object.entries(graph.nodes as Record<string, {
                dependencies?: string[];
                defaultValue?: unknown;
            }>)) {
                // Register dependencies
                if (node.dependencies && node.dependencies.length > 0) {
                    this.registerDependency(nodeId, node.dependencies);
                }

                // Initialize default values
                this.state.values.set(nodeId, node.defaultValue ?? null);
                this.state.visibility.set(nodeId, true);
                this.state.required.set(nodeId, false);
                this.state.errors.set(nodeId, []);
            }
        }
    }

    /**
     * Registers field dependency graph
     */
    public registerDependency(field: string, dependsOn: string[]): void {
        this.dependencies.set(field, new Set(dependsOn));

        for (const dep of dependsOn) {
            if (!this.reverseDependencies.has(dep)) {
                this.reverseDependencies.set(dep, new Set());
            }

            this.reverseDependencies.get(dep)!.add(field);
        }

        this.computeTopologicalOrder();
    }

    /**
     * Register field relational config
     */
    public registerRules(field: string, config: RelationalConfig): void {
        this.relationalRules.set(field, config);
    }

    /**
     * Main reactive entrypoint
     */
    public setValue(field: string, value: any): void {
        const previous = this.state.values.get(field);

        if (previous === value) return;

        // START EXECUTION TRACE
        const triggerEventId = TraceCollectorInstance.beginTrace(field, { previous, newValue: value });

        this.state.values.set(field, value);

        this.markDirty(field, triggerEventId || undefined);

        this.flush(triggerEventId || undefined);

        this.notify(field, triggerEventId || undefined);
        
        // END EXECUTION TRACE
        TraceCollectorInstance.endTrace(triggerEventId || undefined);
    }

    public getValue(field: string): any {
        return this.state.values.get(field);
    }

    /**
     * Batched propagation
     */
    private flush(triggerEventId?: string): void {
        const executionQueue = this.buildExecutionQueue();
        let aggregatedEffects: RuntimeEffect[] = [];

        for (const field of executionQueue) {
            TraceCollectorInstance.recordEvent(TraceEventType.NODE_ENQUEUED, field, triggerEventId);
        }

        for (const field of executionQueue) {
            const rules = this.relationalRules.get(field);

            if (rules) {
                const evalEventId = TraceCollectorInstance.recordEvent(TraceEventType.NODE_EVALUATED, field, triggerEventId);

                // PURE: Only evaluates rules, does not mutate store
                const effects = JsonLogicEvaluatorInstance.evaluateFieldRules(
                    field,
                    rules
                );
                
                if (effects.length > 0) {
                    TraceCollectorInstance.recordEvent(TraceEventType.EFFECT_PRODUCED, field, evalEventId || undefined, effects);
                }
                
                aggregatedEffects = aggregatedEffects.concat(effects);
            } else {
                TraceCollectorInstance.recordEvent(TraceEventType.EVALUATION_SKIPPED, field, triggerEventId, "No relational rules");
            }
        }

        // COMMIT: Apply all effects atomically
        this.commitEffects(aggregatedEffects, triggerEventId);

        this.dirtyQueue.clear();
    }

    /**
     * Commits pure effects to the reactive store phase
     */
    private commitEffects(effects: RuntimeEffect[], triggerEventId?: string): void {
        const changedFields = new Set<string>();

        for (const effect of effects) {
            switch(effect.type) {
                case 'visibility':
                    if (this.state.visibility.get(effect.field) !== effect.visible) {
                        this.setVisibility(effect.field, effect.visible);
                        changedFields.add(effect.field);
                    }
                    break;
                case 'required':
                    if (this.state.required.get(effect.field) !== effect.required) {
                        this.setRequired(effect.field, effect.required);
                        changedFields.add(effect.field);
                    }
                    break;
                case 'error':
                    // Very simple array equality check for demonstration
                    const existingErrors = this.state.errors.get(effect.field) || [];
                    if (JSON.stringify(existingErrors) !== JSON.stringify(effect.errors)) {
                        this.setErrors(effect.field, effect.errors);
                        changedFields.add(effect.field);
                    }
                    break;
                case 'value':
                     if (this.state.values.get(effect.field) !== effect.value) {
                         this.state.values.set(effect.field, effect.value);
                         changedFields.add(effect.field);
                         // Note: Re-dirtying a field during commit requires
                         // multi-pass scheduling which we'll address in the scheduler.
                     }
                    break;
            }
        }

        // Only notify subscribers of fields that actually changed state representations
        for (const field of changedFields) {
            TraceCollectorInstance.recordEvent(TraceEventType.EFFECT_COMMITTED, field, triggerEventId);
            this.notify(field, triggerEventId);
        }
    }

    /**
     * DAG traversal
     */
    private buildExecutionQueue(): string[] {
        const affected = new Set<string>();

        for (const dirty of this.dirtyQueue) {
            this.collectDependents(dirty, affected);
        }

        return this.topoOrder.filter(f => affected.has(f));
    }

    /**
     * DFS traversal
     */
    private collectDependents(
        field: string,
        visited: Set<string>
    ): void {
        if (visited.has(field)) return;

        visited.add(field);

        const dependents =
            this.reverseDependencies.get(field);

        if (!dependents) return;

        for (const dep of dependents) {
            this.collectDependents(dep, visited);
        }
    }

    /**
     * Dirty tracking
     */
    private markDirty(field: string, triggerEventId?: string): void {
        this.dirtyQueue.add(field);
        TraceCollectorInstance.recordEvent(TraceEventType.NODE_INVALIDATED, field, triggerEventId);
    }

    /**
     * Topological sort (Kahn Algorithm)
     */
    private computeTopologicalOrder(): void {
        const inDegree = new Map<string, number>();

        for (const [field, deps] of this.dependencies) {
            if (!inDegree.has(field)) {
                inDegree.set(field, 0);
            }

            for (const dep of deps) {
                inDegree.set(
                    field,
                    (inDegree.get(field) || 0) + 1
                );

                if (!inDegree.has(dep)) {
                    inDegree.set(dep, 0);
                }
            }
        }

        const queue: string[] = [];

        for (const [node, degree] of inDegree) {
            if (degree === 0) {
                queue.push(node);
            }
        }

        const result: string[] = [];

        while (queue.length) {
            const node = queue.shift()!;

            result.push(node);

            const dependents =
                this.reverseDependencies.get(node);

            if (!dependents) continue;

            for (const dep of dependents) {
                inDegree.set(
                    dep,
                    inDegree.get(dep)! - 1
                );

                if (inDegree.get(dep) === 0) {
                    queue.push(dep);
                }
            }
        }

        if (result.length !== inDegree.size) {
            throw new Error(
                '[ReactiveStore] Circular dependency detected'
            );
        }

        this.topoOrder = result;
    }

    /**
     * Visibility mutations
     */
    public setVisibility(
        field: string,
        visible: boolean
    ): void {
        this.state.visibility.set(field, visible);
    }

    /**
     * Required mutations
     */
    public setRequired(
        field: string,
        required: boolean
    ): void {
        this.state.required.set(field, required);
    }

    /**
     * Error mutations
     */
    public setErrors(
        field: string,
        errors: string[]
    ): void {
        this.state.errors.set(field, errors);
    }

    /**
     * Subscriptions
     */
    public subscribe(
        field: string,
        callback: Subscriber
    ): () => void {
        if (!this.subscribers.has(field)) {
            this.subscribers.set(field, new Set());
        }

        this.subscribers.get(field)!.add(callback);

        return () => {
            this.subscribers
                .get(field)
                ?.delete(callback);
        };
    }

    private notify(field: string, triggerEventId?: string): void {
        const subscribers =
            this.subscribers.get(field);

        if (!subscribers) return;

        const state: FieldEffectState = {
            value: this.getValue(field),
            visible: this.state.visibility.has(field) ? this.state.visibility.get(field)! : true,
            required: this.state.required.has(field) ? this.state.required.get(field)! : false,
            errors: this.state.errors.get(field) || [],
            isValid: (this.state.errors.get(field) || []).length === 0
        };

        for (const callback of subscribers) {
            callback(state);
        }

        TraceCollectorInstance.recordEvent(TraceEventType.NOTIFICATION_SENT, field, triggerEventId, state);
    }

    /**
     * Returns a snapshot of all field states (for envelope extraction)
     */
    public getAllState(): Map<string, FieldEffectState> {
        const snapshot = new Map<string, FieldEffectState>();
        for (const field of this.state.values.keys()) {
            const errors = this.state.errors.get(field) || [];
            snapshot.set(field, {
                value: this.getValue(field),
                visible: this.state.visibility.get(field) ?? true,
                required: this.state.required.get(field) ?? false,
                errors,
                isValid: errors.length === 0
            });
        }
        return snapshot;
    }
}

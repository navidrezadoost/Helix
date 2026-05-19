// client/src/compiler/RuntimeGraphBuilder.ts
import { CompiledGraph } from './types';
import { ReactiveStore } from '../store/ReactiveStore';

export class RuntimeGraphBuilder {
    /**
     * Mounts the compiled IR Graph onto the live ReactiveStore engine.
     */
    public mount(graph: CompiledGraph, store: ReactiveStore): void {
        // 1. Register all nodes and their extracted dependencies
        for (const [nodeId, node] of graph.nodes) {
            store.registerDependency(nodeId, node.dependencies);
        }

        // 2. Register compiled relational configurations
        for (const [nodeId, node] of graph.nodes) {
            store.registerRules(nodeId, node.relationalConfig);
        }

        // Future: Register graph.formLevelRules into the store or a FormLevel scheduler
    }
}

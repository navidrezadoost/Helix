import type { CompiledGraph } from '../types';
import type { ReactiveStore } from '../store/ReactiveStore';

export class RuntimeGraphBuilder {
  static buildDependencyMap(graph: CompiledGraph): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();

    for (const rule of graph.rules ?? []) {
      for (const dependency of rule.depends_on ?? []) {
        if (!map.has(dependency)) {
          map.set(dependency, new Set());
        }

        for (const action of rule.actions ?? []) {
          map.get(dependency)?.add(action.field);
        }
      }
    }

    return map;
  }

  static registerFields(
    store: ReactiveStore,
    graph: CompiledGraph,
    initialValues: Record<string, unknown> = {}
  ): void {
    for (const fieldName of Object.keys(graph.fields ?? {})) {
      if (Object.prototype.hasOwnProperty.call(initialValues, fieldName)) {
        store.dispatch({
          type: 'FIELD_CHANGE',
          nodeId: fieldName,
          value: initialValues[fieldName],
        });
      }
    }
  }
}
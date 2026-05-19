import { AsyncAction } from '../types/async';

export class AsyncActionRegistry {
  private actionsByTarget: Map<string, AsyncAction[]> = new Map();
  private dependentsMap: Map<string, Set<string>> = new Map(); // field -> fields that depend on it via async

  register(action: AsyncAction): void {
    // Store by target field
    const existing = this.actionsByTarget.get(action.targetField) || [];
    existing.push(action);
    this.actionsByTarget.set(action.targetField, existing);

    // Build reverse dependency map for quick lookup
    for (const dep of action.dependsOn) {
      if (!this.dependentsMap.has(dep)) {
        this.dependentsMap.set(dep, new Set());
      }
      this.dependentsMap.get(dep)!.add(action.targetField);
    }
  }

  registerBatch(actions: AsyncAction[]): void {
    for (const action of actions) {
      this.register(action);
    }
  }

  getActionsForField(field: string): AsyncAction[] {
    return this.actionsByTarget.get(field) || [];
  }

  getFieldsThatDependOn(changedField: string): Set<string> {
    return this.dependentsMap.get(changedField) || new Set();
  }

  getAllAsyncFields(): Set<string> {
    return new Set(this.actionsByTarget.keys());
  }

  hasAsyncAction(field: string): boolean {
    return this.actionsByTarget.has(field);
  }

  clear(): void {
    this.actionsByTarget.clear();
    this.dependentsMap.clear();
  }
}

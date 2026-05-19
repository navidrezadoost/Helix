declare module '@helix/core' {
  export interface OptionItem {
    value: string;
    label: string;
  }

  export interface AsyncFieldState {
    isLoading: boolean;
    lastError: string | null;
    lastFetchedAt: number | null;
    lastOptions: OptionItem[] | null;
    pendingRequestId: symbol | null;
  }

  export interface FieldState {
    value: any;
    errors: string[];
    visible: boolean;
    required: boolean;
    disabled: boolean;
    touched: boolean;
    valid: boolean;
    type?: string;
    options?: OptionItem[];
    asyncState?: AsyncFieldState;
  }

  export interface CompiledGraph {
    rules?: Array<{
      depends_on?: string[];
      actions: Array<{ type: string; field: string }>;
    }>;
    dagHash?: string;
  }

  export class ExpressionEngine {
    evaluate(expression: string, context: Record<string, unknown>, constants?: Record<string, unknown>): unknown;
  }

  export class ReactiveStore {
    constructor(engine: ExpressionEngine);
    initGraph(graph: any, dependencyMap: Map<string, Set<string>>): void;
    getFieldState(fieldId: string): FieldState | undefined;
    getAllState(): Map<string, FieldState>;
    getAsyncState(fieldId: string): AsyncFieldState | undefined;
    subscribe(callback: () => void): () => void;
    dispatch(action: { type: string; nodeId?: string; value?: any }): void;
    finalize(): void;
    destroy(): void;
  }

  export class RuntimeGraphBuilder {
    static buildDependencyMap(graph: any): Map<string, Set<string>>;
    static registerFields(store: ReactiveStore, graph: any, initialValues?: Record<string, unknown>): void;
  }

  export class StoreToEnvelopeAdapter {
    constructor(store: ReactiveStore, graph: any, metadata: any);
    extract(): any;
  }
}
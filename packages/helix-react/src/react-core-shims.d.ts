declare namespace React {
  type ReactNode = any;

  interface FC<P = {}> {
    (props: P): ReactNode;
  }

  interface ChangeEvent<T = Element> {
    target: T;
  }

  interface Context<T> {
    Provider: FC<{ value: T; children?: ReactNode }>;
  }

  function createContext<T>(defaultValue: T): Context<T>;
  function useContext<T>(context: Context<T>): T;
  function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  function useState<T>(initial: T | (() => T)): [T, (value: T) => void];
  function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly unknown[]): T;
  function useRef<T>(initial: T): { current: T };
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare module 'react' {
  export = React;
}

declare module 'react/jsx-runtime' {
  export const Fragment: any;
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
}

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
    dagHash?: string;
    rules?: Array<{
      depends_on: string[];
      actions: Array<{ type: string; field: string }>;
    }>;
  }

  export class ReactiveStore {
    constructor(engine: ExpressionEngine);
    initGraph(graph: any, dependencyMap: Map<string, Set<string>>): void;
    dispatch(action: { type: string; nodeId?: string; value?: any }): void;
    getFieldState(nodeId: string): FieldState | undefined;
    getAsyncState(field: string): AsyncFieldState | undefined;
    subscribe(callback: (state: Map<string, FieldState>) => void): () => void;
  }

  export class RuntimeGraphBuilder {
    static buildDependencyMap(graph: any): Map<string, Set<string>>;
    static registerFields(store: ReactiveStore, graph: any, initialValues?: Record<string, unknown>): void;
  }

  export class StoreToEnvelopeAdapter {
    constructor(store: ReactiveStore, graph: any, metadata: any);
    extract(): Promise<any>;
  }

  export class ExpressionEngine {
    evaluate(expression: string, context: Record<string, unknown>, constants?: Record<string, unknown>): unknown;
  }
}
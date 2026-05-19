declare module 'react' {
  export type ReactNode = any;
  export type ReactElement<P = any, T = any> = any;
  export type ComponentType<P = any> = (props: P) => any;
  export type ComponentProps<T = any> = any;
  export type ComponentPropsWithoutRef<T = any> = any;
  export type ElementRef<T = any> = any;
  export type CSSProperties = Record<string, any>;
  export type FC<P = {}> = (props: P) => any;
  export type PropsWithChildren<P = {}> = P & { children?: any };

  export interface Context<T> {
    Provider: any;
    Consumer: any;
  }

  export function useState<S>(
    initialState: S | (() => S),
  ): [S, (value: S | ((prevState: S) => S)) => void];

  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly unknown[]): T;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useRef<T>(initialValue: T | null): { current: T | null };
  export function useId(): string;
  export function forwardRef<T, P = {}>(
    render: (props: P, ref: any) => any,
  ): (props: P & { ref?: any }) => any;
  export function createContext<T>(defaultValue: T): Context<T>;
  export function useContext<T>(context: Context<T>): T;

  const React: {
    createElement: (...args: any[]) => any;
    forwardRef: <T, P = {}>(
      render: (props: P, ref: any) => any,
    ) => (props: P & { ref?: any }) => any;
  };

  export default React;
}

declare module '@dnd-kit/core' {
  export type DragEndEvent = {
    active: { id: string };
    over: { id: string } | null;
  };

  export const closestCenter: unknown;
  export const DndContext: any;
}

declare module '@dnd-kit/sortable' {
  export const SortableContext: any;
  export const verticalListSortingStrategy: unknown;
}

declare module 'react-router-dom' {
  export const BrowserRouter: any;
  export const Routes: any;
  export const Route: any;
  export const Navigate: any;
  export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T;
}

declare module 'react-dom/client' {
  export function createRoot(container: Element | DocumentFragment): {
    render(children: any): void;
  };
}

declare module 'react/jsx-runtime' {
  export const Fragment: any;
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

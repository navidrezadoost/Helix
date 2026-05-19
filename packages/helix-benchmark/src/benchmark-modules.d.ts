declare module '@helix/react' {
  export function HelixForm(config: {
    schemaId: string;
    version: number;
    endpoint: string;
    shopifyAuth?: boolean;
  }): unknown;
}

declare module '@helix/webcomponents' {}

declare module 'react-dom/client' {
  export interface Root {
    render(children: unknown): void;
    unmount(): void;
  }

  export function createRoot(container: Element | DocumentFragment): Root;
}

declare module 'node:fs' {
  export function writeFileSync(path: string, data: string): void;
}
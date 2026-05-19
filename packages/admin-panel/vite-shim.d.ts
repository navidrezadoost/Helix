declare module 'vite' {
  export function defineConfig(config: any): any;
}

declare module '@vitejs/plugin-react' {
  export default function react(): any;
}

declare module 'path' {
  const path: {
    resolve: (...paths: string[]) => string;
  };

  export default path;
}

declare const __dirname: string;

import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      outDir: 'dist',
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'HelixWebComponents',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['@helix/core'],
      output: {
        globals: {
          '@helix/core': 'HelixCore',
        },
      },
    },
  },
});
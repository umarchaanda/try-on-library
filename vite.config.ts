import { defineConfig } from 'vite';

export default defineConfig({
  server: { open: '/index.html' },
  build: {
    target: 'es2019',
    sourcemap: true,
    lib: {
      entry: 'src/index.ts',
      name: 'VirtualTryOn',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'tryon.es.js' : 'tryon.umd.js'),
    },
    rollupOptions: { output: { exports: 'default' } },
  },
});

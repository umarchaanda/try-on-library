import { defineConfig } from 'vite';

// Static demo-site build (index.html) for hosting, separate from the library build.
export default defineConfig({
  build: { outDir: 'dist-site', emptyOutDir: true },
});

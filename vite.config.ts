import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isDevelopmentMode = mode === 'development';

  return {
    base: './',
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist/renderer',
      emptyOutDir: true,
      minify: isDevelopmentMode ? false : 'esbuild',
      sourcemap: isDevelopmentMode,
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/renderer/test/setup.ts',
      css: true,
    },
  };
});

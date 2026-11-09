import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    // The deploy workflow passes the release id; local builds show "dev".
    __BUILD_LABEL__: JSON.stringify(process.env.BUILD_LABEL ?? 'dev'),
  },
  build: {
    target: 'es2020',
  },
});

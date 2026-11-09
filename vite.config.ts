import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string };

export default defineConfig({
  define: {
    // The deploy workflow passes the release id; local builds show "dev".
    __BUILD_LABEL__: JSON.stringify(process.env.BUILD_LABEL ?? 'dev'),
    __VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2020',
  },
});

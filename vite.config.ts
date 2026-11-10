import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string };

export default defineConfig({
  define: {
    // CI passes the full label: "X.Y.Z+<sha7>" for what main deploys, "X.Y.Z-dev+<sha7>"
    // for any other build. A local build has no commit to name, so it is "X.Y.Z-dev".
    __BUILD_LABEL__: JSON.stringify(process.env.BUILD_LABEL || `${pkg.version}-dev`),
    __VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2020',
  },
});

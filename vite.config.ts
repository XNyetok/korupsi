import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string };

// Like Havus, the version comes from the release tag: release.yml passes it as
// VERSION. package.json's version is not bumped, so other builds show "0.0.0".
const version = process.env.VERSION || pkg.version;

export default defineConfig({
  define: {
    // CI passes the full label: "X.Y.Z+<sha7>" for a release, "X.Y.Z-dev+<sha7>"
    // for any other build. A local build has no commit to name, so it is "X.Y.Z-dev".
    __BUILD_LABEL__: JSON.stringify(process.env.BUILD_LABEL || `${version}-dev`),
    __VERSION__: JSON.stringify(version),
  },
  build: {
    target: 'es2020',
  },
});

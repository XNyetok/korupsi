import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const OUT_DIR = resolve('dist');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/**
 * Writes dist/sw.js from pwa/sw.js with the build's file list baked in.
 * The worker is not hashed on purpose: the browser must be able to update the
 * same URL, and nginx serves it with no-cache.
 */
function serviceWorker(): Plugin {
  return {
    name: 'korupsi-service-worker',
    apply: 'build',
    closeBundle() {
      const files = walk(OUT_DIR)
        .map((file) => '/' + relative(OUT_DIR, file).split('\\').join('/'))
        // sw.js is the worker itself, og.png is only for social crawlers.
        .filter((file) => file !== '/sw.js' && file !== '/og.png')
        .sort();

      const template = readFileSync(resolve('pwa/sw.js'), 'utf8');
      const version = process.env.BUILD_LABEL ?? 'dev';
      const source = template
        .replace('__VERSION__', JSON.stringify(version))
        .replace('__PRECACHE__', JSON.stringify(files, null, 2));

      writeFileSync(join(OUT_DIR, 'sw.js'), source);
    },
  };
}

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
  plugins: [serviceWorker()],
});

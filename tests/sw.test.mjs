import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

/** Runs the worker script against a fake ServiceWorkerGlobalScope. */
function loadWorker() {
  const listeners = {};
  const state = {
    caches: new Map([
      ['korupsi-r44-3389822', {}],
      ['korupsi-r45-dfc1b5c', {}],
    ]),
    skipped: false,
    unregistered: false,
    navigated: [],
  };

  const self = {
    addEventListener: (type, fn) => {
      listeners[type] = fn;
    },
    skipWaiting: () => {
      state.skipped = true;
      return Promise.resolve();
    },
    registration: {
      unregister: async () => {
        state.unregistered = true;
        return true;
      },
    },
    clients: {
      matchAll: async () => [
        { url: 'https://korupsi.web.id/', navigate: async (url) => state.navigated.push(url) },
        {
          url: 'https://korupsi.web.id/?debug=1',
          navigate: () => Promise.reject(new TypeError('not controlled')),
        },
      ],
    },
  };

  const caches = {
    keys: async () => [...state.caches.keys()],
    delete: async (key) => state.caches.delete(key),
  };

  vm.runInNewContext(source, { self, caches, Promise });
  return { listeners, state };
}

test('the kill switch takes over without waiting', () => {
  const { listeners, state } = loadWorker();
  listeners.install({});
  assert.equal(state.skipped, true);
});

test('activating clears every cache, unregisters and reloads the tabs', async () => {
  const { listeners, state } = loadWorker();
  let work;
  listeners.activate({ waitUntil: (promise) => (work = promise) });
  await work;

  assert.equal(state.caches.size, 0);
  assert.equal(state.unregistered, true);
  // A tab that refuses to navigate must not stop the rest.
  assert.deepEqual(state.navigated, ['https://korupsi.web.id/']);
});

test('the kill switch never answers requests itself', () => {
  const { listeners } = loadWorker();
  assert.equal(listeners.fetch, undefined);
});

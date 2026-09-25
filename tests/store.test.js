/**
 * Store unit tests: persistence, reactivity, sealing, import/export.
 *
 * Run with `npm test`.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createStore } from '../src/core/store.js';
import { createMemoryStorage } from './helpers/memoryStorage.js';

function makeStore(overrides = {}) {
  const storage = createMemoryStorage();
  const store = createStore({
    name: 'test',
    defaults: { a: 1, nested: { deep: 'x', keep: true }, list: [1, 2] },
    storageKey: 'test:state',
    storage,
    persistDelay: 0,
    ...overrides,
  });
  return { store, storage };
}

describe('createStore — reactivity', () => {
  test('deep proxy notifies with the changed dot path', () => {
    const { store } = makeStore();
    /** @type {any[][]} */
    const seen = [];
    store.subscribe((changes) => seen.push(changes.map((change) => change.path)));

    store.state.nested.deep = 'y';
    assert.deepEqual(seen.at(-1), ['nested.deep']);
  });

  test('subscribers can filter by path prefix', () => {
    const { store } = makeStore();
    let hits = 0;
    store.subscribe('nested', () => {
      hits += 1;
    });
    store.set('a', 2); // ignored
    store.set('nested.deep', 'changed'); // counted
    assert.equal(hits, 1);
  });

  test('batch() collapses many writes into one notification', () => {
    const { store } = makeStore();
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });

    store.batch(() => {
      store.state.a = 10;
      store.state.nested.deep = 'z';
      store.state.nested.keep = false;
    });

    assert.equal(calls, 1);
  });

  test('no-op writes do not notify', () => {
    const { store } = makeStore();
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.state.a = 1; // same value
    assert.equal(calls, 0);
  });

  test('set() creates intermediate objects', () => {
    const { store } = makeStore();
    store.set('a.b.c.d', 42);
    assert.equal(store.get('a.b.c.d'), 42);
  });

  test('deleteProperty notifies', () => {
    const { store } = makeStore();
    /** @type {string[]} */
    const paths = [];
    store.subscribe((changes) => paths.push(...changes.map((change) => change.path)));
    delete store.state.nested.keep;
    assert.ok(paths.includes('nested.keep'));
  });

  test('state reads stay reactive after a nested read', () => {
    const { store } = makeStore();
    const nested = store.state.nested;
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    nested.deep = 'again';
    assert.equal(calls, 1);
    assert.equal(store.get('nested.deep'), 'again');
  });
});

describe('createStore — persistence', () => {
  test('writes a versioned envelope and rehydrates it', async () => {
    const storage = createMemoryStorage();
    const first = createStore({
      name: 'test',
      defaults: { a: 1 },
      storageKey: 'k',
      storage,
      persistDelay: 0,
    });
    first.set('a', 99);
    first.persistNow();

    const raw = storage.getItem('k');
    assert.ok(raw, 'expected something to be written');
    const envelope = JSON.parse(raw);
    assert.equal(envelope.name, 'test');
    assert.equal(envelope.data.a, 99);

    const second = createStore({
      name: 'test',
      defaults: { a: 1 },
      storageKey: 'k',
      storage,
      persistDelay: 0,
    });
    assert.equal(second.get('a'), 99);
  });

  test('encode/decode run at the storage boundary', () => {
    const storage = createMemoryStorage();
    const store = createStore({
      name: 'test',
      defaults: { secret: '' },
      storageKey: 'k',
      storage,
      persistDelay: 0,
      encode: (data) => ({ ...data, secret: data.secret ? `sealed:${data.secret}` : '' }),
      decode: (data) => ({ ...data, secret: String(data.secret ?? '').replace(/^sealed:/, '') }),
    });

    store.set('secret', 'ghp_token');
    store.persistNow();

    assert.equal(JSON.parse(storage.getItem('k')).data.secret, 'sealed:ghp_token');
    assert.equal(store.get('secret'), 'ghp_token'); // in-memory value untouched

    const reopened = createStore({
      name: 'test',
      defaults: { secret: '' },
      storageKey: 'k',
      storage,
      persistDelay: 0,
      encode: (data) => ({ ...data, secret: data.secret ? `sealed:${data.secret}` : '' }),
      decode: (data) => ({ ...data, secret: String(data.secret ?? '').replace(/^sealed:/, '') }),
    });
    assert.equal(reopened.get('secret'), 'ghp_token');
  });

  test('corrupt JSON in storage is survived', () => {
    const storage = createMemoryStorage({ k: '{not json' });
    const store = createStore({ name: 'test', defaults: { a: 1 }, storageKey: 'k', storage, onError: () => {} });
    assert.equal(store.get('a'), 1);
  });

  test('reset() restores defaults and persists them', () => {
    const { store, storage } = makeStore();
    store.set('a', 500);
    store.reset();
    assert.equal(store.get('a'), 1);
    store.persistNow();
    assert.equal(JSON.parse(storage.getItem('test:state')).data.a, 1);
  });

  test('clearStorage() wipes the key', () => {
    const { store, storage } = makeStore();
    store.set('a', 5);
    store.persistNow();
    store.clearStorage();
    assert.equal(storage.getItem('test:state'), null);
  });
});

describe('createStore — import / export', () => {
  test('exportJSON redacts unless asked otherwise', () => {
    const { store } = makeStore({
      redact: (data) => ({ ...data, a: 0 }),
    });
    store.set('a', 7);
    const safe = store.exportJSON();
    const full = store.exportJSON({ includeSecrets: true });
    assert.equal(safe.data.a, 0);
    assert.equal(full.data.a, 7);
    assert.equal(safe.$schema, 'gitbinder/state');
  });

  test('importJSON accepts an envelope or a bare object', () => {
    const { store } = makeStore();
    store.importJSON({ a: 42, nested: { deep: 'imported' } });
    assert.equal(store.get('a'), 42);
    assert.equal(store.get('nested.deep'), 'imported');

    const result = store.importJSON({
      $schema: 'gitbinder/state',
      version: 1,
      data: { a: 7 },
    });
    assert.equal(result.ok, true);
    assert.equal(store.get('a'), 7);
  });

  test('importJSON rejects non-object payloads', () => {
    const { store } = makeStore();
    const result = store.importJSON('nope');
    assert.equal(result.ok, false);
    assert.ok(result.warnings.includes('invalid-payload'));
  });

  test('migration runs when versions differ', () => {
    const storage = createMemoryStorage({
      k: JSON.stringify({ $schema: 'gitbinder/state', version: 0, data: { legacy: 'yes' } }),
    });
    const store = createStore({
      name: 'test',
      defaults: { legacy: 'no', migrated: false },
      version: 1,
      storageKey: 'k',
      storage,
      migrate: (data) => ({ ...data, migrated: true }),
    });
    assert.equal(store.get('migrated'), true);
    assert.equal(store.get('legacy'), 'yes');
  });
});

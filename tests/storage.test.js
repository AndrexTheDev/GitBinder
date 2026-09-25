/**
 * Storage adapters — `src/core/storage.js`.
 *
 * `resolveStorage()` is the reason the app still works in a private window, in
 * an embedded webview, and on a phone where the storage quota is already full.
 * Safari throws on the *write*, not on the property access, so the naive
 * `try { return localStorage } catch {}` is not enough — the function has to
 * probe. That probe has a cost too: it must not leave anything behind in the
 * user's storage.
 *
 * `storageUsage()` feeds a number to the visitor ("how much room is my book
 * taking"), and a wrong number there is worse than none.
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createDomEnvironment } from './helpers/dom.js';
import { createMemoryStorage, resolveStorage, storageUsage } from '../src/core/storage.js';

/** @type {any} */
let env;

before(() => {
  env = createDomEnvironment();
});

after(() => {
  env.cleanup();
});

beforeEach(() => {
  env.window.localStorage.clear();
});

/* -------------------------------------------------------------------------- */

describe('createMemoryStorage', () => {
  test('behaves like Storage for the calls the app makes', () => {
    const storage = createMemoryStorage();

    assert.equal(storage.length, 0);
    assert.equal(storage.getItem('missing'), null);

    storage.setItem('a', '1');
    assert.equal(storage.getItem('a'), '1');
    assert.equal(storage.length, 1);
    assert.equal(storage.key(0), 'a');
    assert.equal(storage.key(5), null);

    storage.removeItem('a');
    assert.equal(storage.getItem('a'), null);
    assert.equal(storage.length, 0);
  });

  test('values are coerced to strings, as the real Storage does', () => {
    // The store writes JSON strings, but a number sneaking through would
    // otherwise come back as a number and survive a `JSON.parse` unchanged —
    // in the browser it would come back as "42".
    const storage = createMemoryStorage();
    storage.setItem('n', 42);
    assert.equal(storage.getItem('n'), '42');
    assert.equal(typeof storage.getItem('n'), 'string');
  });

  test('it marks itself as memory-only so the UI can warn', () => {
    // Without this the app looks like it is saving and quietly is not.
    assert.equal(createMemoryStorage().isMemoryOnly, true);
  });

  test('clear() empties it', () => {
    const storage = createMemoryStorage({ a: '1', b: '2' });
    storage.clear();
    assert.equal(storage.length, 0);
    assert.equal(storage.getItem('a'), null);
  });

  test('it does not share state with another instance', () => {
    const one = createMemoryStorage();
    const two = createMemoryStorage();
    one.setItem('a', '1');
    assert.equal(two.getItem('a'), null);
  });
});

/* -------------------------------------------------------------------------- */

describe('resolveStorage', () => {
  test('returns localStorage when it works', () => {
    env.window.localStorage.setItem('kept', 'yes');
    const resolved = resolveStorage(env.window);

    assert.equal(resolved, env.window.localStorage);
    assert.equal(resolved.getItem('kept'), 'yes', 'the real storage was swapped for a stand-in');
  });

  test('leaves nothing behind from its write probe', () => {
    // A probe that stayed would show up in `storageUsage()` and, worse, in the
    // visitor's own devtools as a key the app never explains.
    resolveStorage(env.window);

    const keys = [];
    for (let i = 0; i < env.window.localStorage.length; i += 1) keys.push(env.window.localStorage.key(i));
    assert.deepEqual(keys, [], `the probe leaked into storage: ${keys.join(', ')}`);
  });

  test('falls back to memory when localStorage is missing', () => {
    const resolved = resolveStorage({});
    assert.equal(resolved.isMemoryOnly, true);
    assert.doesNotThrow(() => resolved.setItem('a', '1'));
  });

  test('falls back to memory when the property access throws', () => {
    // Some browsers throw a SecurityError from the getter itself, before any
    // write is attempted. Accessing it inside the try is what makes that safe.
    const hostile = {
      get localStorage() {
        throw new Error('SecurityError: storage is blocked');
      },
    };
    const resolved = resolveStorage(hostile);
    assert.equal(resolved.isMemoryOnly, true);
  });

  test('falls back to memory when the write throws (Safari private mode)', () => {
    // The case the probe exists for: reading works, writing does not.
    const hostile = {
      localStorage: {
        getItem: () => null,
        setItem() {
          throw new Error('QuotaExceededError');
        },
        removeItem: () => {},
      },
    };
    const resolved = resolveStorage(hostile);
    assert.equal(resolved.isMemoryOnly, true);
  });

  test('falls back to memory when the quota is already full', () => {
    // Storage exists and answers reads, but refuses new writes. An app that
    // used it anyway would lose every setting on reload without ever failing.
    const full = {
      localStorage: {
        length: 1,
        key: () => 'someone-elses-key',
        getItem: () => 'old',
        setItem() {
          const error = new Error('QuotaExceededError');
          error.name = 'QuotaExceededError';
          throw error;
        },
        removeItem: () => {},
      },
    };
    assert.equal(resolveStorage(full).isMemoryOnly, true);
  });

  test('the fallback still works after the real one is gone', () => {
    // Whatever the visitor does afterwards, the returned object has to keep
    // accepting writes for the lifetime of the page.
    const resolved = resolveStorage({});
    resolved.setItem('book', '{"title":"x"}');
    assert.equal(resolved.getItem('book'), '{"title":"x"}');
    resolved.removeItem('book');
    assert.equal(resolved.getItem('book'), null);
  });
});

/* -------------------------------------------------------------------------- */

describe('storageUsage', () => {
  test('counts only the app\u2019s own keys', () => {
    const storage = env.window.localStorage;
    storage.setItem('someone-elses-key', 'x'.repeat(1000));
    storage.setItem('gitbinder:state', 'x'.repeat(10));

    const usage = storageUsage(storage);
    assert.equal(usage.entries, 1, 'a foreign key was counted');
    assert.ok(usage.bytes < 1000, `foreign bytes were counted: ${usage.bytes}`);
  });

  test('reports bytes as UTF-16 code units, keys included', () => {
    const storage = env.window.localStorage;
    // "gitbinder:state" is 15 chars, the value 5 more: (15 + 5) * 2 = 40.
    storage.setItem('gitbinder:state', 'hello');

    assert.deepEqual(storageUsage(storage), { bytes: 40, entries: 1 });
  });

  test('an empty store reports zero rather than throwing', () => {
    assert.deepEqual(storageUsage(env.window.localStorage), { bytes: 0, entries: 0 });
  });

  test('the prefix is a parameter, so a rename cannot silently report zero', () => {
    // The project was renamed once. A hard-coded prefix would have kept
    // reporting "0 bytes" for every visitor with a legacy key.
    const storage = env.window.localStorage;
    storage.setItem('gitbooklet:state', 'abc');
    assert.equal(storageUsage(storage, 'gitbooklet:').entries, 1);
    assert.equal(storageUsage(storage, 'gitbinder:').entries, 0);
  });

  test('a hostile storage does not break the caller', () => {
    // This drives a line of text in the settings drawer; a storage that throws
    // mid-iteration must not take the drawer down with it.
    const hostile = {
      get length() {
        throw new Error('no length for you');
      },
    };
    assert.deepEqual(storageUsage(hostile), { bytes: 0, entries: 0 });
  });

  test('a missing value counts as an empty string, not as a crash', () => {
    const halfBroken = {
      length: 1,
      key: () => 'gitbinder:state',
      getItem: () => null,
    };
    assert.deepEqual(storageUsage(halfBroken), { bytes: 30, entries: 1 });
  });

  test('the number grows with the payload', () => {
    const storage = env.window.localStorage;
    storage.setItem('gitbinder:a', 'x'.repeat(100));
    const small = storageUsage(storage);
    storage.setItem('gitbinder:b', 'x'.repeat(100));
    const large = storageUsage(storage);

    assert.equal(large.entries, small.entries + 1);
    assert.ok(large.bytes > small.bytes);
  });
});

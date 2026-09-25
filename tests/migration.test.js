/**
 * Storage-key migration.
 *
 * Renaming the project must not cost a visitor their curated book. These
 * tests cover the boot-time hand-off from the retired key names to the
 * current ones, including the failure modes: a write that does not stick
 * must leave the original alone rather than destroying both copies.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { migrateStorageKeys, createMemoryStorage } from '../src/core/storage.js';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../src/config/app.js';

const MAPPING = {
  [STORAGE_KEYS.state]: LEGACY_STORAGE_KEYS.state,
  [STORAGE_KEYS.vault]: LEGACY_STORAGE_KEYS.vault,
};

test('a legacy key is moved to the current one', () => {
  const storage = createMemoryStorage();
  storage.setItem(LEGACY_STORAGE_KEYS.state, '{"settings":{}}');

  const migrated = migrateStorageKeys(storage, MAPPING);

  assert.deepEqual(migrated, [STORAGE_KEYS.state]);
  assert.equal(storage.getItem(STORAGE_KEYS.state), '{"settings":{}}');
  assert.equal(storage.getItem(LEGACY_STORAGE_KEYS.state), null, 'legacy copy should be cleaned up');
});

test('existing data on the current key always wins', () => {
  const storage = createMemoryStorage();
  storage.setItem(STORAGE_KEYS.state, 'new');
  storage.setItem(LEGACY_STORAGE_KEYS.state, 'old');

  assert.deepEqual(migrateStorageKeys(storage, MAPPING), []);
  assert.equal(storage.getItem(STORAGE_KEYS.state), 'new');
});

test('a failed write leaves the legacy copy intact', () => {
  const storage = createMemoryStorage();
  storage.setItem(LEGACY_STORAGE_KEYS.vault, 'device-key');

  // Simulate a quota error on the write to the new key only.
  const failing = {
    ...storage,
    setItem: (key, value) => {
      if (key === STORAGE_KEYS.vault) throw new Error('QuotaExceededError');
      storage.setItem(key, value);
    },
  };

  assert.deepEqual(migrateStorageKeys(failing, MAPPING), []);
  assert.equal(storage.getItem(LEGACY_STORAGE_KEYS.vault), 'device-key', 'original must survive');
  assert.equal(storage.getItem(STORAGE_KEYS.vault), null);
});

test('migration is idempotent', () => {
  const storage = createMemoryStorage();
  storage.setItem(LEGACY_STORAGE_KEYS.state, 'payload');

  migrateStorageKeys(storage, MAPPING);
  assert.deepEqual(migrateStorageKeys(storage, MAPPING), [], 'second run should be a no-op');
  assert.equal(storage.getItem(STORAGE_KEYS.state), 'payload');
});

test('nothing happens when there is no legacy data', () => {
  const storage = createMemoryStorage();
  assert.deepEqual(migrateStorageKeys(storage, MAPPING), []);
  assert.equal(storage.getItem(STORAGE_KEYS.state), null);
});

test('unreadable storage is tolerated', () => {
  const storage = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {},
    removeItem: () => {},
  };
  assert.deepEqual(migrateStorageKeys(storage, MAPPING), []);
  assert.deepEqual(migrateStorageKeys(null, MAPPING), []);
});

test('the legacy key names really are the pre-rename ones', () => {
  // Guards the guard: if someone renames these again, the migration silently
  // stops matching what is actually in visitors' browsers.
  assert.equal(LEGACY_STORAGE_KEYS.state, 'gitbooklet:state');
  assert.equal(LEGACY_STORAGE_KEYS.vault, 'gitbooklet:vault');
  assert.equal(STORAGE_KEYS.state, 'gitbinder:state');
  assert.equal(STORAGE_KEYS.vault, 'gitbinder:vault');
});

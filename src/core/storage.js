/**
 * Storage adapters.
 *
 * The app must keep working when `localStorage` is unavailable (private
 * browsing in some browsers, embedded webviews, storage quota disabled),
 * so every consumer goes through `resolveStorage()` and gets either the real
 * thing or an in-memory stand-in with the same interface.
 *
 * @module core/storage
 */

/** Minimal Storage-compatible fallback that lives only for the page lifetime. */
export function createMemoryStorage() {
  /** @type {Map<string, string>} */
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(String(key)) ? map.get(String(key)) : null),
    setItem: (key, value) => void map.set(String(key), String(value)),
    removeItem: (key) => void map.delete(String(key)),
    clear: () => map.clear(),
    /** Non-standard marker so callers can warn the user that data won't persist. */
    isMemoryOnly: true,
  };
}

/**
 * @returns {Storage & { isMemoryOnly?: boolean }} a usable storage object
 */
export function resolveStorage(global = globalThis) {
  try {
    const storage = global.localStorage;
    if (!storage) throw new Error('localStorage missing');
    // Safari throws on *write* when storage is blocked, so probe it.
    const probe = '__gitbooklet_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return createMemoryStorage();
  }
}

/** Approximate free space check — returns bytes currently used by our keys. */
export function storageUsage(storage, prefix = 'gitbooklet:') {
  let bytes = 0;
  let entries = 0;
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      entries += 1;
      // UTF-16 code units ≈ 2 bytes per char in most browser implementations.
      bytes += (key.length + (storage.getItem(key)?.length ?? 0)) * 2;
    }
  } catch {
    /* ignore — this is informational only */
  }
  return { bytes, entries };
}

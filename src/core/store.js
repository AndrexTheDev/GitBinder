/**
 * Reactive, persisting store.
 *
 * Design goals, in order:
 *   1. **Predictable** — plain objects in, plain objects out. No reducers, no
 *      middleware ceremony for a tool this size.
 *   2. **Reactive** — a deep Proxy notifies subscribers with the changed dot
 *      path, so a component can listen to `repoOverrides` only and ignore the
 *      rest of the tree.
 *   3. **Durable** — writes are debounced into localStorage, flushed on
 *      `pagehide`, and survive a browser crash mid-session.
 *   4. **Portable** — the whole state exports to / imports from a JSON file.
 *   5. **Safe** — secret fields are sealed before they touch disk (see core/vault).
 *   6. **Testable** — storage is injected, so the same code runs in Node.
 *
 * @module core/store
 */

import { clone, deepMerge, isEqual, isPlainObject, pathMatchesPrefix } from '../utils/object.js';
import { resolveStorage } from './storage.js';

/** @typedef {{ segments: string[], path: string, value: any, previous: any, source: string }} StoreChange */

/**
 * @param {object} [config]
 * @param {string}   [config.name='store']        label used in logs
 * @param {object}   [config.defaults={}]         initial shape
 * @param {(raw:any)=>any} [config.sanitize]      validate/normalise on every write
 * @param {(data:any, from:number, to:number)=>any} [config.migrate]
 * @param {number}   [config.version=1]           schema version persisted in the envelope
 * @param {string|null} [config.storageKey=null]  `null` disables persistence entirely
 * @param {Storage}  [config.storage]             injected adapter (tests / memory fallback)
 * @param {(data:any)=>any} [config.encode]       applied right before writing to disk
 * @param {(data:any)=>any} [config.decode]       applied right after reading from disk
 * @param {(data:any)=>any} [config.redact]       applied to exported files (secrets removed)
 * @param {number}   [config.persistDelay=150]    debounce window in ms
 * @param {boolean}  [config.crossTab=true]       re-hydrate from other tabs
 * @param {(error:Error)=>void} [config.onError]
 */
export function createStore(config = {}) {
  const {
    name = 'store',
    defaults = {},
    sanitize = (value) => value,
    migrate,
    version = 1,
    storageKey = null,
    storage = storageKey ? resolveStorage() : null,
    encode = (data) => data,
    decode = (data) => data,
    redact = (data) => data,
    persistDelay = 150,
    crossTab = true,
    onError = (error) => console.error(`[store:${name}]`, error),
  } = config;

  const persist = Boolean(storageKey && storage);

  /* ------------------------------------------------------------------ *
   * Reactivity core
   * ------------------------------------------------------------------ */

  /** @type {Set<{ fn: Function, filter: string[]|null }>} */
  const listeners = new Set();
  /** @type {StoreChange[]} */
  let pending = [];
  let depth = 0;
  let persistTimer = null;
  let lastFlushCount = 0;
  /** Set while hydrating from an external source (import / other tab) so the
   *  resulting notification does not bounce a write straight back to disk. */
  let persistSuppressed = false;
  /** @type {any} */
  let state;

  const proxyCache = new WeakMap();

  function emit(segments, value, previous, source = 'local') {
    pending.push({ segments, path: segments.join('.'), value, previous, source });
    if (depth === 0) flush();
  }

  /** Collapse repeated writes to the same path into one notification. */
  function dedupe(changes) {
    if (changes.length < 2) return changes;
    /** @type {Map<string, StoreChange>} */
    const byPath = new Map();
    const order = [];
    for (const change of changes) {
      const existing = byPath.get(change.path);
      if (existing) {
        existing.value = change.value;
        existing.source = change.source;
      } else {
        byPath.set(change.path, { ...change });
        order.push(change.path);
      }
    }
    return order.map((path) => byPath.get(path));
  }

  function flush() {
    if (pending.length === 0) {
      lastFlushCount = 0;
      return 0;
    }
    const changes = dedupe(pending);
    pending = [];
    lastFlushCount = changes.length;

    for (const listener of [...listeners]) {
      const relevant = listener.filter
        ? changes.filter((change) => listener.filter.some((f) => pathMatchesPrefix(change.path, f)))
        : changes;
      if (relevant.length === 0) continue;
      try {
        listener.fn(relevant, state);
      } catch (error) {
        onError(error);
      }
    }

    schedulePersist();
    return changes.length;
  }

  function wrap(target, path) {
    if (!target || typeof target !== 'object') return target;
    if (target instanceof Date || target instanceof RegExp) return target;
    if (typeof File !== 'undefined' && target instanceof File) return target;
    if (typeof Blob !== 'undefined' && target instanceof Blob) return target;

    const cached = proxyCache.get(target);
    if (cached) return cached;

    const proxy = new Proxy(target, {
      get(raw, key, receiver) {
        const value = Reflect.get(raw, key, receiver);
        if (typeof key === 'symbol') return value;
        return wrap(value, [...path, key]);
      },
      set(raw, key, value, receiver) {
        if (typeof key === 'symbol') return Reflect.set(raw, key, value, receiver);
        const previous = raw[key];
        if (isEqual(previous, value)) return true;
        const ok = Reflect.set(raw, key, value, receiver);
        if (ok) emit([...path, String(key)], value, previous);
        return ok;
      },
      deleteProperty(raw, key) {
        if (!(key in raw)) return true;
        const previous = raw[key];
        const ok = Reflect.deleteProperty(raw, key);
        if (ok) emit([...path, String(key)], undefined, previous);
        return ok;
      },
    });

    proxyCache.set(target, proxy);
    return proxy;
  }

  /* ------------------------------------------------------------------ *
   * Persistence
   * ------------------------------------------------------------------ */

  function buildEnvelope(data) {
    return {
      $schema: 'gitbinder/state',
      name,
      version,
      updatedAt: new Date().toISOString(),
      data,
    };
  }

  function restore() {
    if (!persist) return {};
    try {
      const raw = storage.getItem(storageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!isPlainObject(parsed)) return {};

      // Tolerate a bare state object (hand-edited or imported without envelope).
      const envelope = isPlainObject(parsed.data) ? parsed : { version: 0, data: parsed };
      let data = envelope.data;
      const from = Number(envelope.version ?? 0);
      if (typeof migrate === 'function' && from !== version) {
        data = migrate(clone(data), from, version) ?? data;
      }
      return decode(clone(data)) ?? {};
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
      return {};
    }
  }

  function persistNow() {
    if (!persist) return false;
    if (persistTimer !== null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    try {
      const data = encode(clone(root));
      storage.setItem(storageKey, JSON.stringify(buildEnvelope(data)));
      return true;
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  function schedulePersist() {
    if (!persist || persistSuppressed) return;
    if (persistTimer !== null) clearTimeout(persistTimer);
    persistTimer = setTimeout(persistNow, persistDelay);
  }

  /* ------------------------------------------------------------------ *
   * Root state
   * ------------------------------------------------------------------ */

  const root = sanitize(deepMerge(clone(defaults), restore())) ?? {};
  state = wrap(root, []);

  /* ------------------------------------------------------------------ *
   * Public API
   * ------------------------------------------------------------------ */

  /**
   * Group mutations so subscribers (and disk writes) fire once.
   * @returns {number} how many distinct paths changed
   */
  function batch(mutator) {
    depth += 1;
    try {
      mutator?.(state);
    } finally {
      depth -= 1;
      if (depth === 0) flush();
    }
    return lastFlushCount;
  }

  const toSegments = (path) => (Array.isArray(path) ? path.map(String) : String(path).split('.'));

  /** Read a nested value: `store.get('repoOverrides.owner/name.visible')` */
  function get(path) {
    if (path == null || path === '') return state;
    let cursor = state;
    for (const segment of toSegments(path)) {
      if (cursor == null) return undefined;
      cursor = cursor[segment];
    }
    return cursor;
  }

  /** Write a nested value, creating intermediate objects as needed. */
  function set(path, value) {
    const segments = toSegments(path);
    if (segments.length === 0) return;
    return batch(() => {
      let cursor = state;
      for (const segment of segments.slice(0, -1)) {
        if (!isPlainObject(cursor[segment]) && !Array.isArray(cursor[segment])) cursor[segment] = {};
        cursor = cursor[segment];
      }
      cursor[segments.at(-1)] = value;
    });
  }

  /**
   * Subscribe to changes.
   * `store.subscribe(cb)` — everything
   * `store.subscribe('repoOverrides', cb)` — that subtree only
   * `store.subscribe(['language', 'customBookTitle'], cb)` — several paths
   * @returns {() => void} disposer
   */
  function subscribe(pathOrListener, maybeListener) {
    const fn = typeof pathOrListener === 'function' ? pathOrListener : maybeListener;
    const filter =
      typeof pathOrListener === 'function'
        ? null
        : (Array.isArray(pathOrListener) ? pathOrListener : [pathOrListener]).map(String);
    if (typeof fn !== 'function') return () => {};

    const entry = { fn, filter };
    listeners.add(entry);
    return () => listeners.delete(entry);
  }

  /**
   * Merge `input` into the state (or replace it wholesale) and re-sanitise.
   * Guarantees at least one notification so views can re-sync.
   */
  function hydrate(input, options = {}) {
    const { replace = false, source = 'hydrate', persist: shouldPersist = true } = options;
    const base = replace ? {} : clone(root);
    const next = sanitize(deepMerge(clone(defaults), base, isPlainObject(input) ? input : {})) ?? {};

    persistSuppressed = !shouldPersist;
    try {
      const changed = batch(() => {
        for (const key of Object.keys(root)) {
          if (!(key in next)) delete state[key];
        }
        for (const [key, value] of Object.entries(next)) {
          state[key] = value;
        }
      });

      if (changed === 0) {
        // Nothing structurally differed, but callers still expect a sync signal.
        pending.push({ segments: [], path: '*', value: clone(next), previous: undefined, source });
        flush();
      }
    } finally {
      persistSuppressed = false;
    }

    if (shouldPersist) schedulePersist();
    return clone(next);
  }

  /** Back to factory defaults (and persist that). */
  function reset() {
    return hydrate(clone(defaults), { replace: true, source: 'reset' });
  }

  /** Plain, secret-free-in-plaintext snapshot of the current state. */
  function toJSON() {
    return clone(root);
  }

  /**
   * Serializable envelope for the "Export settings" button.
   *
   * Secrets are **removed** unless the caller explicitly opts in: a downloaded
   * JSON file is far easier to leak than localStorage, and a sealed token would
   * be useless on any other device anyway.
   */
  function exportJSON({ includeSecrets = false } = {}) {
    const data = includeSecrets ? clone(root) : redact(clone(root));
    return buildEnvelope(data);
  }

  /**
   * Accept either a full envelope (our own export) or a bare state object
   * (hand-written config). Returns a summary so the UI can explain what happened.
   */
  function importJSON(payload, { merge = false } = {}) {
    const warnings = [];
    let input = payload;

    if (isPlainObject(payload) && isPlainObject(payload.data)) {
      if (payload.$schema && payload.$schema !== 'gitbinder/state') {
        warnings.push(`unexpected-schema:${payload.$schema}`);
      }
      const from = Number(payload.version ?? 0);
      input = payload.data;
      if (typeof migrate === 'function' && from !== version) {
        input = migrate(clone(input), from, version) ?? input;
        warnings.push(`migrated:${from}->${version}`);
      }
    } else if (!isPlainObject(payload)) {
      return { ok: false, warnings: ['invalid-payload'], state: toJSON() };
    }

    const decoded = decode(clone(input));
    hydrate(decoded, { replace: !merge, source: 'import' });
    return { ok: true, warnings, state: toJSON() };
  }

  /** Wipe persisted data (used by "Clear local data"). */
  function clearStorage() {
    if (!persist) return;
    try {
      storage.removeItem(storageKey);
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /** Byte size of the persisted payload — shown in the footer. */
  function storageInfo() {
    if (!persist) return { bytes: 0, persisted: false, memoryOnly: Boolean(storage?.isMemoryOnly) };
    let bytes = 0;
    try {
      const raw = storage.getItem(storageKey);
      bytes = raw ? raw.length * 2 : 0;
    } catch {
      bytes = 0;
    }
    return { bytes, persisted: true, memoryOnly: Boolean(storage?.isMemoryOnly) };
  }

  /* ------------------------------------------------------------------ *
   * Cross-tab sync + crash-safe flushing
   * ------------------------------------------------------------------ */

  /** @type {Array<() => void>} */
  const disposers = [];

  if (persist && typeof window !== 'undefined') {
    if (crossTab) {
      const onStorage = (event) => {
        if (event.key !== storageKey || event.newValue == null) return;
        try {
          const parsed = JSON.parse(event.newValue);
          const data = isPlainObject(parsed?.data) ? parsed.data : parsed;
          hydrate(decode(clone(data)), {
            replace: true,
            source: 'storage',
            persist: false,
          });
        } catch (error) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
      };
      window.addEventListener('storage', onStorage);
      disposers.push(() => window.removeEventListener('storage', onStorage));
    }

    const onPageHide = () => persistNow();
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') persistNow();
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    disposers.push(() => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  function destroy() {
    for (const dispose of disposers.splice(0)) dispose();
    listeners.clear();
    pending = [];
    persistNow();
  }

  return {
    /** Reactive proxy — read and write directly (`state.language = 'de'`). */
    state,
    get,
    set,
    update: batch,
    batch,
    subscribe,
    hydrate,
    reset,
    toJSON,
    exportJSON,
    importJSON,
    clearStorage,
    persistNow,
    storageInfo,
    destroy,
    meta: { name, version, persist, storageKey },
  };
}

/** @typedef {ReturnType<typeof createStore>} Store */

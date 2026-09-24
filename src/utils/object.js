/**
 * Small, dependency-free object helpers shared by the store, the i18n engine
 * and the components. Everything here is pure and unit-testable in Node.
 *
 * @module utils/object
 */

/** @returns {boolean} true for `{}`-like objects (not arrays, not class instances). */
export function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Values we never want to walk into with the reactive proxy or the merger. */
function isOpaque(value) {
  return (
    value instanceof Date ||
    value instanceof RegExp ||
    (typeof File !== 'undefined' && value instanceof File) ||
    (typeof Blob !== 'undefined' && value instanceof Blob) ||
    (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer)
  );
}

/** Deep, structured clone that tolerates Dates and circular-free plain data. */
export function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value instanceof Date) return new Date(value.getTime());
  if (!isPlainObject(value)) return value;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = clone(v);
  return out;
}

/**
 * Deep structural equality for JSON-ish data.
 * Used to suppress no-op store notifications (and therefore no-op re-renders).
 */
export function isEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => isEqual(item, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => Object.prototype.hasOwnProperty.call(b, k) && isEqual(a[k], b[k]));
  }
  return false;
}

/**
 * Immutable-ish deep merge: later sources win, plain objects are merged
 * recursively, arrays and scalars are replaced wholesale.
 *
 * @param {...unknown} sources
 * @returns {any} a fresh object (the first argument is used as the base if provided)
 */
export function deepMerge(base, ...sources) {
  let target = isPlainObject(base) || Array.isArray(base) ? base : {};
  for (const source of sources) {
    if (!isPlainObject(source)) continue;
    for (const [key, value] of Object.entries(source)) {
      const current = target[key];
      if (isPlainObject(value) && isPlainObject(current) && !isOpaque(value)) {
        target[key] = deepMerge(clone(current), value);
      } else if (isPlainObject(value)) {
        target[key] = deepMerge({}, value);
      } else if (Array.isArray(value)) {
        target[key] = value.map(clone);
      } else if (value !== undefined) {
        target[key] = value;
      }
    }
  }
  return target;
}

/**
 * Read a nested value by dot path.
 * `getPath(state, 'repoOverrides.foo/bar.visible')`
 */
export function getPath(target, path, fallback = undefined) {
  if (!path) return target;
  const segments = Array.isArray(path) ? path : String(path).split('.');
  let cursor = target;
  for (const segment of segments) {
    if (cursor == null) return fallback;
    cursor = cursor[segment];
  }
  return cursor === undefined ? fallback : cursor;
}

/** True when `path` is equal to, or nested inside, `prefix` (segment aware). */
export function pathMatchesPrefix(path, prefix) {
  if (!prefix || prefix === '*') return true;
  if (path === prefix) return true;
  return path.startsWith(`${prefix}.`);
}

/** @returns {Record<string, unknown>} a shallow copy without the given keys. */
export function omit(object, keys) {
  const skip = new Set(keys);
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, v] of Object.entries(object ?? {})) if (!skip.has(k)) out[k] = v;
  return out;
}

/** @returns {Record<string, unknown>} a shallow copy with only the given keys. */
export function pick(object, keys) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of keys) if (object && key in object) out[key] = object[key];
  return out;
}

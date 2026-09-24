/**
 * State composition root.
 *
 * Wires together: storage adapter → vault (token obfuscation) → codec →
 * persisted settings store → in-memory session store → translator, and keeps
 * `state.language` and the i18n locale pointing at each other without loops.
 *
 * Everything else in the app receives this context object; no module reaches
 * into `localStorage` directly.
 *
 * @module state
 */

import { createStore } from '../core/store.js';
import { createVault } from '../core/vault.js';
import { createEmitter } from '../core/events.js';
import { resolveStorage } from '../core/storage.js';
import { createTranslator } from '../i18n/index.js';
import { STATE_SCHEMA_VERSION, STORAGE_KEYS } from '../config/app.js';
import { createCodec } from './codec.js';
import {
  createDefaultSession,
  createDefaultState,
  migrateState,
  sanitizeSession,
  sanitizeState,
} from './schema.js';

/**
 * @param {{ storage?: Storage, onError?: (error: Error) => void }} [options]
 */
export function createAppContext(options = {}) {
  const storage = options.storage ?? resolveStorage();
  const onError = options.onError ?? ((error) => console.error('[gitbooklet]', error));

  const vault = createVault({ storage, key: STORAGE_KEYS.vault });
  const codec = createCodec({ vault });
  const bus = createEmitter();

  /* ── Persisted settings ─────────────────────────────────────────────── */
  const settings = createStore({
    name: 'settings',
    defaults: createDefaultState(),
    sanitize: sanitizeState,
    migrate: migrateState,
    version: STATE_SCHEMA_VERSION,
    storageKey: STORAGE_KEYS.state,
    storage,
    encode: codec.encode,
    decode: codec.decode,
    redact: codec.redact,
    onError,
  });

  /* ── Transient session (fetched repositories, progress, errors) ─────── */
  const session = createStore({
    name: 'session',
    defaults: createDefaultSession(),
    sanitize: sanitizeSession,
    storageKey: null, // memory only: a re-fetch is cheaper than the localStorage
    onError,
  });

  /* ── Translator, bound to the persisted language ────────────────────── */
  const i18n = createTranslator({ locale: settings.state.language });

  // store → i18n (covers boot, settings drawer, imports and cross-tab sync)
  settings.subscribe('language', () => {
    i18n.setLocale(settings.state.language);
  });

  // i18n → store (covers anything that calls `i18n.setLocale()` directly).
  // `setLocale` is idempotent, so this ping-pong settles after one hop.
  i18n.onChange((locale) => {
    if (settings.state.language !== locale) settings.set('language', locale);
  });

  /** Shorthand bound to the active locale. */
  const t = (key, params, opts) => i18n.t(key, params, opts);

  return {
    storage,
    vault,
    codec,
    bus,
    settings,
    session,
    i18n,
    t,
    onError,
  };
}

/** @typedef {ReturnType<typeof createAppContext>} AppContext */

export * from './schema.js';
export * from './selectors.js';
export { createCodec, SECRET_FIELDS } from './codec.js';

/**
 * Storage codec: what goes to disk, what comes back, what may be exported.
 *
 * Three transforms, all applied by the store at its persistence boundary:
 *
 *   encode(data)  → secrets are sealed (see core/vault.js) before `setItem`
 *   decode(data)  → seals are opened after `getItem`; values sealed on another
 *                   device resolve to `''` instead of garbage
 *   redact(data)  → secrets removed entirely; used for exported JSON files,
 *                   because a download is far easier to leak than localStorage
 *
 * @module state/codec
 */

import { clone } from '../utils/object.js';
import { createVault } from '../core/vault.js';

/** State fields that must never be written to disk in plain text. */
export const SECRET_FIELDS = Object.freeze(['personalAccessToken']);

/**
 * @param {{ vault?: ReturnType<typeof createVault> }} [options]
 */
export function createCodec(options = {}) {
  const vault = options.vault ?? createVault();

  /** Apply to data immediately before it is serialised to localStorage. */
  function encode(data) {
    const out = clone(data ?? {});
    for (const field of SECRET_FIELDS) {
      const value = out[field];
      if (typeof value === 'string' && value.length > 0) out[field] = vault.seal(value);
    }
    return out;
  }

  /** Apply to data immediately after it is parsed from localStorage. */
  function decode(data) {
    const out = clone(data ?? {});
    for (const field of SECRET_FIELDS) {
      const value = out[field];
      if (typeof value !== 'string' || value.length === 0) {
        out[field] = '';
        continue;
      }
      out[field] = vault.open(value);
    }
    return out;
  }

  /** Strip secrets — safe payload for a downloaded settings file. */
  function redact(data) {
    const out = clone(data ?? {});
    for (const field of SECRET_FIELDS) {
      if (field in out) out[field] = '';
    }
    return out;
  }

  return { encode, decode, redact, vault, SECRET_FIELDS };
}

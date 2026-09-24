/**
 * Local "vault" — lightweight obfuscation for the optional Personal Access Token.
 *
 * ── Threat model, stated honestly ────────────────────────────────────────────
 * Anything a browser page can read, a browser page can read. There is **no**
 * way to store a secret in localStorage such that JavaScript running on the
 * same origin cannot recover it. What this module does provide:
 *
 *   1. The token never sits in localStorage in plain text, so shoulder-surfing
 *      devtools, casual screenshots and exported settings files do not leak it.
 *   2. The obfuscation key is generated per browser profile and stored under a
 *      *separate* key, so sealed values are not portable between devices and
 *      are dropped (not corrupted) if the key is missing.
 *   3. An integrity checksum detects a wrong/missing key and yields `''`
 *      instead of garbage being sent to the GitHub API.
 *
 * This is XOR + a keyed stream + checksum, i.e. obfuscation, **not encryption**.
 * The UI says exactly that in the settings drawer.
 *
 * @module core/vault
 */

import { resolveStorage } from './storage.js';

const SEAL_PREFIX = 'enc:v1:';
const VAULT_STORAGE_KEY = 'gitbooklet:vault';
const MAGIC = [0xa7, 0x5c];

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 32-bit FNV-1a, used as a cheap integrity check on sealed payloads. */
function fnv1a(bytes) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function randomKey() {
  const bytes = new Uint8Array(32);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return bytesToBase64(bytes);
}

/**
 * Deterministic pseudo-random stream derived from the device key.
 * Not a CSPRNG — again: obfuscation, so a token is never stored verbatim.
 */
function keystream(length, keyBytes) {
  const out = new Uint8Array(length);
  let state = 0x9e3779b9;
  for (let i = 0; i < length; i += 1) {
    state = (Math.imul(state ^ keyBytes[i % keyBytes.length], 0x85ebca6b) + i) >>> 0;
    out[i] = (state ^ (state >>> 13)) & 0xff;
  }
  return out;
}

/**
 * @param {{ storage?: Storage, key?: string }} [options]
 */
export function createVault(options = {}) {
  const storage = options.storage ?? resolveStorage();
  const storageKey = options.key ?? VAULT_STORAGE_KEY;
  /** @type {Uint8Array|null} */
  let cached = null;

  function deviceKey() {
    if (cached) return cached;
    let stored = null;
    try {
      stored = storage.getItem(storageKey);
    } catch {
      stored = null;
    }
    if (!stored) {
      stored = randomKey();
      try {
        storage.setItem(storageKey, stored);
      } catch {
        /* memory-only storage: the key survives for this page load, which is fine */
      }
    }
    cached = base64ToBytes(stored);
    return cached;
  }

  /** @returns {string} `''` for empty input, otherwise `enc:v1:<base64>` */
  function seal(plain) {
    const text = String(plain ?? '');
    if (!text) return '';
    const key = deviceKey();
    const payload = new TextEncoder().encode(text);
    const checksum = fnv1a(payload);
    const stream = keystream(payload.length, key);

    const out = new Uint8Array(MAGIC.length + 4 + payload.length);
    out.set(MAGIC, 0);
    out[2] = (checksum >>> 24) & 0xff;
    out[3] = (checksum >>> 16) & 0xff;
    out[4] = (checksum >>> 8) & 0xff;
    out[5] = checksum & 0xff;
    for (let i = 0; i < payload.length; i += 1) out[MAGIC.length + 4 + i] = payload[i] ^ stream[i];

    return SEAL_PREFIX + bytesToBase64(out);
  }

  /**
   * Recover a sealed value. Accepts plain text (imported settings, legacy data)
   * and returns `''` when the checksum does not match — i.e. when the value was
   * sealed on another device.
   */
  function open(sealed) {
    const value = String(sealed ?? '');
    if (!value) return '';
    if (!value.startsWith(SEAL_PREFIX)) return value;

    try {
      const key = deviceKey();
      const raw = base64ToBytes(value.slice(SEAL_PREFIX.length));
      if (raw.length < MAGIC.length + 5) return '';
      if (raw[0] !== MAGIC[0] || raw[1] !== MAGIC[1]) return '';

      const expected =
        ((raw[2] << 24) | (raw[3] << 16) | (raw[4] << 8) | raw[5]) >>> 0;
      const body = raw.subarray(MAGIC.length + 4);
      const stream = keystream(body.length, key);
      const payload = new Uint8Array(body.length);
      for (let i = 0; i < body.length; i += 1) payload[i] = body[i] ^ stream[i];
      if (fnv1a(payload) !== expected) return '';
      return new TextDecoder().decode(payload);
    } catch (error) {
      console.warn('[vault] could not open sealed value', error);
      return '';
    }
  }

  const isSealed = (value) => String(value ?? '').startsWith(SEAL_PREFIX);

  /** Forget the device key — every sealed value becomes unrecoverable. */
  function destroy() {
    try {
      storage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    cached = null;
  }

  return { seal, open, isSealed, destroy };
}

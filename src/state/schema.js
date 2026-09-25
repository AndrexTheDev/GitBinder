/**
 * State schema: defaults, validation and migrations.
 *
 * Two stores are used by the app (see ./index.js):
 *
 *   • **settings** — persisted to localStorage. Everything the visitor
 *     configured and wants to keep: identity, book metadata, language and the
 *     per-repository overrides.
 *   • **session** — memory only. Transient results of the last GitHub fetch.
 *     Re-fetching is cheap and this keeps localStorage small and predictable.
 *
 * `sanitizeState()` runs on *every* write (boot, hydrate, import, cross-tab),
 * so a hand-edited or corrupted payload can never put the UI into an invalid
 * state.
 *
 * @module state/schema
 */

import { isPlainObject } from '../utils/object.js';
import { REPO_STATUS_IDS } from '../config/app.js';
import { BOOK_LIMITS } from '../config/book.js';
import { migrateLegacyStatus } from '../services/status.js';
import { detectInitialLanguage, SUPPORTED_LANGUAGES } from '../i18n/index.js';

/* -------------------------------------------------------------------------- *
 * Defaults required by the product spec
 * -------------------------------------------------------------------------- */

export const DEFAULT_BOOK_TITLE = 'My Software Engineering Anthology';
export const DEFAULT_AUTHOR_NAME = 'AndrexTheDev';
export const DEFAULT_AUTHOR_EMAIL = 'hippie.highho@gmail.com';

/** Sort orders offered in the library toolbar. */
export const LIBRARY_SORTS = Object.freeze(['status', 'updated', 'name']);
export const DEFAULT_LIBRARY_SORT = 'status';

/** Kept in sync with the `maxlength` on the description textarea. */
export const DESCRIPTION_MAX_LENGTH = 200;

/** Field length clamps — also our first line of defence against localStorage bloat. */
const LIMITS = Object.freeze({
  githubUsername: 39, // GitHub's own limit
  personalAccessToken: 255,
  customBookTitle: 160,
  authorName: 120,
  authorEmail: 254, // RFC 5321
  authorBio: 280, // one cover paragraph; anything longer gets clipped in print
  shortDescription: 200,
});

/* -------------------------------------------------------------------------- *
 * Helpers
 * -------------------------------------------------------------------------- */

/** Collapse runs of whitespace, trim, clamp length. */
function text(value, { fallback = '', max = 512, collapse = true } = {}) {
  if (typeof value !== 'string') return fallback;
  const normalized = collapse ? value.replace(/\s+/g, ' ').trim() : value.trim();
  if (!normalized) return fallback;
  return normalized.slice(0, max);
}

/** Tokens are opaque strings: trim ends only, never touch the payload. */
function secret(value) {
  return typeof value === 'string' ? value.trim().slice(0, LIMITS.personalAccessToken) : '';
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/* -------------------------------------------------------------------------- *
 * Repository overrides
 * -------------------------------------------------------------------------- */

/**
 * One curated entry per repository.
 *
 * `status` and `shortDescription` are **`null` while untouched**: the value
 * shown in the UI is then derived from the live repository metadata by
 * `services/status.js`. Only once the visitor edits a field do we store their
 * choice, which keeps auto-detection honest over time — a project that goes a
 * year without a commit becomes "Paused" on its own instead of staying
 * frozen at whatever it was the day it was first fetched.
 *
 * @typedef {object} RepoOverride
 * @property {boolean} visible             included in the printed book
 * @property {string|null} status          one of `REPO_STATUS_IDS`, or null = auto
 * @property {string|null} shortDescription chapter summary, or null = use GitHub's
 * @property {string|null} updatedAt       ISO timestamp of the last manual edit
 */

/**
 * `repoOverrides` is keyed by the repository's full name (`owner/repo`).
 * That is GitHub's stable, human-readable identifier — far nicer to review in
 * an exported JSON file than a numeric database id.
 */
/** Longest personal note, mirrored into `BOOK_LIMITS.notesChars`. */
export const NOTES_MAX_LENGTH = BOOK_LIMITS.notesChars;

export function sanitizeRepoOverrides(raw) {
  /** @type {Record<string, RepoOverride>} */
  const out = {};
  if (!isPlainObject(raw)) return out;

  for (const [key, entry] of Object.entries(raw)) {
    const slug = String(key ?? '').trim();
    // A slug must look like `owner/repo`; anything else is dropped.
    if (!slug || !slug.includes('/') || slug.length > 200) continue;
    if (!isPlainObject(entry)) continue;

    out[slug] = {
      visible: entry.visible !== false,
      // `null` keeps auto-detection alive; legacy ids are translated first so a
      // book curated before the taxonomy changed survives the upgrade.
      status: oneOf(migrateLegacyStatus(entry.status), REPO_STATUS_IDS, null),
      // Trim the ends but keep internal line breaks — this is a textarea.
      shortDescription:
        typeof entry.shortDescription === 'string'
          ? text(entry.shortDescription, { max: LIMITS.shortDescription, collapse: false })
          : null,
      /**
       * The visitor's own notes for this project.
       *
       * Deliberately user-owned and never derived from GitHub: a re-fetch
       * must not touch it, and there is no "detect notes" step that could
       * overwrite what somebody typed. `null` means "never filled in", which
       * is what tells the book to print an empty, writable block instead of
       * a heading with nothing under it.
       */
      notes:
        typeof entry.notes === 'string'
          ? text(entry.notes, { max: BOOK_LIMITS.notesChars, collapse: false })
          : null,
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : null,
    };
  }
  return out;
}

/* -------------------------------------------------------------------------- *
 * Settings state (persisted)
 * -------------------------------------------------------------------------- */

/**
 * @param {Partial<Record<string, unknown>>} [overrides]
 * @returns {object} a fresh default state object
 */
export function createDefaultState(overrides = {}) {
  return {
    // ── GitHub connection ────────────────────────────────────────────────
    githubUsername: '',
    /** Optional; only required for private repositories. Sealed before it hits disk. */
    personalAccessToken: '',

    // ── Book metadata ───────────────────────────────────────────────────
    customBookTitle: DEFAULT_BOOK_TITLE,
    authorName: DEFAULT_AUTHOR_NAME,
    authorEmail: DEFAULT_AUTHOR_EMAIL,
    authorBio: '',

    // ── Interface ───────────────────────────────────────────────────────
    /** Auto-detected from the browser on first run, then sticky. */
    language: detectInitialLanguage(),

    // ── Curation ────────────────────────────────────────────────────────
    /** @type {Record<string, RepoOverride>} */
    repoOverrides: {},

    // ── Persisted view preferences (not part of the spec, but cheap and handy)
    library: {
      sort: DEFAULT_LIBRARY_SORT,
      /** Forks are noise for most portfolios, but "off" keeps them one click away. */
      hideForks: false,
    },
    book: {
      /** Whether the live PDF preview is expanded. */
      preview: false,
    },

    ...overrides,
  };
}

/**
 * Validate + normalise the persisted state shape.
 * Unknown keys are dropped, missing keys are filled from the defaults.
 */
export function sanitizeState(raw) {
  const input = isPlainObject(raw) ? raw : {};
  const defaults = createDefaultState();

  const language = oneOf(
    typeof input.language === 'string' ? input.language.toLowerCase() : '',
    SUPPORTED_LANGUAGES,
    detectInitialLanguage(),
  );

  const library = isPlainObject(input.library) ? input.library : {};

  return {
    githubUsername: text(input.githubUsername, { max: LIMITS.githubUsername }),
    personalAccessToken: secret(input.personalAccessToken),
    customBookTitle: text(input.customBookTitle, {
      fallback: DEFAULT_BOOK_TITLE,
      max: LIMITS.customBookTitle,
    }),
    authorName: text(input.authorName, { fallback: DEFAULT_AUTHOR_NAME, max: LIMITS.authorName }),
    authorEmail: text(input.authorEmail, {
      fallback: DEFAULT_AUTHOR_EMAIL,
      max: LIMITS.authorEmail,
      collapse: false,
    }),
    // Empty means "use the translated default on the cover", so a visitor who
    // never opens the settings drawer still gets a sensible bio line.
    authorBio: text(input.authorBio, { max: LIMITS.authorBio }),
    language,
    repoOverrides: sanitizeRepoOverrides(input.repoOverrides),
    library: {
      sort: oneOf(library.sort, LIBRARY_SORTS, defaults.library.sort),
      hideForks: library.hideForks === true,
    },
    book: {
      preview: isPlainObject(input.book) && input.book.preview === true,
    },
  };
}

/* -------------------------------------------------------------------------- *
 * Session state (memory only)
 * -------------------------------------------------------------------------- */

export const FETCH_STATES = Object.freeze(['idle', 'loading', 'ready', 'error']);

export function createDefaultSession() {
  return {
    /** @type {import('../services/github.js').NormalizedRepo[]} */
    repos: [],
    status: 'idle',
    /** @type {{ kind: string, message: string, status?: number, resetAt?: string }|null} */
    error: null,
    /** ISO timestamp of the last successful fetch. */
    fetchedAt: null,
    /** Username the current `repos` belong to (guards against stale results). */
    fetchedUsername: null,
    /** Which endpoint produced these repos — `user` (PAT) or `users` (public). */
    source: null,
    /** True when pagination hit the safety cap and the list is incomplete. */
    truncated: false,
    /** @type {{ limit: number, remaining: number, resetAt: string|null }|null} */
    rateLimit: null,
    /** Transient filter box — deliberately NOT persisted. */
    search: '',
    /** Progress text while paginating. */
    progress: null,
  };
}

export function sanitizeSession(raw) {
  const input = isPlainObject(raw) ? raw : {};
  const defaults = createDefaultSession();
  return {
    repos: Array.isArray(input.repos) ? input.repos : defaults.repos,
    status: oneOf(input.status, FETCH_STATES, defaults.status),
    error: isPlainObject(input.error) ? input.error : null,
    fetchedAt: typeof input.fetchedAt === 'string' ? input.fetchedAt : null,
    fetchedUsername: typeof input.fetchedUsername === 'string' ? input.fetchedUsername : null,
    source: input.source === 'user' || input.source === 'users' ? input.source : null,
    truncated: input.truncated === true,
    rateLimit: isPlainObject(input.rateLimit) ? input.rateLimit : null,
    search: typeof input.search === 'string' ? input.search : '',
    progress: typeof input.progress === 'string' ? input.progress : null,
  };
}

/* -------------------------------------------------------------------------- *
 * Migrations
 * -------------------------------------------------------------------------- */

/**
 * Keyed by the version being migrated *from*.
 * Bump `STATE_SCHEMA_VERSION` in config/app.js and add an entry here whenever
 * the persisted shape changes.
 *
 * @type {Record<number, (data: any) => any>}
 */
const MIGRATIONS = {
  // 0 → 1: first public schema. Accept anything and let sanitizeState() clean it.
  0: (data) => (isPlainObject(data) ? data : {}),
};

/** @returns {any} the migrated payload */
export function migrateState(data, from = 0, to = 1) {
  let current = isPlainObject(data) ? data : {};
  for (let version = Number(from) || 0; version < Number(to); version += 1) {
    const step = MIGRATIONS[version];
    if (typeof step === 'function') current = step(current) ?? current;
  }
  return current;
}

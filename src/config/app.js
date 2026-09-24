/**
 * Static, non-secret application configuration.
 * Anything that could differ between deployments lives here rather than
 * being scattered through components.
 *
 * @module config/app
 */

export const APP_NAME = 'GitBooklet';
export const APP_VERSION = '0.1.0';
export const APP_TAGLINE_KEY = 'meta.tagline';

/** localStorage keys — namespaced so multiple tools can coexist on one origin. */
export const STORAGE_KEYS = {
  /** Persisted user settings + repository overrides. */
  state: 'gitbooklet:state',
  /** Per-device key used to obfuscate the optional Personal Access Token. */
  vault: 'gitbooklet:vault',
};

/** Schema version of the persisted state envelope. Bump + add a migration. */
export const STATE_SCHEMA_VERSION = 1;

export const GITHUB = {
  apiBase: 'https://api.github.com',
  /** Repos per page — 100 is the GitHub maximum and minimises round trips. */
  perPage: 100,
  /** Hard stop so a pathological account cannot loop forever. */
  maxPages: 10,
  webBase: 'https://github.com',
  /** Scopes the optional token actually needs. Shown in the settings drawer. */
  requiredScopes: ['repo'],
  tokenDocsUrl: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens',
  scopeDocsUrl: 'https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps',
};

export const LINKS = {
  /** Live deployment. Printed in the book's running footer as attribution. */
  deployed: 'https://gitbooklet.pages.dev',
  repository: 'https://github.com/AndrexTheDev/GitBinder',
  issues: 'https://github.com/AndrexTheDev/GitBinder/issues',
  license: 'https://github.com/AndrexTheDev/GitBinder/blob/main/LICENSE',
  author: 'https://github.com/AndrexTheDev',
};

/**
 * Project statuses, in the order they appear in the book and in the override
 * dropdown: shipped work first, dormant work last.
 *
 * `tone` maps onto the `.badge--*` classes in styles/components.css.
 * Labels live under `status.<id>` in the dictionaries; the auto-detection
 * rules live in `services/status.js`.
 */
export const REPO_STATUSES = Object.freeze([
  { id: 'live', tone: 'forest' },
  { id: 'development', tone: 'azure' },
  { id: 'beta', tone: 'brass' },
  { id: 'paused', tone: 'neutral' },
]);

export const REPO_STATUS_IDS = Object.freeze(REPO_STATUSES.map((status) => status.id));

/** Chapter + sort ordering: live → development → beta → paused. */
export const STATUS_RANK = Object.freeze(
  Object.fromEntries(REPO_STATUSES.map((status, index) => [status.id, index])),
);

export const DEFAULT_STATUS = 'beta';

export const TONE_BY_STATUS = Object.freeze(
  Object.fromEntries(REPO_STATUSES.map((status) => [status.id, status.tone])),
);

/**
 * Statuses from the very first iteration of the app. Kept so a visitor who
 * already curated a book does not lose their work when the taxonomy changed.
 * @see services/status.js
 */
export const LEGACY_STATUS_MAP = Object.freeze({
  showcase: 'live',
  active: 'development',
  wip: 'development',
  experiment: 'beta',
  legacy: 'paused',
  archived: 'paused',
});

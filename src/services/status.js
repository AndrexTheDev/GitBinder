/**
 * Project status auto-detection engine.
 *
 * Turns the raw metadata GitHub gives us into one of the four chapter
 * statuses the book understands. Pure, synchronous, injectable `now` — so the
 * whole matrix is unit-testable without touching the network or the clock.
 *
 * ── Priority ──────────────────────────────────────────────────────────────
 *
 *   1. **Explicit topic** (`status-live`, `status-archived`, …) — the author's
 *      own declaration always wins over a guess.
 *   2. **`archived` / `disabled`** — GitHub's own "this is over" flag.
 *   3. **Homepage** — if it is deployed, it is live.
 *   4. **Recency** — touched within 30 days → In Development, otherwise
 *      Beta/MVP while it is still maintained, Paused once it goes dormant.
 *
 * Rule 3 before rule 4 is deliberate: a repo with a live homepage and no
 * commits for a year is still a *live* product, not a work in progress.
 *
 * Every result carries the reason it was chosen, so the UI can explain itself
 * ("detected from topic status-mvp") instead of presenting an unexplained
 * default the visitor has to trust.
 *
 * @module services/status
 */

import { DEFAULT_STATUS, LEGACY_STATUS_MAP } from '../config/app.js';

export const DAY_MS = 86_400_000;

/** "In Development": updated within this many days and no homepage. */
export const RECENT_DAYS = 30;
/** "Beta / MVP": still touched at least once within this window. */
export const MAINTAINED_DAYS = 365;

/**
 * Topic → status. Anything not listed here is ignored, so a repository can
 * carry whatever topics it likes without surprising side effects.
 */
export const STATUS_TOPICS = Object.freeze({
  'status-live': 'live',
  'status-mvp': 'beta',
  'status-beta': 'beta',
  'status-wip': 'development',
  'status-dev': 'development',
  'status-development': 'development',
  'status-paused': 'paused',
  'status-archived': 'paused',
});

/** Reason codes returned with every detection; they map to `status.reasons.*`. */
export const STATUS_REASONS = Object.freeze([
  'topic',
  'archived',
  'disabled',
  'homepage',
  'recent',
  'maintained',
  'dormant',
  'unknown',
  'manual',
]);

/** Whole days between `iso` and `now`. `null` when the date is unusable. */
export function daysSince(iso, now = Date.now()) {
  if (!iso) return null;
  const then = iso instanceof Date ? iso.getTime() : new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.floor((now - then) / DAY_MS);
}

/**
 * @typedef {object} StatusDetection
 * @property {string}  status            one of REPO_STATUS_IDS
 * @property {'auto'|'topic'|'manual'} source
 * @property {string}  reason            one of STATUS_REASONS
 * @property {string|null} detail        the matching topic, or the homepage URL
 * @property {number|null} days          days since the last update
 */

/**
 * Calculate the initial status of a repository.
 *
 * @param {object} repo              a normalized repo (see services/github.js)
 * @param {{ now?: number }} [options]
 * @returns {StatusDetection}
 */
export function detectStatus(repo, options = {}) {
  const now = options.now ?? Date.now();

  // 1. An explicit topic is the author telling us what this project is.
  const topic = findStatusTopic(repo?.topics);
  if (topic) {
    return { status: topic.status, source: 'topic', reason: 'topic', detail: topic.topic, days: daysSince(repo?.updatedAt, now) };
  }

  // 2. GitHub's own end-of-life flags.
  if (repo?.archived) return result('paused', 'archived', null, repo, now);
  if (repo?.disabled) return result('paused', 'disabled', null, repo, now);

  // 3. A deployed project is live, however old the last commit is.
  if (repo?.homepage) return result('live', 'homepage', String(repo.homepage), repo, now);

  // 4. Recency.
  const days = daysSince(repo?.updatedAt, now);
  if (days === null) return { status: DEFAULT_STATUS, source: 'auto', reason: 'unknown', detail: null, days: null };
  if (days < RECENT_DAYS) return { status: 'development', source: 'auto', reason: 'recent', detail: null, days };
  if (days <= MAINTAINED_DAYS) return { status: 'beta', source: 'auto', reason: 'maintained', detail: null, days };
  return { status: 'paused', source: 'auto', reason: 'dormant', detail: null, days };
}

function result(status, reason, detail, repo, now) {
  return { status, source: 'auto', reason, detail, days: daysSince(repo?.updatedAt, now) };
}

/**
 * Find the first `status-*` topic we recognise.
 * @param {string[]} [topics]
 * @returns {{ topic: string, status: string }|null}
 */
export function findStatusTopic(topics) {
  if (!Array.isArray(topics)) return null;
  for (const entry of topics) {
    const topic = String(entry ?? '').trim().toLowerCase();
    const status = STATUS_TOPICS[topic];
    if (status) return { topic, status };
  }
  return null;
}

/** True when a repository carries a topic that declares its status. */
export function hasStatusTopic(topics) {
  return findStatusTopic(topics) !== null;
}

/**
 * Translate a status written by an older version of the app.
 * Unknown values pass through so `sanitizeRepoOverrides()` can reject them.
 *
 * @param {string|null|undefined} value
 * @returns {string|null|undefined}
 */
export function migrateLegacyStatus(value) {
  if (value == null) return null;
  return LEGACY_STATUS_MAP[value] ?? value;
}

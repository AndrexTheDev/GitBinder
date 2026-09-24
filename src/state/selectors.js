/**
 * Derived state (selectors).
 *
 * Pure functions over `(settings, session)` — no store access, no DOM.
 * Components call these instead of hand-rolling filters, so the rules for
 * "what ends up in the book" live in exactly one place.
 *
 * @module state/selectors
 */

import { REPO_STATUS_IDS, STATUS_RANK, TONE_BY_STATUS } from '../config/app.js';
import { detectStatus } from '../services/status.js';

/**
 * A freshly fetched repository is included unless it is a fork — forks are
 * noise in a portfolio. The visitor can always flip the checkbox.
 */
export function defaultVisibility(repo) {
  return !repo?.isFork;
}

/** @returns {object|null} the stored override for a repo, if any. */
export function getOverride(overrides, slug) {
  if (!overrides || !slug) return null;
  return overrides[slug] ?? null;
}

/**
 * Merge a raw repository with its override → the view model used by the UI
 * and, later, by the PDF composer.
 *
 * Detection runs here rather than at fetch time, so a status that has not been
 * overridden manually keeps reflecting the metadata ("updated 8 months ago"
 * eventually becomes "Paused").
 *
 * @param {object} repo
 * @param {Record<string, object>} [overrides]
 * @param {{ now?: number }} [options]
 */
export function resolveRepo(repo, overrides = {}, options = {}) {
  const override = getOverride(overrides, repo.slug);
  const detection = detectStatus(repo, options);

  const manualStatus = override?.status ?? null;
  const status = manualStatus ?? detection.status;
  const customSummary = override?.shortDescription ?? null;

  return {
    ...repo,
    visible: override?.visible ?? defaultVisibility(repo),
    status,
    tone: TONE_BY_STATUS[status] ?? 'neutral',
    /** The visitor pinned this status in the dropdown. */
    statusIsManual: manualStatus !== null,
    /** Why auto-detection chose what it chose (`status.reasons.*`). */
    statusReason: manualStatus !== null ? 'manual' : detection.reason,
    statusDetail: manualStatus !== null ? null : detection.detail,
    statusDays: detection.days,
    /** Pre-filled from GitHub until the visitor types their own. */
    shortDescription: customSummary ?? repo.description ?? '',
    summaryIsCustom: customSummary !== null,
    /** The GitHub description, used by "reset" and by the placeholder text. */
    githubDescription: repo.description ?? '',
    /**
     * The visitor's own notes. Sourced only from the override — never from
     * GitHub — so a re-fetch leaves it exactly as it was typed.
     */
    notes: override?.notes ?? '',
    /** True once the visitor has written something, however short. */
    hasNotes: typeof override?.notes === 'string' && override.notes.trim() !== '',
    isOverridden: Boolean(override),
  };
}

/** @returns {object[]} every fetched repo, overrides applied. */
export function selectViews(session, settings, options = {}) {
  const repos = session?.repos ?? [];
  const overrides = settings?.repoOverrides ?? {};
  return repos.map((repo) => resolveRepo(repo, overrides, options));
}

/** Case-insensitive substring match across the fields a human would search. */
function matchesSearch(repo, needle) {
  if (!needle) return true;
  const haystack = [
    repo.name,
    repo.slug,
    repo.description,
    repo.shortDescription,
    repo.language,
    ...(repo.topics ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return needle
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

/** Case-insensitive name comparison used as the tiebreaker in every sort. */
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

const COMPARATORS = {
  /** Live → In Development → Beta/MVP → Paused, then by name. */
  status: (a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99) || byName(a, b),
  /** Most recently updated first (GitHub's `updated_at`). */
  updated: (a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')) || byName(a, b),
  /** Alphabetical, A–Z. */
  name: byName,
};

export const SORT_COMPARATORS = COMPARATORS;

/**
 * The repository library as shown on screen: search + fork filter + sort.
 *
 * @param {object[]} views  resolved view models
 * @param {{ search?: string, sort?: string, hideForks?: boolean }} [filters]
 */
export function selectLibrary(views, filters = {}) {
  const { search = '', sort = 'status', hideForks = false } = filters;
  const comparator = COMPARATORS[sort] ?? COMPARATORS.status;

  return views
    .filter((repo) => (hideForks ? !repo.isFork : true))
    .filter((repo) => matchesSearch(repo, String(search ?? '').trim()))
    .sort(comparator);
}

/**
 * Chapters of the book: visible repositories ordered by status rank, then
 * popularity, then name. Deterministic — the printed table of contents must
 * not shuffle between sessions.
 */
export function selectChapters(views) {
  return views
    .filter((repo) => repo.visible)
    .sort(
      (a, b) =>
        (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99) ||
        (b.stars ?? 0) - (a.stars ?? 0) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    )
    .map((repo, index) => ({ ...repo, chapter: index + 1 }));
}

/** Aggregate numbers for the hero strip and the book summary panel. */
export function selectStats(views) {
  const chapters = views.filter((repo) => repo.visible);
  const languages = new Map();
  const statuses = new Map();

  for (const repo of views) {
    if (repo.language) languages.set(repo.language, (languages.get(repo.language) ?? 0) + 1);
    statuses.set(repo.status, (statuses.get(repo.status) ?? 0) + 1);
  }

  const topLanguages = [...languages.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  const byStatus = Object.fromEntries(REPO_STATUS_IDS.map((id) => [id, 0]));
  for (const repo of views) if (repo.status in byStatus) byStatus[repo.status] += 1;

  return {
    total: views.length,
    visible: chapters.length,
    hidden: views.length - chapters.length,
    forks: views.filter((repo) => repo.isFork).length,
    archived: views.filter((repo) => repo.archived).length,
    private: views.filter((repo) => repo.isPrivate).length,
    stars: chapters.reduce((sum, repo) => sum + (repo.stars ?? 0), 0),
    languages: languages.size,
    topLanguages,
    /** `{ live: 3, development: 7, beta: 2, paused: 5 }` — always complete. */
    byStatus,
    statuses: [...statuses.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([id, count]) => ({ id, count })),
  };
}

/**
 * One-shot helper for components that need everything at once.
 * @returns {{ views: object[], library: object[], chapters: object[], stats: object }}
 */
export function selectPresentation(settings, session, options = {}) {
  const views = selectViews(session, settings, options);
  return {
    views,
    library: selectLibrary(views, {
      search: session?.search ?? '',
      sort: settings?.library?.sort ?? 'status',
      hideForks: settings?.library?.hideForks ?? false,
    }),
    chapters: selectChapters(views),
    stats: selectStats(views),
  };
}

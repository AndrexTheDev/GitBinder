/**
 * Book model builder.
 *
 * Turns `(settings, chapters)` into the plain-data description of a finished
 * book: cover metadata, paginated table of contents and paginated project
 * pages, with every value already formatted for the active locale.
 *
 * Deliberately free of DOM and store access — `template.js` renders what this
 * module returns, and `tests/` can assert on the model without jsdom.
 *
 * @module book/compose
 */

import { APP_NAME, LINKS, TONE_BY_STATUS } from '../config/app.js';
import { BOOK_LIMITS, BOOK_SUBTITLE_KEY } from '../config/book.js';
import { paginateBook } from './paginate.js';
import { formatDate, formatNumber, humanizeRepoName, normalizeUrl, safeUrl } from '../utils/format.js';

/**
 * Trim, collapse and clamp the text that goes onto paper.
 * @param {unknown} value
 * @param {number} [max]
 */
function paperText(value, max = BOOK_LIMITS.descriptionChars) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** `https://gitbooklet.pages.dev` → `gitbooklet.pages.dev` for the footer. */
function prettyUrl(url) {
  return String(url ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/**
 * The links printed under a project.
 *
 * Every one of them is a real `<a href>`: Chromium's print-to-PDF keeps link
 * annotations, so the PDF stays clickable — the whole point of the exercise.
 * The URL is *also* spelled out in text so the paper copy is usable.
 *
 * @param {object} repo
 * @param {(key: string, params?: object) => string} t
 * @returns {{ kind: 'repo'|'home', label: string, url: string }[]}
 */
export function buildEntryLinks(repo, t) {
  const candidates = [
    { kind: 'repo', label: t('book.entry.repository'), raw: repo?.url },
    { kind: 'home', label: t('book.entry.homepage'), raw: repo?.homepage },
  ];

  /** @type {{ kind: string, label: string, url: string }[]} */
  const links = [];
  for (const candidate of candidates) {
    // `safeUrl()` rejects anything that is not http(s)/mailto. We drop those
    // rather than print a URL that cannot be clicked — and rather than ship an
    // href a visitor could click to run script in their own session.
    const url = safeUrl(candidate.raw);
    if (!url) continue;
    links.push({ kind: candidate.kind, label: candidate.label, url: normalizeUrl(url) });
  }
  return links.slice(0, BOOK_LIMITS.links);
}

/**
 * @param {object} options
 * @param {object[]} options.chapters  output of `selectChapters()` (resolved, visible, ordered)
 * @param {object} options.settings    persisted settings store state
 * @param {import('../core/i18n.js').I18n} options.i18n
 * @param {(key: string, params?: object) => string} options.t
 * @param {Date|string|number} [options.now]
 * @param {object} [options.links]     deployment links (injectable in tests)
 * @param {typeof paginateBook} [options.paginate]
 */
export function composeBook({
  chapters = [],
  settings = {},
  i18n,
  t,
  now = new Date(),
  links = LINKS,
  paginate = paginateBook,
} = {}) {
  const locale = i18n?.locale ?? 'en';
  const format = (value) => (i18n?.formatNumber ? i18n.formatNumber(value) : formatNumber(value, locale));
  const date = (value) => (i18n?.formatDate ? i18n.formatDate(value) : formatDate(value, locale));
  const generatedAt = now instanceof Date ? now : new Date(now);

  const languages = new Set();
  let stars = 0;
  for (const chapter of chapters) {
    if (chapter.language) languages.add(chapter.language);
    stars += chapter.stars ?? 0;
  }

  // Normalised once: the cover colophon, the running footer and the PDF link
  // annotation must all agree on what the address is.
  const attributionUrl = normalizeUrl(safeUrl(links?.deployed ?? LINKS.deployed));

  const meta = {
    appName: APP_NAME,
    title: settings.customBookTitle || t('summary.bookTitle.fallback'),
    subtitle: t(BOOK_SUBTITLE_KEY),
    author: settings.authorName || t('summary.author.fallback'),
    contact: settings.authorEmail || '',
    bio: paperText(settings.authorBio, 280) || t('book.cover.bioFallback'),
    /** "by" — sits above the author name on the title page. */
    byline: t('book.cover.byline'),
    /** Running footer, left column. */
    authorLine: t('book.runner.author', { name: settings.authorName || t('summary.author.fallback') }),
    /** Screen-reader label for a page section. */
    pageLabel: t('book.pageLabel', { page: '{page}' }),
    generatedAtLabel: t('book.cover.generatedOn', { date: date(generatedAt) }),
    generatedAtISO: generatedAt.toISOString(),
    attributionLabel: t('book.runner.attribution'),
    attributionUrl,
    attributionHost: prettyUrl(attributionUrl),
    stats: {
      projects: chapters.length,
      projectsLabel: format(chapters.length),
      languages: languages.size,
      languagesLabel: format(languages.size),
      stars,
      starsLabel: format(stars),
    },
    statsLine: t('book.cover.stats', {
      projects: format(chapters.length),
      languages: format(languages.size),
      stars: format(stars),
    }),
  };

  /* ── Project pages ──────────────────────────────────────────────────── */

  const pagination = paginate(chapters);

  const entryModels = new Map();
  for (const chapter of chapters) {
    const index = chapter.chapter ?? 0;
    entryModels.set(chapter.slug, {
      slug: chapter.slug,
      index,
      indexLabel: String(index).padStart(2, '0'),
      title: humanizeRepoName(chapter.name),
      rawName: chapter.name,
      owner: chapter.owner ?? '',
      status: chapter.status,
      statusLabel: t(`status.${chapter.status}`),
      tone: TONE_BY_STATUS[chapter.status] ?? 'neutral',
      language: chapter.language ?? null,
      languageLabel: chapter.language ?? t('common.unknown'),
      stars: chapter.stars ?? 0,
      starsLabel: format(chapter.stars ?? 0),
      forks: chapter.forks ?? 0,
      forksLabel: format(chapter.forks ?? 0),
      updatedAt: chapter.updatedAt ?? null,
      updatedAtLabel: chapter.updatedAt ? date(chapter.updatedAt) : t('common.unknown'),
      license: chapter.license?.spdx_id ?? chapter.license?.name ?? null,
      description: paperText(chapter.shortDescription || chapter.description) || t('book.entry.noDescription'),
      topics: (chapter.topics ?? []).slice(0, BOOK_LIMITS.topics),
      links: buildEntryLinks(chapter, t),
      isFork: Boolean(chapter.isFork),
      isArchived: Boolean(chapter.archived),
      isFullPage: false, // filled in below
    });
  }

  const pages = pagination.pages.map((page) => ({
    number: page.number,
    entries: page.entries.map((repo) => {
      const entry = entryModels.get(repo.slug);
      // A lone chapter on a page gets room to breathe; two chapters share.
      if (entry) entry.isFullPage = page.entries.length === 1;
      return entry;
    }),
  }));

  /* ── Table of contents ──────────────────────────────────────────────── */

  const toc = {
    startPage: pagination.toc.startPage,
    endPage: pagination.toc.endPage,
    title: t('book.toc.title'),
    continuedTitle: t('book.toc.continued'),
    empty: t('book.toc.empty'),
    pages: pagination.toc.pages.map((page) => ({
      number: page.number,
      isFirst: page.number === pagination.toc.startPage,
      groups: page.groups.map((group) => ({
        status: group.status,
        label: t(`status.${group.status}`),
        tone: TONE_BY_STATUS[group.status] ?? 'neutral',
        continued: group.continued,
        labelContinued: t('book.toc.groupContinued', { group: t(`status.${group.status}`) }),
        entries: group.entries.map(({ chapter, page: pageNumber }) => ({
          slug: chapter.slug,
          index: chapter.chapter ?? 0,
          title: humanizeRepoName(chapter.name),
          language: chapter.language ?? null,
          languageLabel: chapter.language ?? '',
          page: pageNumber,
        })),
      })),
    })),
  };

  return {
    meta,
    cover: { number: pagination.coverPage },
    toc,
    pages,
    totalPages: pagination.totalPages,
    isEmpty: pagination.isEmpty,
  };
}

/**
 * Pagination + table-of-contents engine for the Classic Book composer.
 *
 * Pure geometry: no DOM, no i18n, no store. Given the ordered list of chapters
 * it answers the one question the printing press asks — *which projects share a
 * sheet, and what number does that sheet carry?*
 *
 * Why compute this instead of letting CSS break the flow?
 *
 *   A table of contents must quote the page number of a chapter it has not
 *   reached yet, and `@page` counters are not readable from JavaScript. So the
 *   composer owns pagination and CSS merely enforces it: every page becomes an
 *   explicit `<section class="book-page">` with `break-after: page`. The
 *   estimate and the stylesheet are two views of the same numbers in
 *   `config/book.js`, which is why those weights are exported and tested.
 *
 * Order of operations (there is no circular dependency, deliberately):
 *
 *   1. Group chapters by status → TOC groups.
 *   2. Pack the TOC into pages. This depends only on *how many* entries there
 *      are, never on the page numbers printed next to them.
 *   3. Projects therefore start at `1 (cover) + tocPages + 1`.
 *   4. Walk the packed TOC once more and stamp the real page number on it.
 *
 * @module book/paginate
 */

import { BOOK_LIMITS, BOOK_PAPER, BOOK_WEIGHTS } from '../config/book.js';
import { STATUS_RANK } from '../config/app.js';

/** @typedef {{ slug?: string, name?: string, status?: string, shortDescription?: string, description?: string, topics?: string[], homepage?: string|null, url?: string }} PageableRepo */

const DEFAULTS = {
  paper: BOOK_PAPER,
  weights: BOOK_WEIGHTS,
};

/** Millimetres, always rounded up: an underestimate puts two pages on a sheet. */
const ceil = (value) => Math.ceil(value * 100) / 100;

/* -------------------------------------------------------------------------- *
 * Entry measurement
 * -------------------------------------------------------------------------- */

/**
 * How tall a single project entry renders, in millimetres.
 *
 * Description length is the dominant term, which is exactly what the spec asks
 * for: "1 to 2 projects per page depending on description length".
 *
 * @param {PageableRepo} repo
 * @param {{ weights?: object }} [options]
 * @returns {number} millimetres
 */
export function estimateEntryHeight(repo, options = {}) {
  const weights = { ...DEFAULTS.weights, ...options.weights };

  const text = String(repo?.shortDescription ?? repo?.description ?? '').trim();
  const lines = Math.max(1, Math.ceil(text.length / weights.descriptionCharsPerLine));
  const topics = (repo?.topics ?? []).length;
  const links = countEntryLinks(repo);
  const noteLines = countNoteLines(repo?.notes, weights);

  return ceil(
    weights.entryChromeMm +
      weights.entryHeadingMm +
      weights.entryMetaMm +
      weights.descriptionPadMm +
      lines * weights.descriptionLineMm +
      (topics > 0 ? weights.entryTopicsMm : 0) +
      links * weights.entryLinkMm +
      weights.entryNotesPadMm +
      weights.entryNotesLabelMm +
      noteLines * weights.entryNoteLineMm,
  );
}

/**
 * How many lines the notes block occupies.
 *
 * Notes with no text still take up room: they print as ruled lines so the
 * visitor can fill them in on paper or in a PDF editor, and the paginator
 * has to reserve that space or the last entry on a page spills over.
 *
 * Explicit newlines are counted, because a note is free-form text and someone
 * who writes three short lines means three lines — not one wrapped block.
 *
 * @param {string|null|undefined} notes
 * @param {object} weights
 * @returns {number}
 */
export function countNoteLines(notes, weights = {}) {
  const w = { ...DEFAULTS.weights, ...weights };
  const raw = typeof notes === 'string' ? notes.trim() : '';
  if (!raw) return BOOK_LIMITS.noteLines;

  const segments = raw.split('\n');
  let lines = 0;
  for (const segment of segments) {
    lines += Math.max(1, Math.ceil(segment.length / w.notesCharsPerLine));
  }
  return Math.max(1, lines);
}

/**
 * Links printed under an entry: always the repository, plus the live
 * homepage/docs when the project declares one. Capped by `BOOK_LIMITS.links`.
 *
 * @param {PageableRepo} repo
 * @returns {number}
 */
export function countEntryLinks(repo) {
  let count = repo?.url ? 1 : 0;
  if (repo?.homepage) count += 1;
  return Math.min(count, BOOK_LIMITS.links);
}

/**
 * Does this entry need a page of its own?
 *
 * Exposed separately because `styles/book.css` uses the same verdict to give an
 * entry the `--full` treatment — which keeps the visual rhythm and the page
 * numbers in agreement even when the browser's font metrics differ slightly
 * from our estimate. Derived from the same numbers `packEntries()` uses, so the
 * two can never disagree.
 *
 * @param {PageableRepo} repo
 * @param {{ weights?: object, contentHeight?: number, gap?: number }} [options]
 */
export function isFullPageEntry(repo, options = {}) {
  const weights = { ...DEFAULTS.weights, ...options.weights };
  const contentHeight = options.contentHeight ?? DEFAULTS.paper.contentHeightMm;
  const gap = options.gap ?? weights.entrySeparatorMm;
  const height = estimateEntryHeight(repo, { weights });
  return height * 2 + gap > contentHeight;
}

/* -------------------------------------------------------------------------- *
 * Greedy page packing
 * -------------------------------------------------------------------------- */

/**
 * Pack items onto pages, never splitting an item.
 *
 * An item taller than the page still gets a page of its own (its height is
 * clamped) — the browser will overflow it slightly, which is far better than a
 * project disappearing because it was too wordy.
 *
 * @template T
 * @param {T[]} items
 * @param {{ heightOf: (item: T) => number, contentHeight?: number, gap?: number,
 *           maxPerPage?: number, weights?: object }} options
 * @returns {T[][]} one array of items per page
 */
export function packEntries(items, options = {}) {
  const weights = { ...DEFAULTS.weights, ...options.weights };
  const contentHeight = options.contentHeight ?? DEFAULTS.paper.contentHeightMm;
  const gap = options.gap ?? weights.entrySeparatorMm;
  const maxPerPage = options.maxPerPage ?? Infinity;

  /** @type {T[][]} */
  const pages = [];
  let current = null;
  let used = 0;

  for (const item of items ?? []) {
    const height = Math.min(options.heightOf(item), contentHeight);
    const needed = current && current.length ? gap + height : height;

    if (current && current.length && (used + needed > contentHeight || current.length >= maxPerPage)) {
      pages.push(current);
      current = [item];
      used = height;
    } else {
      if (!current) current = [];
      current.push(item);
      used += needed;
    }
  }
  if (current) pages.push(current);

  return pages;
}

/* -------------------------------------------------------------------------- *
 * Grouping (the TOC sorter)
 * -------------------------------------------------------------------------- */

/**
 * Group chapters by project status, in book order.
 *
 * `chapters` normally arrive already sorted (status → stars → name) from
 * `selectChapters()`; this function is stable with respect to that order, and
 * sorts by status rank itself when handed an unsorted list.
 *
 * @param {PageableRepo[]} chapters
 * @param {string[]} [statusOrder] defaults to `STATUS_RANK` order
 * @returns {{ status: string, entries: PageableRepo[] }[]} non-empty groups only
 */
export function groupByStatus(chapters, statusOrder = null) {
  const order = statusOrder ?? Object.keys(STATUS_RANK);
  /** @type {Map<string, PageableRepo[]>} */
  const buckets = new Map();

  for (const chapter of chapters ?? []) {
    const status = chapter?.status ?? 'paused';
    if (!buckets.has(status)) buckets.set(status, []);
    buckets.get(status).push(chapter);
  }

  const known = order.filter((status) => (buckets.get(status) ?? []).length > 0);
  // A status the taxonomy does not know about must still be printed — dropping
  // it would quietly lose a chapter from the table of contents. It goes last,
  // in the order it was first seen.
  const unknown = [...buckets.keys()].filter((status) => !order.includes(status));

  return [...known, ...unknown].map((status) => ({ status, entries: buckets.get(status) }));
}

/* -------------------------------------------------------------------------- *
 * Table of contents packing
 * -------------------------------------------------------------------------- */

/**
 * How many further TOC lines fit on the page currently being filled.
 * @param {number} used  millimetres already consumed
 * @param {number} headMm height of the heading that would precede the lines
 */
function tocCapacity(used, headMm, { contentHeight, weights }) {
  const room = contentHeight - used - headMm - weights.tocGroupGapMm;
  return Math.max(0, Math.floor(room / weights.tocEntryMm));
}

/**
 * Pack grouped TOC entries into pages.
 *
 * Two typographic rules on top of plain packing:
 *
 *   • A group heading is never left alone at the foot of a page — a chunk must
 *     hold at least two entries, otherwise the whole group moves down.
 *   • A group that genuinely does not fit is *split*, and the heading is
 *     repeated on the next page as "… (continued)".
 *
 * @param {{ status: string, entries: PageableRepo[] }[]} groups
 * @param {{ contentHeight?: number, weights?: object }} [options]
 * @returns {{ status: string, entries: PageableRepo[], continued: boolean }[][]}
 */
export function packTocPages(groups, options = {}) {
  const weights = { ...DEFAULTS.weights, ...options.weights };
  const contentHeight = options.contentHeight ?? DEFAULTS.paper.contentHeightMm;
  const ctx = { contentHeight, weights };

  /** @type {{ status: string, entries: PageableRepo[], continued: boolean }[][]} */
  const pages = [];
  /** @type {{ status: string, entries: PageableRepo[], continued: boolean }[]} */
  let current = [];
  // Page 1 of the TOC carries the "Table of contents" title; continuations
  // only carry the smaller "… (continued)" line.
  let used = weights.tocHeadingMm;

  // Only ever called once the page holds at least one group, so the first
  // call closes the title page and every later one opens a continuation.
  const startPage = () => {
    pages.push(current);
    current = [];
    used = weights.tocContinueMm;
  };

  for (const group of groups ?? []) {
    let rest = [...group.entries];
    let continued = false;

    // An empty TOC page would be created by `startPage` below when the very
    // first group cannot fit; guard against that by only opening a new page
    // once the current one holds something.
    while (rest.length > 0) {
      const headMm = continued ? weights.tocGroupContMm : weights.tocGroupHeadMm;
      let room = tocCapacity(used, headMm, ctx);

      // Widow control: heading + 1 line is not a group, it is an accident.
      if (room < 2 && current.length > 0) {
        startPage();
        continue;
      }
      // Overflow guard: even an empty page must make progress, otherwise a
      // single entry taller than the sheet would loop forever.
      if (room < 1) room = 1;

      const take = Math.min(room, weights.tocMaxEntriesPerPage, rest.length);
      current.push({ status: group.status, entries: rest.slice(0, take), continued });
      used += headMm + take * weights.tocEntryMm + weights.tocGroupGapMm;
      rest = rest.slice(take);
      continued = true;
    }
  }

  pages.push(current);
  // Drop a trailing page that ended up empty (it can happen when the last
  // group was pushed to a new page and then filled it completely).
  return pages.filter((page, index) => page.length > 0 || index === 0);
}

/* -------------------------------------------------------------------------- *
 * The whole book
 * -------------------------------------------------------------------------- */

/**
 * Paginate a book.
 *
 * @param {PageableRepo[]} chapters resolved, visible repositories in book order
 * @param {{ contentHeight?: number, weights?: object, statusOrder?: string[] }} [options]
 * @returns {{
 *   coverPage: number,
 *   toc: { startPage: number, endPage: number, pages: { number: number, groups: {
 *     status: string, continued: boolean, entries: { chapter: PageableRepo, page: number }[]
 *   }[] }[] },
 *   pages: { number: number, entries: PageableRepo[] }[],
 *   pageOf: Map<string, number>,
 *   totalPages: number,
 *   isEmpty: boolean,
 * }}
 */
export function paginateBook(chapters, options = {}) {
  const weights = { ...DEFAULTS.weights, ...options.weights };
  const contentHeight = options.contentHeight ?? DEFAULTS.paper.contentHeightMm;
  const list = chapters ?? [];

  // 1 — groups, 2 — TOC pages (page-number independent), 3 — project pages.
  const groups = groupByStatus(list, options.statusOrder);
  const packedToc = packTocPages(groups, { contentHeight, weights });
  const projectPages = packEntries(list, {
    contentHeight,
    weights,
    maxPerPage: BOOK_LIMITS.projectsPerPage,
    heightOf: (repo) => estimateEntryHeight(repo, { weights }),
  });

  const tocStartPage = 2; // page 1 is the cover
  const projectStartPage = tocStartPage + packedToc.length;

  /** @type {Map<string, number>} */
  const pageOf = new Map();
  const pages = projectPages.map((entries, index) => {
    const number = projectStartPage + index;
    for (const entry of entries) if (entry?.slug) pageOf.set(entry.slug, number);
    return { number, entries };
  });

  // 4 — now that the page numbers exist, stamp them into the TOC.
  const toc = packedToc.map((page, index) => ({
    number: tocStartPage + index,
    groups: page.map((group) => ({
      status: group.status,
      continued: group.continued,
      entries: group.entries.map((chapter) => ({
        chapter,
        page: pageOf.get(chapter?.slug) ?? projectStartPage,
      })),
    })),
  }));

  const totalPages = 1 + packedToc.length + pages.length;

  return {
    coverPage: 1,
    toc: {
      startPage: tocStartPage,
      endPage: tocStartPage + Math.max(packedToc.length, 1) - 1,
      pages: toc,
    },
    pages,
    pageOf,
    totalPages,
    isEmpty: list.length === 0,
  };
}

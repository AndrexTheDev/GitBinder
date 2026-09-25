/**
 * Classic Book pagination engine.
 *
 * The table of contents quotes page numbers for chapters it has not reached
 * yet, so the geometry has to be provably consistent. These tests pin the
 * invariants rather than the exact millimetres — `config/book.js` stays
 * tunable, but the *relationships* may not drift:
 *
 *   • no page ever holds more than two projects
 *   • every project appears exactly once
 *   • every TOC page number points at the page that really holds the chapter
 *   • `isFullPageEntry()` and `packEntries()` never disagree
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  countEntryLinks,
  countNoteLines,
  estimateEntryHeight,
  groupByStatus,
  isFullPageEntry,
  packEntries,
  packTocPages,
  paginateBook,
} from '../src/book/paginate.js';
import { BOOK_LIMITS, BOOK_PAPER, BOOK_WEIGHTS } from '../src/config/book.js';
import { REPO_STATUS_IDS } from '../src/config/app.js';

const CONTENT_H = BOOK_PAPER.contentHeightMm;
const WORDS = (count) => 'word '.repeat(Math.max(0, Math.round(count / 5)));

/** Minimal pageable repository. */
function repo(overrides = {}) {
  return {
    slug: 'octo/thing',
    name: 'thing',
    status: 'live',
    description: WORDS(120),
    shortDescription: null,
    topics: [],
    url: 'https://github.com/octo/thing',
    homepage: null,
    ...overrides,
  };
}

/** N repositories with a deterministic spread of description lengths. */
function set(count, { lengthAt = (i) => 100 + (i % 7) * 180, statusAt = (i) => REPO_STATUS_IDS[i % 4] } = {}) {
  return Array.from({ length: count }, (_, i) =>
    repo({
      slug: `octo/r${i}`,
      name: `r${i}`,
      status: statusAt(i),
      shortDescription: WORDS(lengthAt(i)),
      topics: i % 3 === 0 ? ['cli'] : [],
      homepage: i % 2 === 0 ? `https://r${i}.example.com` : null,
    }),
  );
}

/* -------------------------------------------------------------------------- *
 * Measurement
 * -------------------------------------------------------------------------- */

describe('estimateEntryHeight', () => {
  test('grows with the description', () => {
    const short = estimateEntryHeight(repo({ shortDescription: WORDS(80) }));
    const long = estimateEntryHeight(repo({ shortDescription: WORDS(900) }));
    assert.ok(long > short, `${long} should exceed ${short}`);
  });

  test('a description that is one character over a line costs one more line', () => {
    const fit = estimateEntryHeight(repo({ shortDescription: 'x'.repeat(BOOK_WEIGHTS.descriptionCharsPerLine) }));
    const wrap = estimateEntryHeight(repo({ shortDescription: 'x'.repeat(BOOK_WEIGHTS.descriptionCharsPerLine + 1) }));
    assert.equal(wrap - fit, BOOK_WEIGHTS.descriptionLineMm);
  });

  test('an empty description still measures one line', () => {
    const empty = estimateEntryHeight(repo({ shortDescription: '' }));
    const oneLine = estimateEntryHeight(repo({ shortDescription: 'hello' }));
    assert.equal(empty, oneLine);
  });

  test('topics and links add their own rows', () => {
    const base = estimateEntryHeight(repo({ topics: [], homepage: null }));
    const withTopics = estimateEntryHeight(repo({ topics: ['a'], homepage: null }));
    const withHome = estimateEntryHeight(repo({ topics: [], homepage: 'https://x.dev' }));
    assert.equal(withTopics - base, BOOK_WEIGHTS.entryTopicsMm);
    assert.equal(withHome - base, BOOK_WEIGHTS.entryLinkMm);
  });

  test('the tallest possible entry still fits on a page', () => {
    const tallest = estimateEntryHeight(
      repo({
        shortDescription: 'x'.repeat(BOOK_LIMITS.descriptionChars),
        topics: Array.from({ length: BOOK_LIMITS.topics }, (_, i) => `t${i}`),
        homepage: 'https://x.dev',
      }),
    );
    assert.ok(tallest <= CONTENT_H, `${tallest}mm must fit in ${CONTENT_H}mm`);
  });
});

describe('countEntryLinks', () => {
  test('repository only', () => {
    assert.equal(countEntryLinks(repo({ homepage: null })), 1);
  });

  test('repository + homepage', () => {
    assert.equal(countEntryLinks(repo({ homepage: 'https://x.dev' })), 2);
  });

  test('never exceeds the printed limit', () => {
    assert.ok(countEntryLinks(repo({ homepage: 'https://x.dev' })) <= BOOK_LIMITS.links);
  });
});

/* -------------------------------------------------------------------------- *
 * isFullPageEntry must agree with packEntries
 * -------------------------------------------------------------------------- */

describe('isFullPageEntry', () => {
  test('agrees with the packer for every entry in a varied set', () => {
    const chapters = set(40);
    for (const chapter of chapters) {
      const paired = packEntries([chapter, chapter], {
        heightOf: (item) => estimateEntryHeight(item),
      });
      const alone = isFullPageEntry(chapter);
      assert.equal(
        paired.length,
        alone ? 2 : 1,
        `${chapter.slug}: isFullPageEntry=${alone} but packing produced ${paired.length} page(s)`,
      );
    }
  });

  test('short entries pair up, wordy ones do not', () => {
    assert.equal(isFullPageEntry(repo({ shortDescription: WORDS(120) })), false);
    assert.equal(isFullPageEntry(repo({ shortDescription: WORDS(1100) })), true);
  });
});

/* -------------------------------------------------------------------------- *
 * packEntries
 * -------------------------------------------------------------------------- */

describe('packEntries', () => {
  const heightOf = (item) => estimateEntryHeight(item);

  test('never puts more than the cap on one page', () => {
    const pages = packEntries(set(25), { heightOf, maxPerPage: BOOK_LIMITS.projectsPerPage });
    for (const page of pages) assert.ok(page.length <= BOOK_LIMITS.projectsPerPage);
  });

  test('never exceeds the printable height', () => {
    const pages = packEntries(set(25), { heightOf });
    for (const page of pages) {
      const total = page.reduce((sum, item) => sum + heightOf(item), 0) + BOOK_WEIGHTS.entrySeparatorMm * (page.length - 1);
      assert.ok(total <= CONTENT_H, `page of ${page.length} entries is ${total}mm`);
    }
  });

  test('loses nothing and duplicates nothing', () => {
    const chapters = set(37);
    const packed = packEntries(chapters, { heightOf, maxPerPage: BOOK_LIMITS.projectsPerPage });
    assert.deepEqual(packed.flat().map((entry) => entry.slug), chapters.map((entry) => entry.slug));
  });

  test('an entry taller than the page still gets a page', () => {
    const monster = repo({ slug: 'octo/monster', shortDescription: 'x'.repeat(20_000) });
    const pages = packEntries([monster], { heightOf });
    assert.equal(pages.length, 1);
    assert.deepEqual(pages[0], [monster]);
  });

  test('an empty book has no pages', () => {
    assert.deepEqual(packEntries([], { heightOf }), []);
  });
});

/* -------------------------------------------------------------------------- *
 * groupByStatus
 * -------------------------------------------------------------------------- */

describe('groupByStatus', () => {
  test('orders groups by status rank and skips empty ones', () => {
    const groups = groupByStatus([
      repo({ slug: 'a', status: 'paused' }),
      repo({ slug: 'b', status: 'live' }),
      repo({ slug: 'c', status: 'live' }),
      repo({ slug: 'd', status: 'beta' }),
    ]);
    assert.deepEqual(groups.map((group) => group.status), ['live', 'beta', 'paused']);
    assert.deepEqual(groups[0].entries.map((entry) => entry.slug), ['b', 'c']);
  });

  test('preserves the incoming order inside a group', () => {
    const groups = groupByStatus([
      repo({ slug: 'first', status: 'live' }),
      repo({ slug: 'second', status: 'live' }),
    ]);
    assert.deepEqual(groups[0].entries.map((entry) => entry.slug), ['first', 'second']);
  });

  test('an unknown status does not crash and lands last', () => {
    const groups = groupByStatus([repo({ slug: 'x', status: 'mystery' })]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].status, 'mystery');
  });
});

/* -------------------------------------------------------------------------- *
 * packTocPages
 * -------------------------------------------------------------------------- */

describe('packTocPages', () => {
  test('keeps a whole group together while there is room', () => {
    const pages = packTocPages(groupByStatus(set(12)));
    assert.equal(pages.length, 1);
    assert.equal(pages[0].length, 4); // live / development / beta / paused
  });

  test('splits an oversized group and marks the continuation', () => {
    const big = groupByStatus(Array.from({ length: 90 }, (_, i) => repo({ slug: `octo/r${i}`, status: 'live' })));
    const pages = packTocPages(big);
    assert.ok(pages.length > 1, 'a 90-entry TOC must span more than one page');
    assert.equal(pages[0][0].continued, false);
    assert.equal(pages[1][0].continued, true);
  });

  test('never orphans a group heading with a single entry', () => {
    // 8 live entries followed by one beta entry: the beta heading must not be
    // left alone at the foot of the page.
    const groups = groupByStatus([
      ...Array.from({ length: 24 }, (_, i) => repo({ slug: `octo/a${i}`, status: 'live' })),
      repo({ slug: 'octo/lonely', status: 'beta' }),
    ]);
    const pages = packTocPages(groups);
    const flattened = pages.flat();
    for (const chunk of flattened) {
      if (chunk.entries.length < 2) {
        // A short chunk is only acceptable as the first thing on its page.
        const hostPage = pages.find((page) => page[0] === chunk);
        assert.ok(hostPage, 'a chunk shorter than 2 entries must start its page');
      }
    }
  });

  test('preserves every entry exactly once, in group order', () => {
    const chapters = set(120);
    // The TOC is grouped by status, so "in order" means the grouped order.
    const expected = groupByStatus(chapters).flatMap((group) => group.entries.map((entry) => entry.slug));
    const packed = packTocPages(groupByStatus(chapters));
    assert.deepEqual(
      packed.flat().flatMap((chunk) => chunk.entries.map((entry) => entry.slug)),
      expected,
    );
  });

  test('an empty book yields a single, empty TOC page', () => {
    const pages = packTocPages([]);
    assert.equal(pages.length, 1);
    assert.deepEqual(pages[0], []);
  });
});

/* -------------------------------------------------------------------------- *
 * paginateBook — the whole document
 * -------------------------------------------------------------------------- */

describe('paginateBook', () => {
  test('page 1 is the cover and page 2 starts the table of contents', () => {
    const book = paginateBook(set(10));
    assert.equal(book.coverPage, 1);
    assert.equal(book.toc.startPage, 2);
    assert.equal(book.pages[0].number, book.toc.endPage + 1);
  });

  test('total pages = cover + toc + catalogue', () => {
    const book = paginateBook(set(30));
    assert.equal(book.totalPages, 1 + book.toc.pages.length + book.pages.length);
  });

  test('page numbers run 1…N with no gaps', () => {
    const book = paginateBook(set(45));
    const numbers = [1, ...book.toc.pages.map((page) => page.number), ...book.pages.map((page) => page.number)];
    assert.deepEqual(numbers, numbers.map((_, index) => index + 1));
    assert.equal(numbers.at(-1), book.totalPages);
  });

  test('every TOC page number points at the page that really holds the chapter', () => {
    for (const size of [1, 9, 30, 64, 120]) {
      const chapters = set(size);
      const book = paginateBook(chapters);
      for (const tocPage of book.toc.pages) {
        for (const group of tocPage.groups) {
          for (const { chapter, page } of group.entries) {
            const target = book.pages.find((entry) => entry.number === page);
            assert.ok(target, `${chapter.slug} points at page ${page}, which does not exist`);
            assert.ok(
              target.entries.some((entry) => entry.slug === chapter.slug),
              `${chapter.slug} is listed on page ${page} but is not on it`,
            );
          }
        }
      }
    }
  });

  test('pageOf agrees with the emitted pages', () => {
    const chapters = set(50);
    const book = paginateBook(chapters);
    for (const chapter of chapters) {
      const holder = book.pages.find((page) => page.entries.some((entry) => entry.slug === chapter.slug));
      assert.equal(book.pageOf.get(chapter.slug), holder.number);
    }
  });

  test('the catalogue holds one or two projects per page', () => {
    const book = paginateBook(set(60));
    for (const page of book.pages) {
      assert.ok(page.entries.length >= 1 && page.entries.length <= 2, `page ${page.number} has ${page.entries.length} entries`);
    }
  });

  test('an empty book is a cover plus an empty contents page', () => {
    const book = paginateBook([]);
    assert.equal(book.isEmpty, true);
    assert.equal(book.totalPages, 2);
    assert.deepEqual(book.pages, []);
    assert.equal(book.toc.pages.length, 1);
  });

  test('is deterministic across runs', () => {
    const chapters = set(70);
    const a = JSON.stringify(paginateBook(chapters).pages.map((page) => page.entries.map((entry) => entry.slug)));
    const b = JSON.stringify(paginateBook(chapters).pages.map((page) => page.entries.map((entry) => entry.slug)));
    assert.equal(a, b);
  });
});

/* -------------------------------------------------------------------------- *
 * Notes
 * -------------------------------------------------------------------------- */

describe('countNoteLines — the space a notes block really needs', () => {
  // This is the function that decides whether the last entry on a sheet spills
  // over the bottom edge. It was exported and documented but never exercised,
  // which is the wrong way round for the one number that turns typed text into
  // reserved millimetres.
  const W = BOOK_WEIGHTS;

  test('an empty note still reserves the ruled lines to write on', () => {
    // Notes print as ruled lines for a pen or a PDF editor, so "no text" is
    // not "no height". Getting this wrong drops the ruled block off the page.
    for (const empty of [null, undefined, '', '   ', '\n\n', '\t']) {
      assert.equal(countNoteLines(empty, W), BOOK_LIMITS.noteLines, `wrong reserve for ${JSON.stringify(empty)}`);
    }
  });

  test('explicit newlines count, because three short lines are three lines', () => {
    assert.equal(countNoteLines('one', W), 1);
    assert.equal(countNoteLines('one\ntwo\nthree', W), 3);
    assert.equal(countNoteLines('one\n\ntwo', W), 3, 'a blank line in the middle still occupies a line');
  });

  test('a stray newline at either end is not charged for', () => {
    // The textarea is free-form, so a leading or trailing newline is a slip of
    // the keyboard rather than a deliberate blank line. It must not cost a
    // ruled line of page height — otherwise the reserve depends on invisible
    // whitespace. Trimming also keeps the empty case honest: '\n\n' is still
    // "no notes", so it still prints the ruled block.
    assert.equal(countNoteLines('\n\none\ntwo', W), 2, 'leading blank lines are trimmed');
    assert.equal(countNoteLines('one\ntwo\n\n', W), 2, 'trailing blank lines are trimmed');
    assert.equal(countNoteLines('\n\nonly\n\n', W), 1);
  });

  test('a long line wraps at the characters the ruler holds', () => {
    const per = W.notesCharsPerLine;
    assert.equal(countNoteLines('x'.repeat(per), W), 1, 'exactly full is still one line');
    assert.equal(countNoteLines('x'.repeat(per + 1), W), 2);
    assert.equal(countNoteLines('x'.repeat(per * 2), W), 2);
    assert.equal(countNoteLines('x'.repeat(per * 2 + 1), W), 3);
  });

  test('wrapping and newlines add up', () => {
    const per = W.notesCharsPerLine;
    assert.equal(countNoteLines('x'.repeat(per) + '\ny', W), 2);
    assert.equal(countNoteLines('x'.repeat(per + 1) + '\ny', W), 3);
  });

  test('the longest note the app accepts still fits a page', () => {
    // The textarea allows BOOK_LIMITS.notesChars. Whatever it holds has to be
    // expressible as lines that the paginator can reserve — a note taller than
    // a whole content box could never be laid out at all.
    const longest = 'x'.repeat(BOOK_LIMITS.notesChars);
    const lines = countNoteLines(longest, W);
    const mm = lines * W.entryNoteLineMm + W.entryNotesPadMm + W.entryNotesLabelMm;

    assert.ok(lines > BOOK_LIMITS.noteLines, 'a full-length note should need more than the ruled baseline');
    assert.ok(mm < CONTENT_H, `a full-length note needs ${mm} mm, more than a page`);
  });

  test('never returns less than one line for text that exists', () => {
    for (const text of ['a', '.', ' ', 'x\ny']) {
      assert.ok(countNoteLines(text, W) >= 1);
    }
  });
});

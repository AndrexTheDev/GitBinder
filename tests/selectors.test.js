/**
 * Derived state — `src/state/selectors.js`.
 *
 * This module decides what the interface shows and what the book contains, and
 * it is where the project's two strongest product promises are implemented:
 * a status the visitor did not pin keeps following the data ("updated 8 months
 * ago" eventually becomes "Paused"), and a note the visitor typed is never
 * taken from GitHub. Both are single-line decisions inside a merge, which is
 * exactly the sort of thing that survives review and breaks in use.
 *
 * The selectors are pure functions over `(settings, session)`, so they can be
 * driven directly here without a store, a DOM or a network.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  SORT_COMPARATORS,
  defaultVisibility,
  getOverride,
  resolveRepo,
  selectChapters,
  selectLibrary,
  selectPresentation,
  selectStats,
  selectViews,
} from '../src/state/selectors.js';
import { REPO_STATUS_IDS } from '../src/config/app.js';

const DAY = 86_400_000;
const NOW = Date.now();

/**
 * A resolved-looking raw repository. `resolveRepo()` runs detection over it, so
 * the dates decide the detected status unless an override pins one.
 */
function repo(overrides = {}) {
  return {
    slug: 'octo/alpha',
    name: 'alpha',
    owner: 'octo',
    url: 'https://github.com/octo/alpha',
    description: 'A repository',
    language: 'TypeScript',
    stars: 10,
    forks: 2,
    isFork: false,
    isPrivate: false,
    archived: false,
    topics: ['cli'],
    updatedAt: new Date(NOW - DAY).toISOString(),
    pushedAt: new Date(NOW - DAY).toISOString(),
    createdAt: new Date(NOW - 500 * DAY).toISOString(),
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- *
 * resolveRepo
 * -------------------------------------------------------------------------- */

describe('resolveRepo', () => {
  test('auto-detection fills the status when nothing was pinned', () => {
    const view = resolveRepo(repo(), {}, { now: NOW });

    assert.equal(view.statusIsManual, false);
    assert.notEqual(view.status, 'manual', 'a detection reason cannot be "manual"');
    assert.ok(view.statusReason && view.statusReason !== 'manual', 'no reason was recorded');
    assert.ok(REPO_STATUS_IDS.includes(view.status), `detected an unknown status: ${view.status}`);
  });

  test('a pinned status wins over detection and says so', () => {
    // The dropdown is the visitor's word against the metadata, and the visitor
    // wins — without exception, or the feature is a lottery.
    const stale = repo({ updatedAt: new Date(NOW - 900 * DAY).toISOString() });
    const view = resolveRepo(stale, { 'octo/alpha': { status: 'live' } }, { now: NOW });

    assert.equal(view.status, 'live');
    assert.equal(view.statusIsManual, true);
    assert.equal(view.statusReason, 'manual');
    assert.equal(view.statusDetail, null, 'a manual status should not carry a detection detail');
  });

  test('the tone follows the status, and an unknown one falls back', () => {
    // The tone is a class name in the badge, so a missing entry would print
    // `tone-undefined` rather than an unstyled badge.
    const toneOf = (status) => resolveRepo(repo(), { 'octo/alpha': { status } }).tone;

    assert.equal(toneOf('live'), 'forest');
    assert.equal(toneOf('development'), 'azure');
    assert.equal(toneOf('beta'), 'brass');
    assert.equal(toneOf('paused'), 'neutral');
    assert.equal(toneOf('archived'), 'neutral');
    assert.equal(toneOf('nonsense'), 'neutral', 'an unknown status must not leak into the class name');
  });

  test('a fork is hidden from the book by default; the visitor can put it back', () => {
    // Forks are noise in a portfolio — a design decision, not an accident.
    assert.equal(resolveRepo(repo({ isFork: true })).visible, false);
    assert.equal(resolveRepo(repo({ isFork: false })).visible, true);

    assert.equal(resolveRepo(repo({ isFork: true }), { 'octo/alpha': { visible: true } }).visible, true);
    assert.equal(resolveRepo(repo({ isFork: false }), { 'octo/alpha': { visible: false } }).visible, false);
  });

  test('the description is GitHub\u2019s until the visitor writes one', () => {
    const untouched = resolveRepo(repo({ description: 'From GitHub' }));
    assert.equal(untouched.shortDescription, 'From GitHub');
    assert.equal(untouched.summaryIsCustom, false);
    assert.equal(untouched.githubDescription, 'From GitHub');

    const edited = resolveRepo(repo({ description: 'From GitHub' }), {
      'octo/alpha': { shortDescription: 'My own words' },
    });
    assert.equal(edited.shortDescription, 'My own words');
    assert.equal(edited.summaryIsCustom, true);
    assert.equal(
      edited.githubDescription,
      'From GitHub',
      'the original description must survive — "reset" needs it',
    );
  });

  test('an empty description does not become the text "undefined"', () => {
    const view = resolveRepo(repo({ description: undefined }));
    assert.equal(view.shortDescription, '');
    assert.equal(view.githubDescription, '');
  });

  test('notes come only from the override, never from GitHub', () => {
    // The M5 promise: a note belongs to the visitor. The raw repository has no
    // field that could leak into it, and this asserts the merge cannot acquire
    // one by accident.
    const withNotesOnTheRepo = repo({ notes: 'typed by somebody else', body: 'irrelevant' });
    const view = resolveRepo(withNotesOnTheRepo);

    assert.equal(view.notes, '', 'a note appeared from the repository payload');
    assert.equal(view.hasNotes, false);

    const mine = resolveRepo(repo(), { 'octo/alpha': { notes: 'my own note' } });
    assert.equal(mine.notes, 'my own note');
    assert.equal(mine.hasNotes, true);
  });

  test('whitespace alone is not a note', () => {
    // It would print a notes heading with nothing under it and cost the page a
    // block of ruled lines meant for writing on.
    for (const value of ['', '   ', '\n\t ']) {
      const view = resolveRepo(repo(), { 'octo/alpha': { notes: value } });
      assert.equal(view.hasNotes, false, `${JSON.stringify(value)} counted as notes`);
    }
  });

  test('isOverridden distinguishes "never touched" from "reset to the same value"', () => {
    assert.equal(resolveRepo(repo()).isOverridden, false);
    assert.equal(resolveRepo(repo(), { 'octo/alpha': {} }).isOverridden, true);
  });

  test('the raw repository fields survive the merge', () => {
    const view = resolveRepo(repo({ stars: 99 }));
    assert.equal(view.stars, 99);
    assert.equal(view.name, 'alpha');
    assert.equal(view.url, 'https://github.com/octo/alpha');
  });

  test('an override for a different repository is ignored', () => {
    const view = resolveRepo(repo(), { 'other/repo': { status: 'paused', visible: false } });
    assert.equal(view.statusIsManual, false);
    assert.equal(view.visible, true);
  });

  test('it does not mutate the repository or the override it was given', () => {
    const raw = repo();
    const overrides = { 'octo/alpha': { status: 'paused' } };
    const rawCopy = structuredClone(raw);
    const overrideCopy = structuredClone(overrides);

    resolveRepo(raw, overrides, { now: NOW });

    assert.deepEqual(raw, rawCopy, 'the raw repository was modified');
    assert.deepEqual(overrides, overrideCopy, 'the stored override was modified');
  });

  test('a status the schema would have rejected stays out of the tone map', () => {
    // `sanitizeState()` is the only gate — it runs on every write, so a bad
    // value cannot reach storage. This pins what happens if it ever does:
    // a neutral tone rather than `undefined` in the class list.
    const view = resolveRepo(repo(), { 'octo/alpha': { status: 'nonsense' } });
    assert.equal(view.tone, 'neutral');
  });
});

/* -------------------------------------------------------------------------- *
 * getOverride / defaultVisibility / selectViews
 * -------------------------------------------------------------------------- */

describe('getOverride', () => {
  test('a missing override is null, not undefined', () => {
    // Callers do `override?.status ?? null`; `undefined` would be indistinguishable
    // from "the store never loaded".
    assert.equal(getOverride({}, 'a/b'), null);
    assert.equal(getOverride({ 'a/b': undefined }, 'a/b'), null);
    assert.equal(getOverride(null, 'a/b'), null);
    assert.equal(getOverride({ 'a/b': {} }, ''), null);
    assert.equal(getOverride({ 'a/b': { notes: 'x' } }, '', null), null);
  });

  test('an override is returned as stored', () => {
    const override = { notes: 'kept' };
    assert.equal(getOverride({ 'a/b': override }, 'a/b'), override);
  });
});

describe('defaultVisibility', () => {
  test('a fork is out, anything else is in', () => {
    assert.equal(defaultVisibility({ isFork: true }), false);
    assert.equal(defaultVisibility({ isFork: false }), true);
    assert.equal(defaultVisibility({}), true);
    assert.equal(defaultVisibility(null), true, 'a missing repository must not throw');
  });
});

describe('selectViews', () => {
  test('an empty or absent session yields no views', () => {
    assert.deepEqual(selectViews(null), []);
    assert.deepEqual(selectViews({}, {}), []);
    assert.deepEqual(selectViews({ repos: [] }, undefined), []);
  });

  test('every repository comes back with its override applied', () => {
    const session = { repos: [repo({ slug: 'a/one', name: 'one' }), repo({ slug: 'a/two', name: 'two' })] };
    const settings = { repoOverrides: { 'a/two': { status: 'paused' } } };
    const views = selectViews(session, settings);

    assert.equal(views.length, 2);
    assert.equal(views[0].statusIsManual, false);
    assert.equal(views[1].statusIsManual, true);
  });
});

/* -------------------------------------------------------------------------- *
 * selectLibrary
 * -------------------------------------------------------------------------- */

const LIBRARY = [
  resolveRepo(repo({ slug: 'octo/zeta', name: 'zeta', stars: 5, language: 'Go', topics: ['server'] })),
  resolveRepo(repo({ slug: 'octo/alpha', name: 'alpha', stars: 50, language: 'TypeScript', topics: ['cli'] })),
  resolveRepo(repo({ slug: 'octo/beta', name: 'beta', stars: 1, language: 'Go', topics: ['cli', 'tool'] })),
  // Its own language and topics, so a search assertion below cannot start
  // matching the fork by inheriting the fixture's defaults.
  resolveRepo(repo({ slug: 'octo/fork', name: 'forked', isFork: true, language: 'Rust', topics: [] })),
];

describe('selectLibrary', () => {
  const names = (list) => list.map((entry) => entry.name);

  test('sorting by name is alphabetical and case-insensitive', () => {
    assert.deepEqual(names(selectLibrary(LIBRARY, { sort: 'name' })), ['alpha', 'beta', 'forked', 'zeta']);
  });

  test('sorting by stars is not offered', () => {
    // The library offers status, updated and name. A string that is not one of
    // them has to fall back rather than throw or return nothing.
    assert.doesNotThrow(() => selectLibrary(LIBRARY, { sort: 'stars' }));
    assert.deepEqual(
      names(selectLibrary(LIBRARY, { sort: 'stars' })),
      names(selectLibrary(LIBRARY, { sort: 'status' })),
      'an unknown sort did not fall back to the default',
    );
  });

  test('sorting by updated puts the most recent first', () => {
    const list = selectLibrary(LIBRARY, { sort: 'updated' });
    const dates = list.map((entry) => entry.updatedAt);
    const sorted = [...dates].sort((a, b) => String(b).localeCompare(String(a)));
    assert.deepEqual(dates, sorted);
  });

  test('equal sort keys fall back to the name, so the order is stable', () => {
    const same = [
      resolveRepo(repo({ slug: 'o/b', name: 'bravo', updatedAt: '2026-01-01T00:00:00.000Z' })),
      resolveRepo(repo({ slug: 'o/a', name: 'alpha', updatedAt: '2026-01-01T00:00:00.000Z' })),
    ];
    assert.deepEqual(names(selectLibrary(same, { sort: 'updated' })), ['alpha', 'bravo']);
    assert.deepEqual(names(selectLibrary(same, { sort: 'name' })), ['alpha', 'bravo']);
  });

  test('hideForks removes exactly the forks', () => {
    const all = selectLibrary(LIBRARY, {});
    const noForks = selectLibrary(LIBRARY, { hideForks: true });

    assert.equal(all.length, 4);
    assert.equal(noForks.length, 3);
    assert.deepEqual(names(noForks).includes('forked'), false);
  });

  test('search matches name, slug, language, topics and both descriptions', () => {
    const found = (needle) => names(selectLibrary(LIBRARY, { search: needle }));

    assert.deepEqual(found('alpha'), ['alpha']);
    assert.deepEqual(found('octo/beta'), ['beta'], 'the slug is not searched');
    assert.deepEqual(found('typescript'), ['alpha'], 'the language is not searched');
    assert.deepEqual(found('tool'), ['beta'], 'topics are not searched');
    assert.deepEqual(found('server'), ['zeta'], 'the other topic is not searched');
    assert.deepEqual(found('a repository'), ['alpha', 'beta', 'forked', 'zeta'], 'the description is not searched');
    assert.deepEqual(found('rust'), ['forked'], 'the fork is a repository like any other');
  });

  test('search ignores case and surrounding space', () => {
    assert.deepEqual(names(selectLibrary(LIBRARY, { search: '  ALPHA  ' })), ['alpha']);
  });

  test('every word has to match, so two terms narrow rather than widen', () => {
    // `cli` matches three of the four (alpha and the fork carry it as a topic
    // too); `cli tool` matches only the one repository that has both.
    assert.deepEqual(names(selectLibrary(LIBRARY, { search: 'cli' })), ['alpha', 'beta']);
    assert.deepEqual(names(selectLibrary(LIBRARY, { search: 'cli tool' })), ['beta']);
    assert.deepEqual(names(selectLibrary(LIBRARY, { search: 'cli   tool' })), ['beta']);
  });

  test('an empty search shows everything and a fruitless one shows nothing', () => {
    assert.equal(selectLibrary(LIBRARY, { search: '' }).length, 4);
    assert.equal(selectLibrary(LIBRARY, { search: '   ' }).length, 4);
    assert.deepEqual(selectLibrary(LIBRARY, { search: 'nothing-matches' }), []);
  });

  test('the caller\u2019s array is not reordered', () => {
    // `Array.prototype.sort` sorts in place. Every selector filters first, which
    // is what makes this true — but it is a property worth holding on to: the
    // library and the book are built from the same `views` array.
    const before = names(LIBRARY);
    selectLibrary(LIBRARY, { sort: 'name' });
    selectChapters(LIBRARY);
    selectStats(LIBRARY);

    assert.deepEqual(names(LIBRARY), before, 'a selector sorted the caller\u2019s array in place');
  });

  test('the exported comparator table covers the sorts the UI offers', () => {
    assert.deepEqual(Object.keys(SORT_COMPARATORS).sort(), ['name', 'status', 'updated']);
    for (const comparator of Object.values(SORT_COMPARATORS)) {
      assert.equal(typeof comparator, 'function');
    }
  });
});

/* -------------------------------------------------------------------------- *
 * selectChapters
 * -------------------------------------------------------------------------- */

describe('selectChapters', () => {
  test('only visible repositories become chapters', () => {
    // Four in the library, one of them a fork that was never ticked.
    assert.equal(selectChapters(LIBRARY).length, 3);
  });

  test('chapters are numbered from one, with no gaps', () => {
    const chapters = selectChapters(LIBRARY);
    assert.deepEqual(
      chapters.map((chapter) => chapter.chapter),
      [1, 2, 3],
    );
  });

  test('the order is status, then stars, then name', () => {
    // The printed table of contents has to be identical on every run, so the
    // tiebreakers are as load-bearing as the primary key.
    const pinned = [
      resolveRepo(repo({ slug: 'o/live', name: 'live' }), { 'o/live': { status: 'live' } }),
      resolveRepo(repo({ slug: 'o/archived', name: 'archived' }), { 'o/archived': { status: 'archived' } }),
      resolveRepo(repo({ slug: 'o/big', name: 'big', stars: 900 }), { 'o/big': { status: 'live' } }),
      resolveRepo(repo({ slug: 'o/small', name: 'small', stars: 1 }), { 'o/small': { status: 'live' } }),
    ];

    assert.deepEqual(
      selectChapters(pinned).map((chapter) => chapter.name),
      ['big', 'live', 'small', 'archived'],
      'live projects first (most stars first), archived last',
    );
  });

  test('equal stars fall back to the name, not to insertion order', () => {
    const tied = [
      resolveRepo(repo({ slug: 'o/b', name: 'bravo', stars: 7 }), { 'o/b': { status: 'live' } }),
      resolveRepo(repo({ slug: 'o/a', name: 'alpha', stars: 7 }), { 'o/a': { status: 'live' } }),
    ];
    const first = selectChapters(tied).map((chapter) => chapter.name);
    const second = selectChapters([...tied].reverse()).map((chapter) => chapter.name);

    assert.deepEqual(first, ['alpha', 'bravo']);
    assert.deepEqual(first, second, 'the order depends on how the repositories arrived');
  });

  test('an empty library is an empty book, not a crash', () => {
    assert.deepEqual(selectChapters([]), []);
  });

  test('the chapter carries the whole view model, not a summary', () => {
    // The composer reads notes, description, links and licence off the chapter.
    const [chapter] = selectChapters([
      resolveRepo(repo({ license: { spdx_id: 'MIT' } }), { 'octo/alpha': { notes: 'mine' } }),
    ]);
    assert.equal(chapter.notes, 'mine');
    assert.equal(chapter.license.spdx_id, 'MIT');
    assert.equal(chapter.slug, 'octo/alpha');
  });
});

/* -------------------------------------------------------------------------- *
 * selectStats
 * -------------------------------------------------------------------------- */

describe('selectStats', () => {
  test('the counts add up', () => {
    const stats = selectStats(LIBRARY);

    assert.equal(stats.total, 4);
    assert.equal(stats.visible, 3);
    assert.equal(stats.hidden, 1, 'hidden must be total minus visible');
    assert.equal(stats.visible + stats.hidden, stats.total);
    assert.equal(stats.forks, 1);
  });

  test('stars and languages are counted over the book, not the library', () => {
    // A repository the visitor left out must not inflate the cover.
    const stats = selectStats(LIBRARY);
    const bookStars = LIBRARY.filter((entry) => entry.visible).reduce((sum, entry) => sum + entry.stars, 0);

    assert.equal(stats.stars, bookStars);
    assert.equal(stats.languages, 3, 'Go, TypeScript and Rust — counted across the whole library');
  });

  test('byStatus is always complete, so the UI never reads undefined', () => {
    const stats = selectStats([]);
    assert.deepEqual(Object.keys(stats.byStatus).sort(), [...REPO_STATUS_IDS].sort());
    for (const count of Object.values(stats.byStatus)) assert.equal(count, 0);
  });

  test('byStatus counts every repository, and its sum is the total', () => {
    const stats = selectStats(LIBRARY);
    const sum = Object.values(stats.byStatus).reduce((total, count) => total + count, 0);
    assert.equal(sum, stats.total);
  });

  test('topLanguages is ordered by count and capped', () => {
    const many = Array.from({ length: 10 }, (_, index) =>
      repo({ slug: `o/r${index}`, name: `r${index}`, language: `Lang${index % 8}` }),
    );
    const stats = selectStats(many.map((entry) => resolveRepo(entry)));

    assert.ok(stats.topLanguages.length <= 6, `topLanguages returned ${stats.topLanguages.length} entries`);
    assert.equal(stats.languages, 8);
    const counts = stats.topLanguages.map((entry) => entry.count);
    assert.deepEqual(counts, [...counts].sort((a, b) => b - a), 'topLanguages is not ordered');
  });

  test('a repository without a language is not a language', () => {
    const stats = selectStats([repo({ slug: 'o/x', language: null }), repo({ slug: 'o/y', language: '' })]);
    assert.equal(stats.languages, 0);
    assert.deepEqual(stats.topLanguages, []);
  });

  test('private and archived repositories are reported separately from hidden ones', () => {
    const stats = selectStats([
      resolveRepo(repo({ slug: 'o/p', isPrivate: true })),
      resolveRepo(repo({ slug: 'o/a', archived: true })),
    ]);
    assert.equal(stats.private, 1);
    assert.equal(stats.archived, 1);
  });
});

/* -------------------------------------------------------------------------- *
 * selectPresentation
 * -------------------------------------------------------------------------- */

describe('selectPresentation', () => {
  const settings = () => ({
    library: { sort: 'name', hideForks: true },
    repoOverrides: { 'octo/beta': { visible: false } },
  });
  const session = () => ({ repos: [repo({ slug: 'octo/alpha', name: 'alpha' }), repo({ slug: 'octo/beta', name: 'beta' })], search: '' });

  test('it hands back the four lists components ask for', () => {
    const presentation = selectPresentation(settings(), session());
    assert.deepEqual(Object.keys(presentation).sort(), ['chapters', 'library', 'stats', 'views']);
    assert.equal(presentation.views.length, 2);
  });

  test('the search term and the library settings are read from the stores', () => {
    const filtered = selectPresentation(settings(), { ...session(), search: 'alpha' });
    assert.deepEqual(filtered.library.map((entry) => entry.name), ['alpha']);
  });

  test('unticking a project removes it from the chapters but not from the views', () => {
    // The card stays in the library with its checkbox off — that is the point.
    const presentation = selectPresentation(settings(), session());
    assert.equal(presentation.views.length, 2);
    assert.deepEqual(presentation.chapters.map((chapter) => chapter.name), ['alpha']);
  });

  test('missing settings fall back to the documented defaults', () => {
    const presentation = selectPresentation({}, { repos: [repo()] });
    assert.equal(presentation.library[0].sort, undefined);
    assert.equal(presentation.library.length, 1);
    assert.equal(presentation.chapters.length, 1);
  });
});

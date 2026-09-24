/**
 * Schema, codec, vault and selector tests.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultSession,
  createDefaultState,
  DEFAULT_AUTHOR_EMAIL,
  DEFAULT_AUTHOR_NAME,
  DEFAULT_BOOK_TITLE,
  sanitizeRepoOverrides,
  sanitizeSession,
  sanitizeState,
} from '../src/state/schema.js';
import {
  defaultVisibility,
  selectChapters,
  selectLibrary,
  selectStats,
  selectViews,
} from '../src/state/selectors.js';
import { createMemoryStorage } from './helpers/memoryStorage.js';
import { createVault } from '../src/core/vault.js';
import { createCodec, SECRET_FIELDS } from '../src/state/codec.js';

describe('schema — defaults', () => {
  test('spec defaults are applied', () => {
    const state = createDefaultState();
    assert.equal(state.customBookTitle, DEFAULT_BOOK_TITLE);
    assert.equal(state.customBookTitle, 'My Software Engineering Anthology');
    assert.equal(state.authorName, 'AndrexTheDev');
    assert.equal(DEFAULT_AUTHOR_NAME, 'AndrexTheDev');
    assert.equal(state.authorEmail, 'hippie.highho@gmail.com');
    assert.equal(DEFAULT_AUTHOR_EMAIL, 'hippie.highho@gmail.com');
    assert.equal(state.githubUsername, '');
    assert.equal(state.personalAccessToken, '');
    assert.deepEqual(state.repoOverrides, {});
  });

  test('language is auto-detected (falls back to en in Node)', () => {
    assert.ok(['en', 'de'].includes(createDefaultState().language));
  });
});

describe('schema — sanitizeState', () => {
  test('fills missing keys from defaults', () => {
    const state = sanitizeState({});
    assert.equal(state.customBookTitle, DEFAULT_BOOK_TITLE);
    assert.equal(state.authorEmail, DEFAULT_AUTHOR_EMAIL);
    assert.ok('repoOverrides' in state);
  });

  test('rejects hostile / malformed input', () => {
    const state = sanitizeState({
      githubUsername: { evil: true },
      customBookTitle: 42,
      language: 'klingon',
      repoOverrides: 'not an object',
      unknownKey: 'dropped',
    });

    assert.equal(state.githubUsername, '');
    assert.equal(state.customBookTitle, DEFAULT_BOOK_TITLE);
    assert.equal(state.language, 'en');
    assert.deepEqual(state.repoOverrides, {});
    assert.equal('unknownKey' in state, false);
  });

  test('trims and clamps strings', () => {
    const state = sanitizeState({
      githubUsername: '  AndrexTheDev  ',
      authorEmail: '  spaced@example.com  ',
      customBookTitle: 'x'.repeat(500),
    });
    assert.equal(state.githubUsername, 'AndrexTheDev');
    assert.equal(state.authorEmail, 'spaced@example.com'); // e-mail: no whitespace collapsing
    assert.equal(state.customBookTitle.length, 160);
  });

  test('invalid library preferences fall back', () => {
    const state = sanitizeState({ library: { sort: 'nope', hideForks: 'yes please' } });
    assert.equal(state.library.sort, 'status');
    assert.equal(state.library.hideForks, false, 'only an explicit true is honoured');
  });
});

describe('schema — repoOverrides', () => {
  test('only owner/repo keys survive', () => {
    const out = sanitizeRepoOverrides({
      'owner/repo': { visible: true, status: 'live', shortDescription: 'hi' },
      'not-a-slug': { visible: true },
      '': { visible: true },
    });
    assert.deepEqual(Object.keys(out), ['owner/repo']);
  });

  test('an unknown status becomes null, so auto-detection stays in charge', () => {
    const out = sanitizeRepoOverrides({
      'a/b': { status: 'nonsense' },
      'c/d': { visible: false, status: 'paused' },
    });
    assert.equal(out['a/b'].status, null);
    assert.equal(out['a/b'].visible, true);
    assert.equal(out['c/d'].visible, false);
    assert.equal(out['c/d'].status, 'paused');
  });

  test('statuses from the previous taxonomy are migrated, not discarded', () => {
    const out = sanitizeRepoOverrides({
      'a/one': { status: 'showcase' },
      'a/two': { status: 'active' },
      'a/three': { status: 'wip' },
      'a/four': { status: 'experiment' },
      'a/five': { status: 'legacy' },
      'a/six': { status: 'archived' },
    });
    assert.equal(out['a/one'].status, 'live');
    assert.equal(out['a/two'].status, 'development');
    assert.equal(out['a/three'].status, 'development');
    assert.equal(out['a/four'].status, 'beta');
    assert.equal(out['a/five'].status, 'paused');
    assert.equal(out['a/six'].status, 'paused');
  });

  test('an untouched description stays null; an edited one keeps its line breaks', () => {
    const out = sanitizeRepoOverrides({
      'a/b': { shortDescription: null },
      'c/d': { shortDescription: 'line one\nline two' },
    });
    assert.equal(out['a/b'].shortDescription, null);
    assert.equal(out['c/d'].shortDescription, 'line one\nline two');
  });
});

describe('schema — session', () => {
  test('defaults and sanitize round-trip', () => {
    const session = createDefaultSession();
    assert.equal(session.status, 'idle');
    assert.deepEqual(session.repos, []);

    const cleaned = sanitizeSession({ status: 'bogus', repos: 'nope', search: 5 });
    assert.equal(cleaned.status, 'idle');
    assert.deepEqual(cleaned.repos, []);
    assert.equal(cleaned.search, '');
  });
});

describe('vault', () => {
  test('sealed values are no longer plain text', () => {
    const storage = createMemoryStorage();
    const vault = createVault({ storage });
    const sealed = vault.seal('ghp_secretValue');
    assert.ok(!sealed.includes('ghp_secretValue'));
    assert.ok(sealed.startsWith('enc:v1:'));
    assert.equal(vault.open(sealed), 'ghp_secretValue');
  });

  test('empty secrets stay empty (never sealed)', () => {
    const vault = createVault({ storage: createMemoryStorage() });
    assert.equal(vault.seal(''), '');
    assert.equal(vault.open(''), '');
  });

  test('a token sealed on another device is unreadable, not garbage', () => {
    const first = createVault({ storage: createMemoryStorage(), key: 'v1' });
    const sealed = first.seal('ghp_mine');

    const second = createVault({ storage: createMemoryStorage(), key: 'v1' });
    assert.equal(second.open(sealed), '');
  });

  test('plain text is passed through (imported settings)', () => {
    const vault = createVault({ storage: createMemoryStorage() });
    assert.equal(vault.open('ghp_plaintext'), 'ghp_plaintext');
  });

  test('destroy() invalidates previously sealed values', () => {
    const storage = createMemoryStorage();
    const vault = createVault({ storage, key: 'k' });
    const sealed = vault.seal('ghp_x');
    vault.destroy();
    assert.equal(createVault({ storage, key: 'k' }).open(sealed), '');
  });
});

describe('codec', () => {
  test('secrets are sealed on the way in and opened on the way out', () => {
    const codec = createCodec({ vault: createVault({ storage: createMemoryStorage() }) });
    const encoded = codec.encode({ personalAccessToken: 'ghp_abc', authorName: 'X' });
    assert.notEqual(encoded.personalAccessToken, 'ghp_abc');
    assert.equal(encoded.authorName, 'X');
    assert.equal(codec.decode(encoded).personalAccessToken, 'ghp_abc');
  });

  test('redact removes secrets entirely', () => {
    const codec = createCodec({ vault: createVault({ storage: createMemoryStorage() }) });
    const redacted = codec.redact({ personalAccessToken: 'ghp_abc', authorName: 'X' });
    assert.equal(redacted.personalAccessToken, '');
    assert.equal(redacted.authorName, 'X');
  });

  test('every declared secret field is handled', () => {
    const codec = createCodec({ vault: createVault({ storage: createMemoryStorage() }) });
    const data = { personalAccessToken: 'ghp_abc' };
    for (const field of SECRET_FIELDS) {
      assert.equal(codec.redact(data)[field], '');
    }
  });
});

/* -------------------------------------------------------------------------- *
 * Selectors
 * -------------------------------------------------------------------------- */

const REPOS = [
  { slug: 'me/alpha', name: 'alpha', isFork: false, archived: false, isPrivate: false, stars: 50, forks: 2, language: 'TypeScript', description: 'Alpha', updatedAt: '2024-03-01', topics: [] },
  { slug: 'me/beta', name: 'beta', isFork: true, archived: false, isPrivate: false, stars: 5, forks: 0, language: 'Go', description: 'Beta', updatedAt: '2024-01-01', topics: ['cli'] },
  { slug: 'me/gamma', name: 'gamma', isFork: false, archived: true, isPrivate: true, stars: 200, forks: 9, language: 'Rust', description: 'Gamma', updatedAt: '2022-01-01', topics: [] },
];

/** Detection is time-sensitive, so these tests must not depend on today. */
const NOW = new Date('2024-03-15T00:00:00Z').getTime();

describe('selectors', () => {
  test('un-curated repos default to visible, forks excluded', () => {
    const views = selectViews({ repos: REPOS }, { repoOverrides: {} }, { now: NOW });
    assert.equal(defaultVisibility(REPOS[1]), false); // fork
    assert.equal(views[1].visible, false);
    assert.equal(views[0].visible, true);
    assert.equal(views[0].status, 'development'); // touched 14 days ago
    assert.equal(views[2].status, 'paused'); // archived on GitHub
    assert.equal(views[0].statusIsManual, false);
    assert.equal(views[0].statusReason, 'recent');
  });

  test('a manual override pins the status and is reported as manual', () => {
    const views = selectViews(
      { repos: REPOS },
      { repoOverrides: { 'me/beta': { visible: true, status: 'live', shortDescription: 'Mine' } } },
      { now: NOW },
    );
    const beta = views.find((view) => view.slug === 'me/beta');
    assert.equal(beta.visible, true);
    assert.equal(beta.status, 'live');
    assert.equal(beta.statusIsManual, true);
    assert.equal(beta.statusReason, 'manual');
    assert.equal(beta.shortDescription, 'Mine');
    assert.equal(beta.summaryIsCustom, true);
  });

  test('an untouched description falls back to GitHub, an edited one is respected', () => {
    const views = selectViews(
      { repos: REPOS },
      { repoOverrides: { 'me/alpha': { shortDescription: null }, 'me/beta': { shortDescription: '' } } },
      { now: NOW },
    );
    const alpha = views.find((view) => view.slug === 'me/alpha');
    const beta = views.find((view) => view.slug === 'me/beta');

    assert.equal(alpha.shortDescription, 'Alpha', 'untouched → GitHub description');
    assert.equal(alpha.summaryIsCustom, false);

    assert.equal(beta.shortDescription, '', 'deliberately cleared → stays empty');
    assert.equal(beta.summaryIsCustom, true);
    // The original text is still available for the placeholder and for "reset".
    assert.equal(beta.githubDescription, 'Beta');
  });

  test('search matches name, language and topics', () => {
    const views = selectViews({ repos: REPOS }, { repoOverrides: {} }, { now: NOW });
    assert.equal(selectLibrary(views, { search: 'rust' }).length, 1);
    assert.equal(selectLibrary(views, { search: 'cli' }).length, 1);
    assert.equal(selectLibrary(views, { search: 'zzz' }).length, 0);
    assert.equal(selectLibrary(views, { search: 'rust cli' }).length, 0); // AND semantics
  });

  test('hideForks removes forks from the list but not from the book', () => {
    const views = selectViews({ repos: REPOS }, { repoOverrides: {} }, { now: NOW });
    assert.equal(selectLibrary(views, { hideForks: false }).length, 3);
    const visible = selectLibrary(views, { hideForks: true });
    assert.equal(visible.length, 2);
    assert.equal(visible.some((repo) => repo.isFork), false);
    // The fork is filtered from the *view*; its override is untouched.
    assert.equal(views.find((repo) => repo.slug === 'me/beta').visible, false);
  });

  test('sorting by status orders live → development → beta → paused', () => {
    const views = selectViews(
      { repos: REPOS },
      { repoOverrides: { 'me/beta': { visible: true, status: 'live' } } },
      { now: NOW },
    );
    const sorted = selectLibrary(views, { sort: 'status' });
    assert.deepEqual(sorted.map((repo) => repo.slug), ['me/beta', 'me/alpha', 'me/gamma']);
    assert.deepEqual(
      sorted.map((repo) => repo.status),
      ['live', 'development', 'paused'],
    );
  });

  test('sorting by last updated and by name', () => {
    const views = selectViews({ repos: REPOS }, { repoOverrides: {} }, { now: NOW });
    assert.deepEqual(
      selectLibrary(views, { sort: 'updated' }).map((repo) => repo.slug),
      ['me/alpha', 'me/beta', 'me/gamma'],
    );
    assert.deepEqual(
      selectLibrary(views, { sort: 'name' }).map((repo) => repo.slug),
      ['me/alpha', 'me/beta', 'me/gamma'],
    );
  });

  test('chapters are numbered and deterministic', () => {
    const views = selectViews(
      { repos: REPOS },
      { repoOverrides: { 'me/beta': { visible: true, status: 'live' } } },
      { now: NOW },
    );
    const chapters = selectChapters(views);
    assert.equal(chapters.length, 3);
    assert.equal(chapters[0].slug, 'me/beta'); // live first
    assert.deepEqual(chapters.map((chapter) => chapter.chapter), [1, 2, 3]);
  });

  test('stats aggregate over the whole library', () => {
    const views = selectViews(
      { repos: REPOS },
      { repoOverrides: { 'me/beta': { visible: true } } },
      { now: NOW },
    );
    const stats = selectStats(views);
    assert.equal(stats.total, 3);
    assert.equal(stats.visible, 3);
    assert.equal(stats.hidden, 0);
    assert.equal(stats.forks, 1);
    assert.equal(stats.private, 1);
    assert.equal(stats.languages, 3);
    assert.equal(stats.stars, 255);
    // Always complete, so the UI can render a legend without special cases.
    assert.deepEqual(stats.byStatus, { live: 0, development: 1, beta: 1, paused: 1 });
  });
});

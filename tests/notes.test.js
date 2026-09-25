/**
 * Personal notes: the lifecycle.
 *
 * This is a product requirement with a deliberately narrow rule — a note is the
 * visitor's own writing, so *nothing* the app does may change it. Not a reload,
 * not a re-fetch, not a status change next to it. The only thing allowed to
 * alter a note is the visitor editing the field.
 *
 * The rule is easy to state and easy to break by accident: a re-fetch that
 * rebuilt the override map, or a patch that replaced an entry instead of
 * merging into it, would each quietly discard somebody's writing. Both paths
 * are exercised here against the booted app rather than against a helper,
 * because that is where the two of them meet.
 *
 * Every test gets its own DOM and its own storage, because "survives a reload"
 * and "a second boot sees the same thing" cannot be proved in a document that
 * already has an app in it.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createDomEnvironment } from './helpers/dom.js';
import { createMemoryStorage } from './helpers/memoryStorage.js';

const DAY = 86_400_000;
const SLUG = 'octo/alpha';
/** The notes field is told from the description field by its character limit. */
const NOTES_LENGTH = 600;
const DESCRIPTION_LENGTH = 200;
/** `RepoCard` debounces writes by 220 ms; the store persists on its own timer. */
const SETTLE = 320;
const SETTLE_STORE = 600;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A GitHub stub with a single, unremarkable public repository. */
function makeStub() {
  let calls = 0;
  const now = Date.now();
  return {
    get calls() {
      return calls;
    },
    async impl() {
      calls += 1;
      return {
        ok: true,
        status: 200,
        headers: new Map([
          ['x-ratelimit-limit', '60'],
          ['x-ratelimit-remaining', String(60 - calls)],
          ['x-ratelimit-reset', String(Math.floor(now / 1000) + 3600)],
        ]),
        async json() {
          return [
            {
              id: 1,
              full_name: SLUG,
              name: 'alpha',
              owner: { login: 'octo' },
              html_url: `https://github.com/${SLUG}`,
              description: 'From GitHub',
              language: 'TypeScript',
              stargazers_count: 12,
              forks_count: 3,
              open_issues_count: 1,
              fork: false,
              private: false,
              archived: false,
              disabled: false,
              default_branch: 'main',
              homepage: '',
              topics: [],
              license: null,
              size: 100,
              created_at: new Date(now - 400 * DAY).toISOString(),
              updated_at: new Date(now - DAY).toISOString(),
              pushed_at: new Date(now - DAY).toISOString(),
            },
          ];
        },
      };
    },
  };
}

/**
 * Boot the app in its own document, fetch one repository, and hand back the
 * pieces a test needs. `storage` can be passed in to simulate a reload.
 */
async function withApp(storage = createMemoryStorage()) {
  const env = createDomEnvironment({ languages: ['en-US', 'en'] });
  const { bootstrap } = await import('../src/app.js');
  const app = bootstrap({ host: env.document, storage, fetch: makeStub().impl });

  app.ctx.settings.set('githubUsername', 'octo');
  await app.fetchRepos({ silent: true });
  app.components.library.flush();

  return {
    env,
    app,
    doc: env.document,
    storage,
    /** The notes textarea, as opposed to the description one. */
    notes: () => env.document.querySelector(`#library-root textarea[maxlength="${NOTES_LENGTH}"]`),
    description: () =>
      env.document.querySelector(`#library-root textarea[maxlength="${DESCRIPTION_LENGTH}"]`),
    render: () => app.components.library.flush(),
    entry: () => app.ctx.settings.state.repoOverrides[SLUG],
    cleanup() {
      app.destroy?.();
      env.cleanup();
    },
  };
}

/** Type into a field the way a visitor does. */
function type(env, field, value) {
  field.value = value;
  field.dispatchEvent(new env.window.Event('input', { bubbles: true }));
}

describe('personal notes', () => {
  test('typing a note stores it, and a re-fetch does not touch it', async () => {
    const ctx = await withApp();
    try {
      const field = ctx.notes();
      assert.ok(field, 'the notes field is missing');

      const NOTE = 'Handgeschrieben — und das bleibt auch so.';
      type(ctx.env, field, NOTE);
      await wait(SETTLE);
      assert.equal(ctx.entry().notes, NOTE, 'the note was not stored');

      // The whole point: refreshing the GitHub data must leave the note alone.
      await ctx.app.fetchRepos({ silent: true });
      ctx.render();
      await wait(SETTLE);
      assert.equal(ctx.entry().notes, NOTE, 'a re-fetch changed the note');
    } finally {
      ctx.cleanup();
    }
  });

  test('a note survives a fresh boot from the same storage', async () => {
    const storage = createMemoryStorage();
    const NOTE = 'Übersteht einen Neustart.';

    const first = await withApp(storage);
    try {
      type(first.env, first.notes(), NOTE);
      await wait(SETTLE);
      // The store persists on its own debounce; give it a moment to land.
      await wait(SETTLE_STORE);
    } finally {
      first.cleanup();
    }

    // Second boot: same storage, cold start — the app hydrates from it.
    const second = await withApp(storage);
    try {
      assert.equal(second.entry().notes, NOTE, 'the note did not survive the reload');

      await second.app.fetchRepos({ silent: true });
      second.render();
      assert.equal(second.entry().notes, NOTE, 'the first fetch after a reload overwrote the note');
    } finally {
      second.cleanup();
    }
  });

  test('editing the description next to it leaves the note alone', async () => {
    // Two overrides written into the same entry: a patch that replaced the
    // entry instead of merging into it would drop whichever field was not in
    // the patch. This is the failure the product rule is really about.
    const ctx = await withApp();
    try {
      const NOTE = 'Bleibt stehen.';
      type(ctx.env, ctx.notes(), NOTE);
      await wait(SETTLE);

      const SUMMARY = 'Eine eigene Zusammenfassung.';
      type(ctx.env, ctx.description(), SUMMARY);
      await wait(SETTLE);

      assert.equal(ctx.entry().notes, NOTE, 'editing the description wiped the note');
      assert.equal(ctx.entry().shortDescription, SUMMARY);

      // And the other way round.
      type(ctx.env, ctx.notes(), `${NOTE} Verlängert.`);
      await wait(SETTLE);
      assert.equal(
        ctx.entry().shortDescription,
        SUMMARY,
        'editing the note wiped the description',
      );
    } finally {
      ctx.cleanup();
    }
  });

  test('changing the status or the visibility leaves the note alone', async () => {
    const ctx = await withApp();
    try {
      const NOTE = 'Status ändert das nicht.';
      type(ctx.env, ctx.notes(), NOTE);
      await wait(SETTLE);

      const select = ctx.doc.querySelector('#library-root .repo-card select');
      select.value = 'paused';
      select.dispatchEvent(new ctx.env.window.Event('change', { bubbles: true }));

      const box = ctx.doc.querySelector('#library-root .repo-card input[type="checkbox"]');
      box.checked = !box.checked;
      box.dispatchEvent(new ctx.env.window.Event('change', { bubbles: true }));

      assert.equal(ctx.entry().notes, NOTE);
      assert.equal(ctx.entry().status, 'paused');
    } finally {
      ctx.cleanup();
    }
  });

  test('emptying the field clears the note rather than storing a blank', async () => {
    // An empty note is not a note. Storing `''` would print a notes heading
    // over an empty block; `null` returns the entry to the state that draws the
    // ruled lines for writing on.
    const ctx = await withApp();
    try {
      type(ctx.env, ctx.notes(), 'Erst etwas.');
      await wait(SETTLE);
      assert.equal(ctx.entry().notes, 'Erst etwas.');

      type(ctx.env, ctx.notes(), '');
      await wait(SETTLE);
      assert.equal(ctx.entry().notes, null, 'a blank note was stored');
    } finally {
      ctx.cleanup();
    }
  });

  test('the note reaches the composed book', async () => {
    const ctx = await withApp();
    try {
      const NOTE = 'Erscheint im PDF.';
      type(ctx.env, ctx.notes(), NOTE);
      await wait(SETTLE);

      const [{ selectChapters, selectViews }, { composeBook }] = await Promise.all([
        import('../src/state/selectors.js'),
        import('../src/book/compose.js'),
      ]);
      const { session, settings, i18n } = ctx.app.ctx;
      const views = selectViews(session.state, settings.state, { now: Date.now() });
      const chapters = selectChapters(views);
      assert.equal(chapters.length, 1, 'the repository did not reach the book');

      const book = composeBook({
        chapters,
        settings: settings.state,
        i18n,
        t: (key, params) => i18n.t(key, params),
      });
      assert.ok(JSON.stringify(book).includes(NOTE), 'the note is not in the book model');
    } finally {
      ctx.cleanup();
    }
  });

  test('a focused field is not overwritten by a store update', async () => {
    // The field syncs from the store, but never while somebody is typing in it
    // — otherwise a background update moves the caret mid-word.
    const ctx = await withApp();
    try {
      const field = ctx.notes();
      field.focus();
      type(ctx.env, field, 'Gerade im Tippen');

      ctx.app.ctx.settings.set(['repoOverrides', SLUG], {
        ...ctx.entry(),
        notes: 'Von woanders gesetzt',
      });
      ctx.render();

      assert.equal(field.value, 'Gerade im Tippen', 'the field was overwritten mid-edit');
    } finally {
      ctx.cleanup();
    }
  });
});

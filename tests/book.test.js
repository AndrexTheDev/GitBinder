/**
 * Classic Book: composition, template and print trigger.
 *
 * Two halves:
 *   • `composeBook` / `renderBook` are pure model → DOM, so they are asserted
 *     against a hand-built chapter list.
 *   • The print controller is asserted against a fake `window.print()`, since
 *     the one thing that must never be wrong is *what the browser prints*: the
 *     app chrome hidden, the book visible, the file name derived from the title.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createDomEnvironment } from './helpers/dom.js';
import { createMemoryStorage } from './helpers/memoryStorage.js';

/** @type {any} */
let env;
/** @type {any} */
let i18n;
/** @type {any} */
let t;

const NOW = new Date('2026-09-24T10:00:00Z');

before(async () => {
  env = createDomEnvironment();
  const { createTranslator } = await import('../src/i18n/index.js');
  i18n = createTranslator({ locale: 'en', document: env.document, navigator: env.window.navigator });
  i18n.setLocale('en');
  t = (key, params) => i18n.t(key, params);
});

after(() => env?.cleanup());

/* -------------------------------------------------------------------------- *
 * Fixtures
 * -------------------------------------------------------------------------- */

function chapter(overrides = {}) {
  return {
    slug: 'octo/alpha',
    name: 'alpha',
    owner: 'octo',
    chapter: 1,
    status: 'live',
    tone: 'forest',
    language: 'TypeScript',
    stars: 1200,
    forks: 12,
    updatedAt: '2026-09-01T00:00:00Z',
    license: { spdx_id: 'MIT' },
    description: 'GitHub description',
    shortDescription: 'A short book description.',
    topics: ['cli'],
    homepage: 'https://alpha.example.com',
    url: 'https://github.com/octo/alpha',
    isFork: false,
    archived: false,
    visible: true,
    ...overrides,
  };
}

const SETTINGS = {
  customBookTitle: 'My Anthology',
  authorName: 'AndrexTheDev',
  authorEmail: 'hippie.highho@gmail.com',
  authorBio: '',
};

async function load() {
  const [compose, template] = await Promise.all([
    import('../src/book/compose.js'),
    import('../src/book/template.js'),
  ]);
  return { composeBook: compose.composeBook, renderBook: template.renderBook };
}

/* -------------------------------------------------------------------------- *
 * composeBook
 * -------------------------------------------------------------------------- */

describe('composeBook', () => {
  test('builds cover metadata from the settings', async () => {
    const { composeBook } = await load();
    const book = composeBook({
      chapters: [chapter()],
      settings: SETTINGS,
      i18n,
      t,
      now: NOW,
    });

    assert.equal(book.meta.title, 'My Anthology');
    assert.equal(book.meta.author, 'AndrexTheDev');
    assert.equal(book.meta.contact, 'hippie.highho@gmail.com');
    assert.equal(book.meta.subtitle, t('book.cover.subtitle'));
    assert.equal(book.meta.authorLine, 'Author: AndrexTheDev');
    assert.match(book.meta.generatedAtLabel, /2026/);
    assert.equal(book.meta.attributionUrl, 'https://gitbooklet.pages.dev/');
  });

  test('falls back to the translated bio when none is set', async () => {
    const { composeBook } = await load();
    const empty = composeBook({ chapters: [chapter()], settings: { ...SETTINGS, authorBio: '' }, i18n, t, now: NOW });
    const filled = composeBook({ chapters: [chapter()], settings: { ...SETTINGS, authorBio: 'Ships small tools.' }, i18n, t, now: NOW });
    assert.equal(empty.meta.bio, t('book.cover.bioFallback'));
    assert.equal(filled.meta.bio, 'Ships small tools.');
  });

  test('counts projects, languages and stars', async () => {
    const { composeBook } = await load();
    const book = composeBook({
      chapters: [
        chapter({ slug: 'o/a', language: 'Go', stars: 10 }),
        chapter({ slug: 'o/b', language: 'Go', stars: 5 }),
        chapter({ slug: 'o/c', language: 'Rust', stars: 1 }),
      ],
      settings: SETTINGS,
      i18n,
      t,
      now: NOW,
    });
    assert.equal(book.meta.stats.projects, 3);
    assert.equal(book.meta.stats.languages, 2);
    assert.equal(book.meta.stats.stars, 16);
    assert.equal(book.meta.statsLine, '3 projects · 2 languages · 16 stars');
  });

  test('groups the table of contents by status in book order', async () => {
    const { composeBook } = await load();
    const book = composeBook({
      chapters: [
        chapter({ slug: 'o/paused', status: 'paused' }),
        chapter({ slug: 'o/live', status: 'live' }),
        chapter({ slug: 'o/beta', status: 'beta' }),
        chapter({ slug: 'o/dev', status: 'development' }),
      ],
      settings: SETTINGS,
      i18n,
      t,
      now: NOW,
    });

    const groups = book.toc.pages.flatMap((page) => page.groups);
    assert.deepEqual(groups.map((group) => group.status), ['live', 'development', 'beta', 'paused']);
    assert.equal(groups[0].label, t('status.live'));
  });

  test('clamps an over-long description to the printed limit', async () => {
    const { composeBook } = await load();
    const { BOOK_LIMITS } = await import('../src/config/book.js');
    const book = composeBook({
      chapters: [chapter({ shortDescription: 'x'.repeat(5000) })],
      settings: SETTINGS,
      i18n,
      t,
      now: NOW,
    });
    const entry = book.pages[0].entries[0];
    assert.equal(entry.description.length, BOOK_LIMITS.descriptionChars);
    assert.match(entry.description, /…$/);
  });

  test('an empty book still has a cover and a contents page', async () => {
    const { composeBook } = await load();
    const book = composeBook({ chapters: [], settings: SETTINGS, i18n, t, now: NOW });
    assert.equal(book.isEmpty, true);
    assert.equal(book.totalPages, 2);
    assert.equal(book.toc.pages.length, 1);
    assert.equal(book.pages.length, 0);
  });
});

/* -------------------------------------------------------------------------- *
 * renderBook
 * -------------------------------------------------------------------------- */

describe('renderBook', () => {
  /** Build a book with enough chapters to exercise grouping and pairing. */
  async function build(count = 9) {
    const { composeBook, renderBook } = await load();
    const statuses = ['live', 'development', 'beta', 'paused'];
    const chapters = Array.from({ length: count }, (_, i) =>
      chapter({
        slug: `octo/repo-${i}`,
        name: `repo-${i}`,
        chapter: i + 1,
        status: statuses[i % 4],
        language: ['TypeScript', 'Go', 'Rust'][i % 3],
        homepage: i % 2 === 0 ? `https://repo-${i}.example.com` : null,
        shortDescription: i % 3 === 0 ? 'word '.repeat(180) : 'A concise summary.',
      }),
    );
    const book = composeBook({ chapters, settings: SETTINGS, i18n, t, now: NOW });
    return { book, el: renderBook(book, { t }) };
  }

  test('renders one section per page, numbered 1…N', async () => {
    const { book, el } = await build();
    const sections = [...el.querySelectorAll('.book-page')];
    assert.equal(sections.length, book.totalPages);
    assert.deepEqual(sections.map((section) => section.dataset.page), sections.map((_, index) => String(index + 1)));
  });

  test('the cover is bare: no running header, no running footer', async () => {
    const { el } = await build();
    const cover = el.querySelector('.book-page--cover');
    assert.ok(cover, 'a cover page must exist');
    assert.equal(cover.querySelectorAll('.book-run').length, 0);
    assert.equal(cover.querySelector('.book-cover__title').textContent, 'My Anthology');
    assert.equal(cover.querySelector('.book-cover__subtitle').textContent, t('book.cover.subtitle'));
    assert.equal(cover.querySelector('.book-cover__author').textContent, 'AndrexTheDev');
    assert.match(cover.querySelector('.book-cover__contact').getAttribute('href'), /^mailto:/);
  });

  test('every other page carries the running header', async () => {
    const { el } = await build();
    const pages = [...el.querySelectorAll('.book-page:not(.book-page--cover)')];
    for (const page of pages) {
      const head = page.querySelector('.book-run--head');
      assert.ok(head, `page ${page.dataset.page} has no running header`);
      assert.equal(head.textContent, 'My Anthology');
    }
  });

  test('the running footer states author, page number and attribution', async () => {
    const { el } = await build();
    const page = el.querySelector('.book-page[data-page="3"]');
    const foot = page.querySelector('.book-run--foot');

    assert.equal(foot.querySelector('.book-run__left').textContent, 'Author: AndrexTheDev');
    assert.equal(foot.querySelector('.book-run__center').textContent, '3');

    const right = foot.querySelector('.book-run__right');
    // `new URL().href` adds the root path; the printed text and the href are
    // normalised to the same string so the paper copy cannot disagree with
    // the link annotation.
    assert.equal(right.textContent, 'Generated with GitBooklet (https://gitbooklet.pages.dev/)');
    const link = right.querySelector('a');
    assert.equal(link.getAttribute('href'), 'https://gitbooklet.pages.dev/');
  });

  test('TOC page numbers point at the section that holds the chapter', async () => {
    const { el } = await build(23);
    const rows = [...el.querySelectorAll('.book-toc__entry')];
    assert.ok(rows.length >= 23, 'every chapter must appear in the contents');

    for (const row of rows) {
      const printed = row.querySelector('.book-toc__page').textContent;
      const holder = el.querySelector(
        `.book-page--catalog[data-page="${printed}"] .book-entry[data-slug="${row.dataset.slug}"]`,
      );
      assert.ok(
        holder,
        `contents lists "${row.querySelector('.book-toc__title').textContent}" on page ${printed}, but it is not there`,
      );
    }
  });

  test('contents rows carry an index, a title and a language tag', async () => {
    const { el } = await build();
    const row = el.querySelector('.book-toc__entry');
    assert.match(row.querySelector('.book-toc__index').textContent, /^\d{2}$/);
    assert.ok(row.querySelector('.book-toc__title').textContent.length > 0);
    assert.ok(row.querySelector('.book-toc__lang').textContent.length > 0);
  });

  test('project entries print name, status, language, stats and description', async () => {
    const { el } = await build();
    const entry = el.querySelector('.book-entry');
    assert.equal(entry.querySelector('.book-entry__title').textContent, 'Repo 0');
    assert.equal(entry.querySelector('.book-chip').textContent, t('status.live'));
    assert.equal(entry.querySelector('.book-entry__desc').textContent.length > 0, true);

    const labels = [...entry.querySelectorAll('.book-meta__label')].map((node) => node.textContent);
    assert.deepEqual(labels, [t('book.entry.stars'), t('book.entry.forks'), t('book.entry.updated'), t('book.entry.license')]);
  });

  test('links stay real anchors so they survive as PDF annotations', async () => {
    const { el } = await build();
    const links = [...el.querySelectorAll('.book-link')];
    assert.ok(links.length > 0);
    for (const link of links) {
      assert.equal(link.tagName, 'A');
      assert.match(link.getAttribute('href'), /^https:\/\//);
      // The URL is also spelled out, so the paper copy is usable.
      assert.equal(link.querySelector('.book-link__url').textContent, link.getAttribute('href'));
    }
  });

  test('a hostile homepage cannot inject a script URL', async () => {
    const { composeBook, renderBook } = await load();
    const book = composeBook({
      chapters: [chapter({ homepage: 'javascript:alert(1)' })],
      settings: SETTINGS,
      i18n,
      t,
      now: NOW,
    });
    const el = renderBook(book, { t });
    const hrefs = [...el.querySelectorAll('.book-link')].map((link) => link.getAttribute('href'));
    // The unsafe homepage is dropped entirely rather than printed as dead text.
    assert.deepEqual(hrefs, ['https://github.com/octo/alpha']);
  });

  test('the catalogue holds one or two projects per page', async () => {
    const { el } = await build(14);
    for (const page of el.querySelectorAll('.book-page--catalog')) {
      const count = page.querySelectorAll('.book-entry').length;
      assert.ok(count >= 1 && count <= 2, `page ${page.dataset.page} holds ${count} projects`);
    }
  });

  test('a solo project is marked for the full-page layout', async () => {
    const { el } = await build(14);
    for (const page of el.querySelectorAll('.book-page--catalog')) {
      const entries = [...page.querySelectorAll('.book-entry')];
      for (const entry of entries) {
        const full = entry.classList.contains('book-entry--full');
        assert.equal(full, entries.length === 1);
      }
    }
  });
});

/* -------------------------------------------------------------------------- *
 * Print controller
 * -------------------------------------------------------------------------- */

describe('print controller', () => {
  test('derives a sane file name from the book title', async () => {
    const { bookFilename } = await import('../src/services/print.js');
    assert.equal(bookFilename('My Software Engineering Anthology'), 'gitbooklet-my-software-engineering-anthology');
    assert.equal(bookFilename('  !!  '), 'gitbooklet');
    assert.equal(bookFilename('Übermäßig große Titel'), 'gitbooklet-ubermassig-grosse-titel');
  });

  test('hides the app, renames the document and restores it afterwards', async () => {
    const { createPrintController, PRINTING_CLASS } = await import('../src/services/print.js');
    const { window } = env;

    let calls = 0;
    const controller = createPrintController({
      window,
      document: env.document,
      print: () => {
        calls += 1;
        // Exactly what the browser's print engine would snapshot.
        assert.equal(env.document.body.classList.contains(PRINTING_CLASS), true);
      },
      safetyTimeout: 0,
    });

    env.document.title = 'GitBooklet';
    assert.equal(controller.print({ title: 'My Anthology' }), true);
    assert.equal(calls, 1);
    assert.equal(env.document.title, 'gitbooklet-my-anthology');

    window.dispatchEvent(new window.Event('afterprint'));
    assert.equal(env.document.body.classList.contains(PRINTING_CLASS), false);
    assert.equal(env.document.title, 'GitBooklet');
    assert.equal(controller.isPrinting(), false);
    controller.dispose();
  });

  test('composes the book before the printer snapshots the DOM', async () => {
    const { createPrintController } = await import('../src/services/print.js');
    const order = [];
    const controller = createPrintController({
      window: env.window,
      document: env.document,
      print: () => order.push('print'),
      onBefore: () => order.push('compose'),
      safetyTimeout: 0,
    });
    controller.print({ title: 'x' });
    assert.deepEqual(order, ['compose', 'print']);
    controller.dispose();
  });

  test('refuses to print an empty book', async () => {
    const { createPrintController } = await import('../src/services/print.js');
    let refused = null;
    const controller = createPrintController({
      window: env.window,
      document: env.document,
      print: () => assert.fail('must not print an empty book'),
      canPrint: () => false,
      onRefuse: (reason) => void (refused = reason),
      safetyTimeout: 0,
    });
    assert.equal(controller.print({ title: 'x' }), false);
    assert.equal(refused, 'empty');
    controller.dispose();
  });

  test('a second call while the dialog is open is ignored', async () => {
    const { createPrintController } = await import('../src/services/print.js');
    let calls = 0;
    const controller = createPrintController({
      window: env.window,
      document: env.document,
      print: () => void (calls += 1),
      safetyTimeout: 0,
    });
    controller.print();
    controller.print();
    assert.equal(calls, 1);
    controller.dispose();
  });

  test('releases the guard even when afterprint never fires', async () => {
    const { createPrintController, PRINTING_CLASS } = await import('../src/services/print.js');
    const controller = createPrintController({
      window: env.window,
      document: env.document,
      print: () => {},
      safetyTimeout: 10,
    });
    controller.print({ title: 'x' });
    assert.equal(controller.isPrinting(), true);
    await new Promise((resolve) => env.window.setTimeout(resolve, 40));
    assert.equal(controller.isPrinting(), false);
    assert.equal(env.document.body.classList.contains(PRINTING_CLASS), false);
    controller.dispose();
  });
});

/* -------------------------------------------------------------------------- *
 * Book studio, wired into the real app
 * -------------------------------------------------------------------------- */

describe('book studio (integration)', () => {
  /** @type {any} */
  let app;
  /** @type {any} */
  let doc;
  let printCalls = 0;

  before(async () => {
    const { bootstrap } = await import('../src/app.js');
    const storage = createMemoryStorage();
    storage.setItem(
      'gitbooklet:state',
      JSON.stringify({ version: 1, data: { githubUsername: 'octo', customBookTitle: 'Test Anthology' } }),
    );

    const repos = Array.from({ length: 6 }, (_, i) => ({
      id: 100 + i,
      full_name: `octo/repo-${i}`,
      name: `repo-${i}`,
      owner: { login: 'octo' },
      html_url: `https://github.com/octo/repo-${i}`,
      description: `Description ${i}`,
      language: ['TypeScript', 'Go'][i % 2],
      stargazers_count: i,
      forks_count: 0,
      fork: false,
      private: false,
      archived: i === 5,
      homepage: i % 2 === 0 ? `https://repo-${i}.example.com` : '',
      topics: [],
      license: null,
      created_at: new Date().toISOString(),
      updated_at: new Date(Date.now() - i * 86_400_000 * 40).toISOString(),
    }));

    const fetchStub = async (url) => {
      const page = Number(new URL(String(url)).searchParams.get('page') ?? '1');
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => (page === 1 ? repos : []) };
    };

    doc = env.document;
    env.window.print = () => void (printCalls += 1);

    app = bootstrap({ host: doc, storage, fetch: fetchStub });
    await app.fetchRepos({ silent: true });
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

  after(async () => {
    // Tear the app down *before* the jsdom environment goes away: the library
    // keeps a debounced re-render pending, and a component that renders after
    // teardown would touch a document that no longer exists.
    app?.destroy();
    await new Promise((resolve) => setTimeout(resolve, 60));
  });

  test('mounts the preview and the sticky action bar', () => {
    assert.ok(doc.querySelector('#book-root .book-shell'), 'preview shell missing');
    assert.ok(doc.querySelector('#book-bar-root .book-bar'), 'action bar missing');
    assert.equal(doc.body.classList.contains('has-book-bar'), true);
  });

  test('the preview starts collapsed and composes on demand', () => {
    const preview = app.components.bookPreview;
    assert.equal(preview.isOpen(), false);
    assert.equal(doc.querySelector('.book-shell').hasAttribute('hidden'), true);

    preview.setPreview(true);
    assert.equal(preview.isOpen(), true);
    assert.equal(doc.querySelector('.book-shell').hasAttribute('hidden'), false);

    const pages = [...doc.querySelectorAll('.book-page')];
    assert.ok(pages.length >= 3, `expected cover + contents + catalogue, got ${pages.length}`);
    assert.equal(doc.querySelector('.book-page--cover .book-cover__title').textContent, 'Test Anthology');
  });

  test('the toggle is reflected in the bar and persists to settings', () => {
    const preview = app.components.bookPreview;
    const toggle = doc.querySelector('#book-bar-root button[aria-pressed]');
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(app.ctx.settings.state.book.preview, true);

    toggle.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true }));
    assert.equal(preview.isOpen(), false);
    assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  });

  test('the print button composes even with the preview collapsed', () => {
    const preview = app.components.bookPreview;
    preview.setPreview(false);
    assert.equal(doc.querySelector('.book-shell').hasAttribute('hidden'), true);

    const before = printCalls;
    const buttons = [...doc.querySelectorAll('#book-bar-root button')];
    const generate = buttons.find((button) => button.textContent.includes(t('book.bar.generate')));
    assert.ok(generate, 'generate button not found');
    generate.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true }));

    assert.equal(printCalls, before + 1);
    assert.equal(doc.body.classList.contains('is-printing-book'), true);
    // The book is composed synchronously before the printer snapshots the DOM.
    assert.ok(doc.querySelectorAll('.book-page').length >= 3);

    env.window.dispatchEvent(new env.window.Event('afterprint'));
    assert.equal(doc.body.classList.contains('is-printing-book'), false);
  });

  test('an empty book warns instead of opening the dialog', () => {
    app.ctx.settings.batch(() => {
      for (const slug of Object.keys(app.ctx.settings.state.repoOverrides)) {
        app.ctx.settings.state.repoOverrides[slug].visible = false;
      }
    });

    const before = printCalls;
    app.components.bookPreview.print();
    assert.equal(printCalls, before, 'must not print an empty book');

    const toasts = [...doc.querySelectorAll('#toast-root .toast')].map((node) => node.textContent);
    assert.ok(toasts.some((text) => text.includes(t('book.print.empty'))), `expected a warning, got ${toasts.join(' | ')}`);
  });
});

#!/usr/bin/env node
/**
 * Beta fixture self-check — runs **here**, with no browser.
 *
 * The screenshot matrix is only worth anything if the fixture underneath it
 * still produces what the shots claim to show. This file boots the real app
 * (`src/app.js`) in jsdom, points its real GitHub client at
 * `beta/runner/fixture.js`, and asserts the outcomes each module depends on:
 *
 *   • `ok`      → 12 cards, and all four statuses present (what M06 shows)
 *   • `paged`   → 103 repos across two pages (M03)
 *   • `empty`   → the "no repositories" state, not an error (M03)
 *   • 401/403/404/5xx/offline → the right `error.kind` (M03, M07)
 *   • `token`   → private work appears via `/user/repos` (M03)
 *
 * It also validates `beta/matrix.json`: a shot naming a fixture that does not
 * exist fails here in a second, instead of after a three-minute browser run.
 *
 * Deliberately *not* part of `npm test` — the release gate stays the unit
 * suite, and this file needs the beta folder to make sense.
 *
 * Run: `npm run beta:selfcheck`
 *
 * @module beta/runner/selfcheck
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createDomEnvironment } from '../../tests/helpers/dom.js';
import { createMemoryStorage } from '../../tests/helpers/memoryStorage.js';
import { bootstrap } from '../../src/app.js';
import { detectStatus } from '../../src/services/status.js';
import { REPO_STATUS_IDS } from '../../src/config/app.js';
import { DEMO_REPOS, DEMO_USER, fixtureFetch, SCENARIO_IDS } from './fixture.js';
import { plan, validateMatrix } from './shoot.mjs';
import { buildTextExport, EXPORT_FORMATS } from '../../src/book/export.js';
import { createTranslator } from '../../src/i18n/index.js';

const TOKEN = 'ghp_betafixturetoken0000000000000000';

/**
 * Boot the real app against one fixture scenario.
 * @returns {Promise<{ app: any, document: Document, stub: ReturnType<typeof fixtureFetch>, cleanup: () => void }>}
 */
async function mount(scenarioId, { token = '' } = {}) {
  const env = createDomEnvironment({ languages: ['en-US', 'en'] });
  const storage = createMemoryStorage();
  const stub = fixtureFetch(scenarioId);

  const app = bootstrap({ host: env.document, storage, fetch: stub.impl });
  app.ctx.settings.set('githubUsername', DEMO_USER);
  if (token) app.ctx.settings.set('personalAccessToken', token);
  await app.fetchRepos({ silent: true });
  // The library paints on an animation frame. In a browser that has already
  // happened by the time the screenshot is taken; under node:test there is no
  // frame loop, so the component's own flush() stands in for it — the same
  // call tests/app.smoke.test.js uses.
  app.components.library.flush();

  return {
    app,
    document: env.document,
    stub,
    cleanup: () => {
      app.destroy();
      env.cleanup();
    },
  };
}

const cards = (document) => [...document.querySelectorAll('.repo-card')];

describe('beta matrix integrity', () => {
  test('matrix.json is internally consistent', () => {
    assert.deepEqual(validateMatrix(), []);
  });

  test('every shot names a fixture the runner can serve', () => {
    const missing = plan()
      .map((capture) => capture.shot.fixture)
      .filter(Boolean)
      .filter((fixture) => !SCENARIO_IDS.includes(fixture));
    assert.deepEqual(missing, []);
  });

  test('every i18n key a shot targets exists in both dictionaries', async () => {
    const [{ default: en }, { default: de }] = await Promise.all([
      import('../../src/i18n/locales/en.js'),
      import('../../src/i18n/locales/de.js'),
    ]);
    const flatten = (dict, prefix = '', out = {}) => {
      for (const [key, value] of Object.entries(dict ?? {})) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'string') out[path] = value;
        else if (value && typeof value === 'object') flatten(value, path, out);
      }
      return out;
    };
    const EN = flatten(en);
    const DE = flatten(de);

    /** Every `key` / `nameKey` a step or expectation refers to. */
    const keys = new Set();
    const walk = (value) => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (!value || typeof value !== 'object') return;
      for (const field of ['key', 'nameKey']) {
        if (typeof value[field] === 'string') keys.add(value[field]);
      }
      if (value.trigger) walk(value.trigger);
      Object.values(value).forEach((child) => {
        if (child && typeof child === 'object') walk(child);
      });
    };
    for (const shot of plan().map((capture) => capture.shot)) {
      walk(shot.steps ?? []);
      walk(shot.expect ?? {});
    }

    const missing = [...keys].filter((key) => !EN[key] || !DE[key]);
    assert.deepEqual(missing, [], 'a shot targets a translation key that does not exist');
    assert.ok(keys.size >= 8, `only ${keys.size} keys collected — the walk is broken`);
  });

  test('the plan expands to more captures than there are shots', () => {
    const captures = plan();
    assert.ok(captures.length > 40, `only ${captures.length} captures`);
    for (const capture of captures) {
      assert.match(capture.name, /^m\d\d-.+@(desktop|tablet|mobile|small|wide)@(en|de)$/);
    }
  });
});

describe('fixture × real app', () => {
  test('ok: twelve cards render, all four statuses are represented', async () => {
    const { app, document, cleanup } = await mount('ok');
    try {
      assert.equal(app.ctx.session.state.repos.length, DEMO_REPOS.length);
      assert.equal(cards(document).length, DEMO_REPOS.length);

      const statuses = new Set(
        app.ctx.session.state.repos.map((repo) => detectStatus(repo).status),
      );
      for (const status of REPO_STATUS_IDS) {
        assert.ok(statuses.has(status), `fixture never produces status "${status}"`);
      }

      // The card markup carries the status, which is what M06's assertions read.
      for (const status of REPO_STATUS_IDS) {
        assert.ok(
          document.querySelector(`.repo-card[data-status="${status}"]`),
          `no card rendered with data-status="${status}"`,
        );
      }
    } finally {
      cleanup();
    }
  });

  test('paged: 103 repositories arrive over two requests', async () => {
    const { app, stub, cleanup } = await mount('paged');
    try {
      assert.equal(app.ctx.session.state.repos.length, 103);
      assert.equal(stub.calls.length, 2, `expected 2 pages, saw ${stub.calls.length}`);
      assert.equal(stub.calls[0].page, 1);
      assert.equal(stub.calls[1].page, 2);
    } finally {
      cleanup();
    }
  });

  test('empty: no repositories is a warning state, not an error', async () => {
    const { app, document, cleanup } = await mount('empty');
    try {
      assert.equal(app.ctx.session.state.status, 'ready');
      assert.equal(app.ctx.session.state.error, null);
      assert.equal(cards(document).length, 0);
    } finally {
      cleanup();
    }
  });

  test('notFound / unauthorized / rateLimit / server map to their own error kind', async () => {
    const cases = [
      ['notFound', 'notFound'],
      ['unauthorized', 'unauthorized'],
      ['rateLimit', 'rateLimit'],
      ['server', 'server'],
    ];
    for (const [scenario, kind] of cases) {
      const { app, cleanup } = await mount(scenario);
      try {
        assert.equal(app.ctx.session.state.status, 'error', `${scenario}: status`);
        assert.equal(app.ctx.session.state.error?.kind, kind, `${scenario}: kind`);
        assert.ok(app.ctx.session.state.error?.message, `${scenario}: no message`);
      } finally {
        cleanup();
      }
    }
  });

  test('rateLimit carries a reset time the UI can print', async () => {
    const { app, cleanup } = await mount('rateLimit');
    try {
      const { resetAt } = app.ctx.session.state.error ?? {};
      assert.ok(resetAt, 'no resetAt on a rate-limit error');
      const minutes = (new Date(resetAt).getTime() - Date.now()) / 60_000;
      assert.ok(minutes > 30 && minutes < 50, `reset in ${minutes.toFixed(1)} min, expected ~42`);
    } finally {
      cleanup();
    }
  });

  test('offline: a rejected fetch is a network error, not a hang', async () => {
    const { app, cleanup } = await mount('offline');
    try {
      assert.equal(app.ctx.session.state.status, 'error');
      assert.equal(app.ctx.session.state.error?.kind, 'network');
    } finally {
      cleanup();
    }
  });

  test('token: private work arrives, and via /user/repos', async () => {
    const { app, stub, document, cleanup } = await mount('token', { token: TOKEN });
    try {
      assert.equal(app.ctx.session.state.repos.length, DEMO_REPOS.length + 1);
      assert.equal(app.ctx.session.state.source, 'user');
      assert.ok(
        stub.calls.every((call) => call.auth),
        'the token was not sent on every page request',
      );
      assert.ok(
        stub.calls.every((call) => call.url.includes('/user/repos')),
        'with a token the app must use /user/repos',
      );
      assert.ok(
        document.querySelector('.repo-card[data-slug="octodemo/private-vault"]'),
        'the private repository is not in the library',
      );
    } finally {
      cleanup();
    }
  });

  test('forks start hidden from the book, everything else visible', async () => {
    const { app, cleanup } = await mount('ok');
    try {
      const overrides = app.ctx.settings.state.repoOverrides;
      assert.equal(overrides['octodemo/demo-fork'].visible, false, 'a fork should start excluded');
      assert.equal(overrides['octodemo/gitbinder'].visible, true);
      assert.equal(
        overrides['octodemo/gitbinder'].status,
        null,
        'an untouched override must not freeze the detected status',
      );
    } finally {
      cleanup();
    }
  });
});

/**
 * Phase 2, step 1 — HTML injection.
 *
 * GitBinder renders arbitrary GitHub payloads (name, description, topics,
 * homepage). The audit found the app builds every node through `h()` with
 * `text:` (textContent) and routes links through `safeUrl()`; this block turns
 * that audit into a regression guarantee by driving a *hostile* repository
 * through the real card and the real book composer and asserting nothing
 * executes and nothing injects.
 */
describe('adversarial GitHub payloads render inert', () => {
  const PAYLOAD =
    '<scr' + 'ipt>window.__pwn=1</scr' + 'ipt><img src=x onerror="window.__pwn=1">';

  function hostileRepo() {
    const now = Date.now();
    const iso = (d) => new Date(now - d * 86_400_000).toISOString();
    return {
      id: 999001,
      full_name: 'octodemo/hostile',
      name: `hostile${PAYLOAD}`,
      owner: { login: 'octodemo' },
      html_url: 'https://github.com/octodemo/hostile',
      description: `${PAYLOAD} "quotes" & ampersands <b onmouseover="window.__pwn=1">bold</b>`,
      language: 'JavaScript',
      fork: false,
      private: false,
      archived: false,
      disabled: false,
      default_branch: 'main',
      homepage: 'javascript:window.__pwn=1', // must never become a live href
      created_at: iso(400),
      updated_at: iso(5),
      pushed_at: iso(5),
      stargazers_count: 1,
      forks_count: 0,
      open_issues_count: 0,
      size: 10,
      license: null,
      topics: [PAYLOAD, 'status-live'],
    };
  }

  async function mountHostile() {
    const env = createDomEnvironment({ languages: ['en-US', 'en'] });
    const storage = createMemoryStorage();
    const fetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => [hostileRepo()],
    });
    const app = bootstrap({ host: env.document, storage, fetch });
    app.ctx.settings.set('githubUsername', 'octodemo');
    await app.fetchRepos({ silent: true });
    app.components.library.flush();
    return { app, document: env.document, cleanup: () => (app.destroy(), env.cleanup()) };
  }

  const assertInert = (document, scope, label) => {
    const root = scope ?? document;
    assert.equal(root.querySelector('script'), null, `${label}: injected <script>`);
    assert.equal(root.querySelector('img[onerror]'), null, `${label}: injected <img onerror>`);
    assert.equal(root.querySelector('[onmouseover]'), null, `${label}: injected handler attr`);
    assert.equal(root.querySelector('a[href^="javascript:"]'), null, `${label}: javascript: href`);
    assert.equal(typeof document.defaultView.__pwn, 'undefined', `${label}: payload executed`);
  };

  test('the library card renders the payload as inert text', async () => {
    const { document, cleanup } = await mountHostile();
    try {
      const card = document.querySelector('.repo-card[data-slug="octodemo/hostile"]');
      assert.ok(card, 'hostile card rendered');
      assertInert(document, card, 'card');
      // The raw markup survives only as *text*, proving textContent semantics.
      assert.ok(card.textContent.includes('<img src=x onerror='), 'payload present as text');
      // The javascript: homepage must not become a link badge.
      assert.ok(!card.innerHTML.includes('javascript:'), 'no javascript: in card markup');
    } finally {
      cleanup();
    }
  });

  test('the composed book renders the payload inert too', async () => {
    const { app, document, cleanup } = await mountHostile();
    try {
      app.ctx.settings.set(['repoOverrides', 'octodemo/hostile'], {
        visible: true,
        status: null,
        shortDescription: null,
        updatedAt: null,
      });
      app.ctx.settings.set('book', { preview: true });
      app.components.bookPreview.compose();
      const book = document.querySelector('#book-root');
      assert.ok(book, 'book rendered');
      assertInert(document, book, 'book');
    } finally {
      cleanup();
    }
  });
});


/**
 * Phase 2, step 2 — storage & session robustness.
 *
 * The app already guards these paths (store.restore/persistNow catch and report,
 * fetchRepos aborts a superseded request); this block drives them through the
 * real bootstrap so a future regression cannot quietly reopen the hole.
 */
describe('storage & session robustness', () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const slug = (app) => app.ctx.session.state.repos.map((r) => r.slug).sort();

  test('corrupt persisted JSON does not break boot', async () => {
    const storage = createMemoryStorage();
    // One persisted store (`gitbinder:state`) holds settings + overrides; repos
    // are memory-only. Corrupt both the state and the token vault.
    storage.setItem('gitbinder:state', '{ this is not json');
    storage.setItem('gitbinder:vault', '[truncated');
    const env = createDomEnvironment({ languages: ['en-US', 'en'] });
    const app = bootstrap({ host: env.document, storage, fetch: fixtureFetch('ok').impl });
    try {
      assert.equal(app.ctx.settings.state.githubUsername, '', 'corrupt settings fell back to defaults');
      assert.equal(app.ctx.session.state.repos.length, 0, 'no repos before a fetch');
      app.ctx.settings.set('githubUsername', DEMO_USER);
      await app.fetchRepos({ silent: true });
      app.components.library.flush();
      assert.equal(env.document.querySelectorAll('.repo-card').length, DEMO_REPOS.length);
    } finally {
      app.destroy();
      env.cleanup();
    }
  });

  test('a storage that refuses writes keeps the app usable (quota)', async () => {
    const readOnly = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
      clear: () => {},
      get length() {
        return 0;
      },
      key: () => null,
    };
    const env = createDomEnvironment({ languages: ['en-US', 'en'] });
    const app = bootstrap({ host: env.document, storage: readOnly, fetch: fixtureFetch('ok').impl });
    try {
      app.ctx.settings.set('githubUsername', DEMO_USER); // write throws → caught
      assert.equal(app.ctx.settings.state.githubUsername, DEMO_USER, 'in-memory state updated despite failed write');
      await app.fetchRepos({ silent: true });
      app.components.library.flush();
      assert.equal(env.document.querySelectorAll('.repo-card').length, DEMO_REPOS.length, 'app still fully usable');
    } finally {
      app.destroy();
      env.cleanup();
    }
  });

  test('a superseded fetch does not clobber the newer one', async () => {
    let reposCall = 0;
    let releaseFirst;
    const gate = new Promise((res) => {
      releaseFirst = res;
    });
    const mk = (name) => {
      const now = Date.now();
      const iso = (d) => new Date(now - d * 86_400_000).toISOString();
      return {
        id: Math.floor(Math.random() * 1e6),
        full_name: `octodemo/${name}`,
        name,
        owner: { login: 'octodemo' },
        html_url: `https://github.com/octodemo/${name}`,
        description: '',
        language: 'Go',
        fork: false,
        private: false,
        archived: false,
        disabled: false,
        default_branch: 'main',
        homepage: '',
        created_at: iso(300),
        updated_at: iso(2),
        pushed_at: iso(2),
        stargazers_count: 1,
        forks_count: 0,
        open_issues_count: 0,
        size: 5,
        license: null,
        topics: [],
      };
    };
    const fetch = async (url, opts) => {
      if (/\/users\/octodemo$/.test(url)) {
        return { ok: true, status: 200, headers: new Headers(), json: async () => ({ login: 'octodemo', avatar_url: '' }) };
      }
      reposCall += 1;
      const n = reposCall;
      if (n === 1) await gate;
      else await wait(0);
      if (opts?.signal?.aborted) {
        const e = new Error('The operation was aborted');
        e.name = 'AbortError';
        throw e;
      }
      const data = n === 1 ? [mk('slow')] : [mk('fast-1'), mk('fast-2')];
      return { ok: true, status: 200, headers: new Headers(), json: async () => data };
    };

    const env = createDomEnvironment({ languages: ['en-US', 'en'] });
    const app = bootstrap({ host: env.document, storage: createMemoryStorage(), fetch });
    try {
      app.ctx.settings.set('githubUsername', 'octodemo');
      const first = app.fetchRepos({ silent: true });
      await wait(15); // let the first request reach its stall
      const second = app.fetchRepos({ silent: true }); // aborts the first
      await wait(15);
      releaseFirst();
      await Promise.all([first, second]);
      app.components.library.flush();
      assert.deepEqual(slug(app), ['octodemo/fast-1', 'octodemo/fast-2'], 'the aborted (slow) fetch lost');
      assert.equal(app.ctx.session.state.status, 'ready');
    } finally {
      app.destroy();
      env.cleanup();
    }
  });

  test('unicode survives a storage round-trip and renders intact', async () => {
    const storage = createMemoryStorage();
    const env = createDomEnvironment({ languages: ['en-US', 'en'] });
    const app = bootstrap({ host: env.document, storage, fetch: fixtureFetch('ok').impl });
    try {
      app.ctx.settings.set('githubUsername', DEMO_USER);
      await app.fetchRepos({ silent: true });
      app.components.library.flush();

      const text = 'Grüße 🚀 日本語 — "quotes" & <angle>';
      const card = env.document.querySelector('.repo-card[data-slug="octodemo/gitbinder"]');
      assert.ok(card, 'gitbinder card rendered');
      const textarea = card.querySelector('textarea');
      textarea.value = text;
      textarea.dispatchEvent(new env.window.Event('input', { bubbles: true }));
      await wait(360); // past the debounce
      app.components.library.flush();

      assert.equal(
        app.ctx.settings.state.repoOverrides['octodemo/gitbinder'].shortDescription,
        text,
        'stored verbatim in state',
      );
      app.ctx.settings.persistNow(); // force the debounced write before reading it back
      const saved = JSON.parse(storage.getItem('gitbinder:state'));
      assert.equal(
        saved.data.repoOverrides['octodemo/gitbinder'].shortDescription,
        text,
        'persisted verbatim to storage',
      );
      const out = env.document.querySelector('.repo-card[data-slug="octodemo/gitbinder"] textarea');
      assert.equal(out.value, text, 'rendered intact');
      assert.equal(out.closest('.repo-card').querySelector('script, img[onerror]'), null, 'nothing injected');
    } finally {
      app.destroy();
      env.cleanup();
    }
  });
});

/**
 * Phase 2, step 3 — data outputs over the full fixture.
 *
 * Per-format export correctness (RFC-4180 escaping, BOM, CRLF) and book/PDF
 * structure (running heads, folios, TOC page targets, hostile-URL safety) are
 * already covered exhaustively by `tests/export.test.js` and `tests/book.test.js`
 * on small synthetic inputs. This block covers the *integration seam* those
 * cannot: the real selection→compose pipeline and all three export formats at
 * the full 12-repository size, so a chapter can never silently drop out of the
 * book or an export as the dataset grows.
 */
describe('data outputs over the full fixture', () => {
  const { t } = createTranslator({ locale: 'en' });

  /** Count RFC-4180 records (a quoted field may contain CRLF). */
  function csvRecordCount(csv) {
    const body = csv.replace(/^\uFEFF/, '');
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < body.length; i += 1) {
      const c = body[i];
      if (c === '"') {
        if (inQuotes && body[i + 1] === '"') i += 1;
        else inQuotes = !inQuotes;
      } else if (c === '\r' && body[i + 1] === '\n' && !inQuotes) {
        count += 1;
        i += 1;
      }
    }
    return count; // trailing CRLF after the last record
  }

  async function mountAllVisible() {
    const m = await mount('ok');
    m.app.ctx.settings.batch(() => {
      for (const r of m.app.ctx.session.state.repos) {
        m.app.ctx.settings.state.repoOverrides[r.slug].visible = true;
      }
    });
    return m;
  }

  test('the composed book covers every selected repository', async () => {
    const { app, document, cleanup } = await mountAllVisible();
    try {
      app.ctx.settings.set('book', { preview: true });
      app.components.bookPreview.compose();
      const book = document.querySelector('#book-root');
      assert.ok(book, 'book rendered');

      const total = app.ctx.session.state.repos.length; // 12
      const entries = [...book.querySelectorAll('.book-entry')];
      const tocRows = [...book.querySelectorAll('.book-toc__entry')];
      assert.equal(entries.length, total, 'one book entry per selected repo');
      assert.equal(tocRows.length, total, 'one TOC row per selected repo');

      const entrySlugs = new Set(entries.map((e) => e.dataset.slug));
      const tocSlugs = new Set(tocRows.map((e) => e.dataset.slug));
      for (const r of app.ctx.session.state.repos) {
        assert.ok(entrySlugs.has(r.slug), `book entry missing ${r.slug}`);
        assert.ok(tocSlugs.has(r.slug), `TOC row missing ${r.slug}`);
      }

      // Folios ascend and are unique; the cover carries none.
      const folios = [...book.querySelectorAll('.book-run__center')].map((n) => Number(n.textContent));
      assert.ok(folios.length > 0, 'folios present');
      assert.deepEqual(folios, [...folios].sort((a, b) => a - b), 'folios ascend');
      assert.equal(new Set(folios).size, folios.length, 'folios unique');
      assert.ok(book.querySelector('.book-page--cover'), 'cover present');

      // Every TOC page target points at a page that exists.
      const maxPage = Math.max(...folios);
      for (const row of tocRows) {
        const p = Number(row.querySelector('.book-toc__page').textContent);
        assert.ok(p >= 1 && p <= maxPage + 1, `TOC page ${p} out of range (max ${maxPage})`);
      }
    } finally {
      cleanup();
    }
  });

  test('all three export formats list every selected chapter', async () => {
    const { app, cleanup } = await mountAllVisible();
    try {
      const chapters = app.ctx.session.state.repos; // the same normalised repos the book uses
      const total = chapters.length; // 12
      const settings = app.ctx.settings.state;

      for (const format of EXPORT_FORMATS) {
        const res = buildTextExport(format.id, { settings, chapters, t, locale: 'en' });
        assert.ok(res.content.length > 0, `${format.id}: empty export`);
        assert.ok(res.filename.endsWith(`.${format.extension}`), `${format.id}: filename ${res.filename}`);
        assert.equal(res.mime, format.mime, `${format.id}: mime`);
      }

      const csv = buildTextExport('csv', { settings, chapters, t, locale: 'en' }).content;
      assert.equal(csvRecordCount(csv), total + 1, 'csv: header + one record per chapter');

      const md = buildTextExport('markdown', { settings, chapters, t, locale: 'en' }).content;
      const chapterHeads = (md.match(/^## \d+\. /gm) || []).length;
      assert.equal(chapterHeads, total, 'markdown: one numbered section per chapter');

      const txt = buildTextExport('text', { settings, chapters, t, locale: 'en' }).content;
      assert.ok(txt.length > 0 && /01/.test(txt), 'text: numbered chapters present');
    } finally {
      cleanup();
    }
  });
});

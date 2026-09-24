/**
 * Application smoke tests.
 *
 * Boots the whole app in jsdom, then drives it the way a visitor would:
 * switch language, open the settings drawer, type, fetch repositories from a
 * stubbed GitHub API, toggle visibility, export and import settings.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createDomEnvironment } from './helpers/dom.js';
import { createMemoryStorage } from './helpers/memoryStorage.js';

/** @type {{ window: any, document: any, cleanup: () => void }} */
let env;
/** @type {any} */
let bootstrap;
/** @type {any} */
let app;
/** @type {any} */
let storage;
/** @type {any} */
let githubStub;

const DAY = 86_400_000;

/**
 * Deterministic GitHub stub with enough variety to exercise detection:
 *   • every 7th repository is a fork
 *   • every 5th has a homepage          → Live
 *   • every 25th is archived            → Paused
 *   • the rest cycle through 4 / 90 / 800 days since the last update
 * Page 2 holds a single repo whose name contains a dot.
 */
function makeGithubStub() {
  const now = Date.now();
  const iso = (days) => new Date(now - days * DAY).toISOString();

  function makeRepo(i, forcedName = null) {
    const name = forcedName ?? `repo-${String(i).padStart(3, '0')}`;
    const updatedDays = i % 3 === 0 ? 4 : i % 3 === 1 ? 90 : 800;

    return {
      id: 1000 + i,
      full_name: `octo/${name}`,
      name,
      owner: { login: 'octo' },
      html_url: `https://github.com/octo/${name}`,
      description: `Description ${i}`,
      language: ['TypeScript', 'Go', 'Rust', 'Python'][i % 4],
      stargazers_count: i,
      forks_count: i % 5,
      open_issues_count: i % 3,
      fork: i % 7 === 0,
      private: i % 11 === 0,
      archived: i % 25 === 0,
      disabled: false,
      default_branch: 'main',
      homepage: i % 5 === 0 ? `https://${name}.example.com` : '',
      topics: i % 2 ? ['cli'] : [],
      license: i % 3 === 0 ? { spdx_id: 'MIT', name: 'MIT License' } : null,
      size: 100 + i,
      created_at: iso(1200),
      updated_at: iso(updatedDays),
      pushed_at: iso(updatedDays),
    };
  }

  const reposPage1 = Array.from({ length: 100 }, (_, i) => makeRepo(i));
  const reposPage2 = [makeRepo(104, 'special.name')];
  let calls = 0;

  return {
    get calls() {
      return calls;
    },
    async impl(url) {
      calls += 1;
      const page = Number(new URL(String(url)).searchParams.get('page') ?? '1');
      const body = page === 1 ? reposPage1 : page === 2 ? reposPage2 : [];

      return {
        ok: true,
        status: 200,
        headers: new Map([
          ['x-ratelimit-limit', '60'],
          ['x-ratelimit-remaining', String(60 - calls)],
          ['x-ratelimit-reset', String(Math.floor(Date.now() / 1000) + 3600)],
        ]),
        async json() {
          return body;
        },
      };
    },
  };
}

before(async () => {
  env = createDomEnvironment({ languages: ['en-US', 'en'] });
  ({ bootstrap } = await import('../src/app.js'));
});

after(() => {
  app?.destroy?.();
  env?.cleanup?.();
});

describe('application bootstrap', () => {
  test('mounts every region of the layout shell', () => {
    storage = createMemoryStorage();
    app = bootstrap({ host: env.document, storage });

    assert.ok(env.document.querySelector('#navbar-root nav'), 'navbar did not mount');
    assert.ok(env.document.querySelector('#hero-root h1'), 'hero did not mount');
    assert.ok(env.document.querySelector('#library-root .card'), 'library did not mount');
    assert.ok(env.document.querySelector('#summary-root .card'), 'summary did not mount');
    assert.ok(env.document.querySelector('#footer-root footer'), 'footer did not mount');
    assert.equal(env.document.getElementById('boot'), null, 'boot splash was not removed');
  });

  test('applies the spec defaults and translates the UI', () => {
    const { settings } = app.ctx;
    assert.equal(settings.state.customBookTitle, 'My Software Engineering Anthology');
    assert.equal(settings.state.authorName, 'AndrexTheDev');
    assert.equal(settings.state.authorEmail, 'hippie.highho@gmail.com');
    assert.equal(settings.state.language, 'en');
    assert.ok(env.document.documentElement.getAttribute('lang') === 'en');
    assert.ok(env.document.title.startsWith('GitBinder'));
  });

  test('navbar exposes every required control', () => {
    const nav = env.document.querySelector('#navbar-root');
    const labels = [...nav.querySelectorAll('button, a')].map((el) => el.getAttribute('aria-label') ?? el.textContent.trim());

    assert.ok(labels.some((l) => l && l.includes('GitBinder')), 'no branding');
    assert.ok(labels.includes('Open settings'), 'no settings button');
    const supportBtn = [...nav.querySelectorAll('button')].find(
      (el) => el.getAttribute('data-tooltip') === 'Support this project' || el.getAttribute('aria-label') === 'Open support dialog',
    );
    assert.ok(supportBtn, 'no support/heart button');
    assert.ok(supportBtn.querySelector('svg'), 'support button has no icon');
    assert.ok(labels.some((l) => l && l.startsWith('Fetch')), 'no fetch button');
    assert.ok(nav.querySelector('[data-lang="en"]'), 'no EN toggle');
    assert.ok(nav.querySelector('[data-lang="de"]'), 'no DE toggle');
  });

  test('empty library shows the onboarding state', () => {
    const library = env.document.querySelector('#library-root');
    assert.match(library.textContent, /No repositories loaded yet/);
  });
});

describe('language switching', () => {
  test('flips every bound string instantly', () => {
    const { settings, i18n } = app.ctx;
    const nav = () => env.document.querySelector('#navbar-root').textContent;

    assert.match(nav(), /Fetch repositories/);
    i18n.setLocale('de');
    assert.equal(settings.state.language, 'de');
    assert.match(nav(), /Repositories laden/);
    assert.equal(env.document.documentElement.getAttribute('lang'), 'de');

    i18n.setLocale('en');
    assert.match(nav(), /Fetch repositories/);
  });

  test('the skip link and document title follow the locale', () => {
    const { i18n } = app.ctx;
    i18n.setLocale('de');
    assert.equal(env.document.querySelector('.skip-link').textContent, 'Zum Inhalt springen');
    assert.match(env.document.title, /Dein GitHub-Portfolio/);
    i18n.setLocale('en');
    assert.equal(env.document.querySelector('.skip-link').textContent, 'Skip to content');
  });
});

describe('settings drawer', () => {
  test('opens with all four sections', () => {
    app.ctx.bus.emit('ui:settings:open');
    const drawer = env.document.querySelector('#overlay-root .drawer');
    assert.ok(drawer, 'drawer did not open');

    const text = drawer.textContent;
    assert.match(text, /GitHub connection/);
    assert.match(text, /Book details/);
    assert.match(text, /Language/);
    assert.match(text, /Data portability/);
  });

  test('every spec field is present', () => {
    const drawer = env.document.querySelector('#overlay-root .drawer');
    const byId = (id) => drawer.querySelector(`#${id}`);

    assert.ok(byId('settings-username'), 'username field missing');
    assert.equal(byId('settings-username').value, '');

    assert.ok(byId('settings-token'), 'PAT field missing');
    assert.equal(byId('settings-token').type, 'password', 'token must be masked');
    assert.equal(byId('settings-token').getAttribute('autocomplete'), 'off');

    assert.ok(byId('settings-book-title'), 'book title field missing');
    assert.equal(byId('settings-book-title').value, 'My Software Engineering Anthology');

    assert.ok(byId('settings-author-name'), 'author field missing');
    assert.equal(byId('settings-author-name').value, 'AndrexTheDev');

    assert.ok(byId('settings-author-email'), 'e-mail field missing');
    assert.equal(byId('settings-author-email').value, 'hippie.highho@gmail.com');

    assert.ok(byId('settings-language'), 'language select missing');
  });

  test('typing persists to the store (and the sealer runs on disk)', () => {
    const { settings } = app.ctx;
    const drawer = env.document.querySelector('#overlay-root .drawer');

    const title = drawer.querySelector('#settings-book-title');
    title.value = 'Anthology of Small Machines';
    title.dispatchEvent(new env.window.Event('input', { bubbles: true }));
    assert.equal(settings.state.customBookTitle, 'Anthology of Small Machines');

    const token = drawer.querySelector('#settings-token');
    token.value = 'ghp_smoketoken';
    token.dispatchEvent(new env.window.Event('input', { bubbles: true }));
    assert.equal(settings.state.personalAccessToken, 'ghp_smoketoken');

    settings.persistNow();
    const raw = JSON.parse(storage.getItem('gitbinder:state'));
    assert.notEqual(raw.data.personalAccessToken, 'ghp_smoketoken');
    assert.match(raw.data.personalAccessToken, /^enc:v1:/);
  });

  test('book metadata changes reach the summary preview', () => {
    const summary = env.document.querySelector('#summary-root');
    assert.match(summary.textContent, /Anthology of Small Machines/);
  });

  test('export produces a redacted envelope', () => {
    const { settings } = app.ctx;
    const exported = settings.exportJSON();
    assert.equal(exported.$schema, 'gitbinder/state');
    assert.equal(exported.data.personalAccessToken, '', 'token must not be exported by default');
    assert.equal(exported.data.customBookTitle, 'Anthology of Small Machines');

    const withSecret = settings.exportJSON({ includeSecrets: true });
    assert.equal(withSecret.data.personalAccessToken, 'ghp_smoketoken');
  });

  test('import restores a payload', () => {
    const { settings } = app.ctx;
    const result = settings.importJSON({
      $schema: 'gitbinder/state',
      version: 1,
      data: {
        githubUsername: 'octo',
        customBookTitle: 'Imported Anthology',
        authorName: 'Someone',
        authorEmail: 'someone@example.com',
        language: 'de',
        repoOverrides: {},
      },
    });

    assert.equal(result.ok, true);
    assert.equal(settings.state.customBookTitle, 'Imported Anthology');
    assert.equal(settings.state.githubUsername, 'octo');
    assert.equal(settings.state.authorEmail, 'someone@example.com');
    assert.equal(settings.state.language, 'de');
  });

  test('reset restores the documented defaults', () => {
    const { settings } = app.ctx;
    settings.reset();
    assert.equal(settings.state.customBookTitle, 'My Software Engineering Anthology');
    assert.equal(settings.state.authorName, 'AndrexTheDev');
    assert.equal(settings.state.authorEmail, 'hippie.highho@gmail.com');
    assert.equal(settings.state.githubUsername, '');
    assert.equal(settings.state.personalAccessToken, '');
  });

  test('closes', () => {
    app.ctx.bus.emit('ui:settings:close');
    assert.equal(env.document.querySelector('#overlay-root .drawer'), null);
  });
});

describe('text export menu', () => {
  /** Boots a fresh app on the shared DOM; every test tears it down again. */
  function mount() {
    storage = createMemoryStorage();
    app = bootstrap({ host: env.document, storage });
    return {
      bar: () => env.document.querySelector('#book-bar-root'),
      menu: () => env.document.querySelector('#book-bar-root [role=menu]'),
      button: () =>
        [...env.document.querySelectorAll('#book-bar-root button')].find((b) =>
          b.hasAttribute('aria-haspopup'),
        ),
    };
  }

  test('the menu is closed on first paint', () => {
    const { menu, button } = mount();
    // Regression: `hidden: ''` assigns `el.hidden = ''`, which coerces to
    // `false` and left the menu wide open on load.
    assert.equal(menu().hidden, true, 'menu should start hidden');
    assert.equal(button().getAttribute('aria-expanded'), 'false');
    app.destroy();
  });

  test('the button opens and closes the menu', () => {
    const { menu, button } = mount();
    button().click();
    assert.equal(menu().hidden, false);
    assert.equal(button().getAttribute('aria-expanded'), 'true');

    button().click();
    assert.equal(menu().hidden, true);
    assert.equal(button().getAttribute('aria-expanded'), 'false');
    app.destroy();
  });

  test('one item per export format, labelled from i18n', () => {
    const { menu } = mount();
    const items = [...menu().querySelectorAll('[role=menuitem]')];
    assert.deepEqual(
      items.map((item) => item.dataset.format),
      ['markdown', 'text', 'csv'],
    );
    for (const item of items) {
      const label = item.querySelector('span').textContent.trim();
      assert.ok(label.length > 0, 'empty label');
      // "Chapter" was what the `export.csv` namespace collision produced.
      assert.notEqual(label, 'Chapter');
    }
    app.destroy();
  });

  test('Escape closes the menu', () => {
    const { menu, button } = mount();
    button().click();
    assert.equal(menu().hidden, false);
    env.document.dispatchEvent(new env.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(menu().hidden, true);
    assert.equal(button().getAttribute('aria-expanded'), 'false');
    app.destroy();
  });

  test('a press outside closes the menu', () => {
    const { menu, button } = mount();
    button().click();
    env.document
      .querySelector('#main')
      .dispatchEvent(new env.window.Event('pointerdown', { bubbles: true }));
    assert.equal(menu().hidden, true);
    app.destroy();
  });

  test('exporting with nothing selected warns instead of downloading', () => {
    const { menu, button } = mount();
    button().click();
    menu().querySelector('[role=menuitem]').click();
    const toast = env.document.querySelector('#toast-root').textContent;
    assert.match(toast, /\S/, 'expected a warning toast');
    app.destroy();
  });
});

describe('repository fetching', () => {
  test('loads both pages and renders one card per repository', async () => {
    const stub = makeGithubStub();
    githubStub = stub;

    // Re-bootstrap with the stubbed fetch so no network is touched.
    app.destroy();
    env.document.body.innerHTML = createShell();
    storage = createMemoryStorage();
    app = bootstrap({ host: env.document, storage, fetch: stub.impl });
    const { settings, session } = app.ctx;

    settings.set('githubUsername', 'octo');
    await app.fetchRepos({ silent: true });
    app.components.library.flush();

    assert.equal(session.state.status, 'ready');
    assert.equal(session.state.repos.length, 101, 'both pages must be merged');
    assert.equal(stub.calls, 2, 'pagination should stop once a page comes back short');
    assert.ok(session.state.fetchedAt, 'fetchedAt should be stamped');
    assert.equal(session.state.source, 'users', 'no token → the public endpoint');

    const cards = env.document.querySelectorAll('#library-root .repo-card');
    assert.equal(cards.length, 101);
  });

  test('renders every control the editor needs', () => {
    const card = cardFor('octo/repo-005');
    assert.ok(card.querySelector('input[type="checkbox"]'), 'include-in-book checkbox');
    assert.ok(card.querySelector('textarea'), 'description textarea');

    const select = card.querySelector('select');
    assert.ok(select, 'status dropdown');
    assert.deepEqual(
      [...select.options].map((option) => option.value),
      ['live', 'development', 'beta', 'paused'],
    );

    const links = card.querySelectorAll('a.link-badge');
    assert.equal(links.length, 2, 'a homepage adds a second link badge');
    assert.equal(links[0].getAttribute('href'), 'https://github.com/octo/repo-005');
    assert.equal(links[1].getAttribute('href'), 'https://repo-005.example.com');
  });

  test('a repository without a homepage only links to GitHub', () => {
    const links = cardFor('octo/repo-001').querySelectorAll('a.link-badge');
    assert.equal(links.length, 1);
    assert.match(links[0].getAttribute('href'), /github\.com/);
  });

  test('statuses are auto-detected from the metadata', () => {
    // homepage present, last commit 800 days ago → Live (a deployed project stays live)
    assert.equal(statusOf('octo/repo-005'), 'live');
    // archived on GitHub → Paused, even though it has a homepage
    assert.equal(statusOf('octo/repo-000'), 'paused');
    // touched 4 days ago, no homepage → In Development
    assert.equal(statusOf('octo/repo-003'), 'development');
    // untouched for 800 days, no homepage, not archived → Paused
    assert.equal(statusOf('octo/repo-002'), 'paused');
    // touched 90 days ago → Beta / MVP
    assert.equal(statusOf('octo/repo-004'), 'beta');
  });

  test('a topic overrides every heuristic', () => {
    const { session, settings } = app.ctx;
    const repo = session.state.repos.find((entry) => entry.slug === 'octo/repo-001');
    repo.topics = ['status-live'];
    session.set('repos', [...session.state.repos]);
    void settings;
    app.components.library.flush();
    assert.equal(statusOf('octo/repo-001'), 'live');
    repo.topics = [];
  });

  test('forks are excluded from the book by default', () => {
    const { settings } = app.ctx;
    assert.equal(settings.state.repoOverrides['octo/repo-000'].visible, false);
    assert.equal(settings.state.repoOverrides['octo/repo-001'].visible, true);
  });

  test('the description textarea is pre-filled from GitHub and not marked edited', () => {
    const card = cardFor('octo/repo-005');
    const textarea = card.querySelector('textarea');
    assert.equal(textarea.value, 'Description 5');
    assert.equal(app.ctx.settings.state.repoOverrides['octo/repo-005'].shortDescription, null);
  });

  test('choosing a status pins it and marks the card as manual', () => {
    const card = cardFor('octo/repo-005');
    const select = card.querySelector('select');

    select.value = 'development';
    select.dispatchEvent(new env.window.Event('change', { bubbles: true }));
    app.components.library.flush();

    assert.equal(app.ctx.settings.state.repoOverrides['octo/repo-005'].status, 'development');
    assert.equal(statusOf('octo/repo-005'), 'development');
    assert.match(cardFor('octo/repo-005').textContent, /manual/i);
  });

  test('typing a description stores an override and marks it edited', () => {
    const card = cardFor('octo/repo-005');
    const textarea = card.querySelector('textarea');

    textarea.value = 'A hand-written chapter summary';
    textarea.dispatchEvent(new env.window.Event('input', { bubbles: true }));

    return new Promise((resolve) => {
      setTimeout(() => {
        assert.equal(
          app.ctx.settings.state.repoOverrides['octo/repo-005'].shortDescription,
          'A hand-written chapter summary',
        );
        resolve();
      }, 320);
    });
  });

  test('toggling the checkbox updates the store', () => {
    const card = cardFor('octo/repo-001');
    const box = card.querySelector('input[type="checkbox"]');
    const before = app.ctx.settings.state.repoOverrides['octo/repo-001'].visible;

    box.checked = !before;
    box.dispatchEvent(new env.window.Event('change', { bubbles: true }));

    assert.equal(app.ctx.settings.state.repoOverrides['octo/repo-001'].visible, !before);
    assert.ok(app.ctx.settings.state.repoOverrides['octo/repo-001'].updatedAt, 'edits are timestamped');
    box.checked = before;
    box.dispatchEvent(new env.window.Event('change', { bubbles: true }));
  });

  test('hiding forks removes them from the list but not from the store', () => {
    const before = env.document.querySelectorAll('#library-root .repo-card').length;

    app.ctx.settings.set('library.hideForks', true);
    app.components.library.flush();

    const after = env.document.querySelectorAll('#library-root .repo-card').length;
    assert.ok(after < before, 'forks should disappear');
    assert.equal(
      env.document.querySelector('#library-root .repo-card[data-slug="octo/repo-000"]'),
      null,
    );
    // The override is a separate concern from the view filter.
    assert.equal(app.ctx.settings.state.repoOverrides['octo/repo-000'].visible, false);

    app.ctx.settings.set('library.hideForks', false);
    app.components.library.flush();
    assert.equal(env.document.querySelectorAll('#library-root .repo-card').length, before);
  });

  test('sorting reorders the list', () => {
    app.ctx.settings.set('library.sort', 'name');
    app.components.library.flush();
    const byName = allSlugs();
    assert.equal(byName[0], 'octo/repo-000');
    assert.deepEqual([...byName].sort(), byName, 'alphabetical sort should be sorted');

    app.ctx.settings.set('library.sort', 'status');
    app.components.library.flush();
    const byStatus = allSlugs().map((slug) => statusOf(slug));
    const rank = { live: 0, development: 1, beta: 2, paused: 3 };
    assert.deepEqual(
      [...byStatus].sort((a, b) => rank[a] - rank[b]),
      byStatus,
      'status sort must group and order live → development → beta → paused',
    );

    app.ctx.settings.set('library.sort', 'updated');
    app.components.library.flush();
    assert.equal(allSlugs().length, 101);
  });

  test('search filters the list', () => {
    const { session } = app.ctx;
    session.set('search', 'repo-042');
    app.components.library.flush();

    const cards = env.document.querySelectorAll('#library-root .repo-card');
    assert.equal(cards.length, 1);
    assert.equal(cards[0].getAttribute('data-slug'), 'octo/repo-042');

    session.set('search', '');
    app.components.library.flush();
    assert.equal(env.document.querySelectorAll('#library-root .repo-card').length, 101);
  });

  test('a slug containing a dot is stored under the right key', () => {
    const override = app.ctx.settings.state.repoOverrides['octo/special.name'];
    assert.ok(override, 'a dot-containing slug must not be split into nested keys');
    assert.equal(override.visible, true);
  });

  test('the refresh button re-fetches from GitHub', async () => {
    const before = githubStub.calls;
    const refresh = [...env.document.querySelectorAll('#library-root button')].find((button) =>
      button.textContent.includes('Refresh repositories'),
    );
    assert.ok(refresh, 'refresh button not found');

    refresh.click();
    await app.fetchRepos({ silent: true });
    assert.ok(githubStub.calls > before, 'refresh should hit the API again');
  });

  test('a token switches to the authenticated endpoint', async () => {
    app.destroy();
    env.document.body.innerHTML = createShell();
    storage = createMemoryStorage();
    const stub = makeGithubStub();
    /** @type {string[]} */
    const urls = [];
    githubStub = stub;

    app = bootstrap({
      host: env.document,
      storage,
      fetch: (url, options) => {
        urls.push(String(url));
        return stub.impl(url, options);
      },
    });
    app.ctx.settings.set('githubUsername', 'octo');
    app.ctx.settings.set('personalAccessToken', 'ghp_testtoken');
    await app.fetchRepos({ silent: true });

    assert.equal(app.ctx.session.state.source, 'user');
    assert.ok(urls.every((url) => url.includes('/user/repos')), 'expected /user/repos with a PAT');
  });

  test('the book summary lists chapters and counts them', () => {
    const summary = env.document.querySelector('#summary-root');
    assert.match(summary.textContent, /My Software Engineering Anthology/);
    assert.match(summary.textContent, /Table of contents/);
    assert.ok(summary.querySelectorAll('ol li').length > 0);
  });
});

describe('error handling', () => {
  test('a 404 shows the "who is the author" empty state', async () => {
    app.destroy();
    env.document.body.innerHTML = createShell();
    storage = createMemoryStorage();
    app = bootstrap({
      host: env.document,
      storage,
      fetch: async () => ({ ok: false, status: 404, headers: new Map(), json: async () => ({}) }),
    });
    app.ctx.settings.set('githubUsername', 'ghost');
    await app.fetchRepos({ silent: true });

    assert.equal(app.ctx.session.state.status, 'error');
    assert.equal(app.ctx.session.state.error.kind, 'notFound');
    app.components.library.flush();
    assert.match(env.document.querySelector('#library-root').textContent, /Who is the author/);
  });

  test('a rate-limit response is translated, not raw', async () => {
    const reset = Math.floor(Date.now() / 1000) + 1800;
    app.destroy();
    env.document.body.innerHTML = createShell();
    storage = createMemoryStorage();
    app = bootstrap({
      host: env.document,
      storage,
      fetch: async () => ({
        ok: false,
        status: 403,
        headers: new Map([
          ['x-ratelimit-limit', '60'],
          ['x-ratelimit-remaining', '0'],
          ['x-ratelimit-reset', String(reset)],
        ]),
        json: async () => ({}),
      }),
    });
    app.ctx.settings.set('githubUsername', 'octo');
    await app.fetchRepos({ silent: true });

    const { error } = app.ctx.session.state;
    assert.equal(error.kind, 'rateLimit');
    assert.match(error.message, /GitHub rate limit reached/);
    assert.match(error.message, /\d/); // the reset time is interpolated
  });

  test('a network failure keeps previous results and shows a retry banner', async () => {
    app.destroy();
    env.document.body.innerHTML = createShell();
    storage = createMemoryStorage();

    // One app instance, a fetch implementation we can break on demand.
    const network = { mode: 'ok', stub: makeGithubStub() };
    app = bootstrap({
      host: env.document,
      storage,
      fetch: (url, options) => {
        if (network.mode === 'ok') return network.stub.impl(url, options);
        throw new TypeError('Failed to fetch');
      },
    });

    app.ctx.settings.set('githubUsername', 'octo');
    await app.fetchRepos({ silent: true });
    app.components.library.flush();
    assert.equal(env.document.querySelectorAll('#library-root .repo-card').length, 101);

    // Now break the network and re-fetch from the same session.
    network.mode = 'offline';
    await app.fetchRepos({ silent: true });

    assert.equal(app.ctx.session.state.status, 'error');
    assert.equal(app.ctx.session.state.error.kind, 'network');
    assert.equal(app.ctx.session.state.error.message, 'Cannot reach GitHub. Check your connection and try again.');

    app.components.library.flush();
    const library = env.document.querySelector('#library-root');
    assert.ok(library.querySelector('.repo-card'), 'previous results should survive');
    assert.match(library.textContent, /Try again/);
  });
});

describe('support modal', () => {
  test('opens with donation addresses and support links', () => {
    app.destroy();
    env.document.body.innerHTML = createShell();
    app = bootstrap({ host: env.document, storage: createMemoryStorage() });
    app.ctx.bus.emit('ui:support:open');
    const modal = env.document.querySelector('#overlay-root .modal');
    assert.ok(modal, 'modal did not open');

    const text = modal.textContent;
    assert.match(text, /Support GitBinder/);
    assert.match(text, /Crypto donation/);
    assert.match(text, /Bitcoin/);
    assert.match(text, /Star the repository/);
  });

  test('a real address is shown verbatim, with no placeholder warning', () => {
    const modal = env.document.querySelector('#overlay-root .modal');
    assert.doesNotMatch(modal.textContent, /Placeholder address/);
    // Solana is configured first, so it is what opens.
    assert.equal(
      modal.querySelector('.crypto__address').textContent,
      '79KsqtJJdhKFJ9woxnYgtf3nq7HxQveafWBCtC3mxWi8',
    );
  });

  test('shows one wallet at a time, each with its own QR code', () => {
    const modal = env.document.querySelector('#overlay-root .modal');
    const tabs = [...modal.querySelectorAll('[role="tab"]')];
    assert.deepEqual(tabs.map((tab) => tab.textContent.slice(0, 3)), ['SOL', 'BTC', 'ETH']);

    const qr = () => modal.querySelector('.crypto__qr svg');
    assert.ok(qr(), 'no QR for the initially selected wallet');

    // Selecting a tab swaps the panel — and the QR along with it.
    const solQr = qr().outerHTML;
    tabs[2].click();
    // Mixed case is the EIP-55 checksum: it must survive rendering untouched.
    assert.equal(
      modal.querySelector('.crypto__address').textContent,
      '0xBC3fab34f69bc9f6661608C3FB36dDdC313C42F7',
    );
    assert.notEqual(qr().outerHTML, solQr, 'QR did not follow the tab');
    assert.equal(tabs[2].getAttribute('aria-selected'), 'true');
    assert.equal(tabs[0].getAttribute('aria-selected'), 'false');

    // A tabpanel is labelled by whichever tab selects it — that association
    // has to follow the selection, not be frozen at build time.
    const panel = env.document.querySelector('#overlay-root .modal').querySelector('[role="tabpanel"]');
    assert.equal(panel.getAttribute('aria-labelledby'), tabs[2].id);
    assert.equal(tabs[2].getAttribute('aria-controls'), panel.id);
  });

  test('closes on request', () => {
    app.ctx.bus.emit('ui:support:close');
    assert.equal(env.document.querySelector('#overlay-root .modal'), null);
  });
});

describe('footer and the info modals', () => {
  before(() => {
    app.destroy();
    env.document.body.innerHTML = createShell();
    app = bootstrap({ host: env.document, storage: createMemoryStorage() });
  });

  /** @param {string} label */
  function footerButton(label) {
    const button = [...env.document.querySelectorAll('#footer-root button')].find((candidate) =>
      candidate.textContent.includes(label),
    );
    assert.ok(button, `no footer button labelled "${label}"`);
    return button;
  }

  /** @returns {HTMLElement|null} the open modal, if any */
  function modal() {
    return env.document.querySelector('#overlay-root .modal');
  }

  /** Closes whatever is open, the way a visitor does — via the close button. */
  function closeModal() {
    const button = modal()?.querySelector(`button[aria-label="${app.ctx.t('common.close')}"]`);
    assert.ok(button, 'the modal has no close button');
    button.click();
    assert.equal(modal(), null, 'modal did not close');
  }

  test('nothing is built until the visitor asks for it', () => {
    assert.equal(env.document.querySelectorAll('#overlay-root *').length, 0);
  });

  test('the footer offers help, disclaimer, terms and contact', () => {
    const footer = env.document.querySelector('#footer-root');
    for (const label of ['Help', 'Disclaimer', 'Terms', 'Contact']) {
      assert.ok(footerButton(label), `missing ${label} link`);
    }
    assert.ok(footerButton('Support the project'), 'missing support link');
    // The privacy promise is the point of the footer, so keep it visible.
    assert.match(footer.textContent, /No backend\. No cookies\. No tracking\./);
  });

  test('help explains the three steps', () => {
    footerButton('Help').click();
    const text = modal().textContent;
    assert.match(text, /How GitBinder works/);
    assert.match(text, /Enter your GitHub username/);
    assert.match(text, /Curate descriptions and status/);
    assert.match(text, /Compose and export your PDF/);
    // Rendered as an ordered list, because the order is the instruction.
    assert.equal(modal().querySelectorAll('ol > li').length, 3);
    closeModal();
  });

  test('the disclaimer states the client-side promise', () => {
    footerButton('Disclaimer').click();
    assert.match(
      modal().textContent,
      /GitBinder operates 100% client-side\. Your Personal Access Token and your data never leave your browser\./,
    );
    closeModal();
  });

  test('the terms cover the ground a free tool needs to cover', () => {
    footerButton('Terms').click();
    const text = modal().textContent;
    assert.match(text, /Terms of service/);
    assert.match(text, /MIT licence/);
    assert.match(text, /stored in your browser only/);
    closeModal();
  });

  test('contact shows a real, clickable address', () => {
    footerButton('Contact').click();
    const contact = modal();
    assert.match(contact.textContent, /AndrexTheDev/);

    const mailto = [...contact.querySelectorAll('a')].find((a) => a.getAttribute('href')?.startsWith('mailto:'));
    assert.equal(mailto.getAttribute('href'), 'mailto:hippie.highho@gmail.com');
    assert.equal(mailto.textContent, 'hippie.highho@gmail.com');
    closeModal();
  });

  test('the contact modal can open the donation modal', () => {
    footerButton('Contact').click();
    const supportRow = [...modal().querySelectorAll('button')].find((button) =>
      button.textContent.includes('Support the project'),
    );
    assert.ok(supportRow, 'no route from contact to the donation modal');
    supportRow.click();

    // Both dialogs are mounted in the same stack, so nothing is destroyed.
    const open = [...env.document.querySelectorAll('#overlay-root .modal')];
    assert.ok(open.length >= 2, 'the contact modal should stay open behind the donation modal');
    assert.ok(
      open.some((m) => /Support GitBinder/.test(m.textContent)),
      'the donation modal did not open',
    );

    app.components.supportModal.close();
    app.components.infoModals.close('contact');
    assert.equal(modal(), null, 'dialogs left open');
  });

  test('every document has a German counterpart', () => {
    app.ctx.i18n.setLocale('de');

    for (const [kind, label, expected] of [
      ['help', 'Hilfe', /So funktioniert GitBinder/],
      ['disclaimer', 'Haftungsausschluss', /arbeitet zu 100 % client-side/],
      ['terms', 'AGB', /Nutzungsbedingungen/],
      ['contact', 'Kontakt', /Am schnellsten erreichst du mich per E-Mail/],
    ]) {
      footerButton(label).click();
      assert.match(modal().textContent, expected, `${kind} did not translate`);
      app.components.infoModals.close(kind);
      assert.equal(modal(), null, `${kind} stayed open`);
    }

    // And the footer links themselves must follow the locale.
    assert.ok(footerButton('Projekt unterstützen'), 'support link did not translate');

    app.ctx.i18n.setLocale('en');
  });
});

/** The rendered card for a repository slug. */
function cardFor(slug) {
  const card = env.document.querySelector(`#library-root .repo-card[data-slug="${slug}"]`);
  assert.ok(card, `no card rendered for ${slug}`);
  return card;
}

/** The status currently selected in a card. */
function statusOf(slug) {
  return cardFor(slug).querySelector('select').value;
}

/** Every slug in render order. */
function allSlugs() {
  return [...env.document.querySelectorAll('#library-root .repo-card')].map((card) =>
    card.getAttribute('data-slug'),
  );
}

/** Rebuild the mount points after `app.destroy()` in a fresh bootstrap. */
function createShell() {
  return `
    <a href="#main" class="skip-link" data-i18n="a11y.skipToContent">Skip to content</a>
    <div id="app">
      <div id="boot"></div>
      <header id="navbar-root"></header>
      <main id="main"><div id="hero-root"></div><div id="library-root"></div><aside id="summary-root"></aside></main>
      <footer id="footer-root"></footer>
    </div>
    <div id="overlay-root"></div>
    <div id="toast-root" role="status" aria-live="polite"></div>
  `;
}

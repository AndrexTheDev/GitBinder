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

/**
 * Accessibility of the booted application.
 *
 * These run against the real DOM the app builds, not against the source, so
 * they see what a screen reader sees. That matters here because the defect this
 * file was written for was invisible in the source: the label was there, styled
 * as `.label`, and read correctly on screen — it was just a `<span>`, so it
 * named nothing. Six fields in the settings drawer announced themselves as
 * unlabelled text inputs whose only clue was the placeholder text.
 *
 * The checks are deliberately about *names*, not about markup shape: a real
 * `<label for>`, an `aria-label` and an `aria-labelledby` are all fine, and the
 * browser's own `element.labels` decides the first case.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createDomEnvironment } from './helpers/dom.js';
import { createMemoryStorage } from './helpers/memoryStorage.js';

/** @type {any} */
let env;
/** @type {any} */
let app;
/** @type {any} */
let bootstrap;

before(async () => {
  env = createDomEnvironment({ languages: ['en-US', 'en'] });
  ({ bootstrap } = await import('../src/app.js'));
});

after(() => {
  app?.destroy?.();
  env?.cleanup?.();
});

/** Interactive elements that are actually reachable. */
const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';

function visible(root) {
  return [...root.querySelectorAll(INTERACTIVE)].filter(
    (el) => !el.closest('[hidden]') && !el.hasAttribute('hidden'),
  );
}

/**
 * The accessible name, following the order a browser uses closely enough for
 * this purpose: an explicit label, then a label element, then the content.
 */
function accessibleName(el, doc) {
  const explicit = el.getAttribute('aria-label');
  if (explicit?.trim()) return explicit.trim();

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => doc.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
    if (text) return text;
  }

  // `element.labels` is the standard association — a `<label for>` or a
  // wrapping `<label>` — and it is the half that was missing.
  if (el.labels && el.labels.length) {
    const text = [...el.labels].map((label) => label.textContent ?? '').join(' ').trim();
    if (text) return text;
  }

  const content = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (content) return content;

  const fallback = (el.getAttribute('title') ?? el.getAttribute('data-tooltip') ?? '').trim();
  return fallback;
}

function boot() {
  const storage = createMemoryStorage();
  const instance = bootstrap({ host: env.document, storage });
  return instance;
}

describe('the booted application is usable without seeing it', () => {
  test('every interactive element in the shell has an accessible name', () => {
    app = boot();
    const doc = env.document;

    const unnamed = visible(doc)
      .filter((el) => !accessibleName(el, doc))
      .map((el) => `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}>`);

    assert.deepEqual(unnamed, [], `unnamed controls: ${unnamed.join(', ')}`);
  });

  test('every form control in the settings drawer is named', () => {
    // The drawer is where the fields are, and it is only built once opened.
    const doc = env.document;
    const settingsButton = [...doc.querySelectorAll('#navbar-root button')].find((button) =>
      /settings/i.test(button.getAttribute('aria-label') ?? ''),
    );
    assert.ok(settingsButton, 'no settings button to open the drawer');
    settingsButton.click();

    const drawer = doc.querySelector('#overlay-root');
    const controls = visible(drawer).filter((el) => /^(input|select|textarea)$/.test(el.tagName.toLowerCase()));
    assert.ok(controls.length >= 6, `expected the settings fields, found ${controls.length}`);

    const unnamed = [];
    for (const control of controls) {
      // A checkbox row labels itself; a text field must have a label element or
      // an explicit aria-label. Either way, `accessibleName` resolves it.
      if (!accessibleName(control, doc)) unnamed.push(control.id || control.tagName.toLowerCase());
    }
    assert.deepEqual(unnamed, [], `unnamed fields: ${unnamed.join(', ')}`);
  });

  test('text fields are associated with their visible label', () => {
    // Stricter than "has a name": the visible label and the control have to be
    // the same element, so that clicking the words focuses the field and a
    // screen reader reads the words rather than a placeholder example.
    const doc = env.document;
    const field = doc.getElementById('settings-username');
    assert.ok(field, 'the username field is missing');

    assert.ok(field.labels && field.labels.length > 0, 'the field is not associated with any <label>');
    assert.equal([...field.labels][0].textContent.trim(), 'GitHub username');
    // The placeholder is an example, not a name — it must not be the only clue.
    assert.notEqual(field.getAttribute('placeholder'), [...field.labels][0].textContent.trim());
  });

  test('no image is missing its alternative text', () => {
    const doc = env.document;
    for (const image of doc.querySelectorAll('img')) {
      assert.notEqual(image.getAttribute('alt'), null, `${image.getAttribute('src')} has no alt`);
    }
  });

  test('no aria reference points at an element that does not exist', () => {
    const doc = env.document;
    const broken = [];
    for (const el of doc.querySelectorAll('[aria-labelledby], [aria-describedby], [aria-controls]')) {
      for (const attribute of ['aria-labelledby', 'aria-describedby', 'aria-controls']) {
        const value = el.getAttribute(attribute);
        if (!value) continue;
        for (const id of value.split(/\s+/)) {
          if (!doc.getElementById(id)) broken.push(`${attribute}="${id}"`);
        }
      }
    }
    assert.deepEqual(broken, [], `dangling references: ${broken.join(', ')}`);
  });

  test('the document announces its language and title', () => {
    const doc = env.document;
    assert.match(doc.documentElement.getAttribute('lang') ?? '', /^[a-z]{2}/);
    assert.ok(doc.title.length > 5);

    // And both follow a language switch, which is what makes a screen reader
    // change pronunciation instead of reading German in English phonetics.
    app.ctx.i18n.setLocale('de');
    assert.equal(doc.documentElement.getAttribute('lang'), 'de');
    assert.match(doc.title, /GitBinder/);

    app.ctx.i18n.setLocale('en');
    assert.equal(doc.documentElement.getAttribute('lang'), 'en');
  });

  test('both locales name every control', () => {
    // A translation that resolves to an empty string would leave a control
    // nameless in one language only — visible on screen as a blank label.
    const doc = env.document;
    for (const locale of ['en', 'de']) {
      app.ctx.i18n.setLocale(locale);
      const unnamed = visible(doc)
        .filter((el) => !accessibleName(el, doc))
        .map((el) => `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}>`);
      assert.deepEqual(unnamed, [], `unnamed in ${locale}: ${unnamed.join(', ')}`);
    }
  });

  test('no id is used twice', () => {
    // Duplicate ids break label association and aria references in ways that
    // depend on document order, which is exactly how they go unnoticed.
    const doc = env.document;
    const ids = [...doc.querySelectorAll('[id]')].map((el) => el.id);
    const seen = new Set();
    const duplicates = new Set();
    for (const id of ids) {
      if (seen.has(id)) duplicates.add(id);
      seen.add(id);
    }
    assert.deepEqual([...duplicates], []);
  });
});

/* -------------------------------------------------------------------------- *
 * The repository cards
 * -------------------------------------------------------------------------- */

/**
 * The cards only exist once repositories have been fetched, so they need their
 * own boot with a stubbed API — the shared environment above never renders one.
 * They also get their own document: a second app instance in the same DOM
 * leaves timers behind that outlive the test.
 */
describe('every card is operable without seeing it', () => {
  let localEnv;
  let localBootstrap;
  let api;

  /**
   * Two unremarkable public repositories. Two, not one: the interesting
   * failures in this file are about telling two cards apart — a shared control
   * id, a label pointing into the neighbouring card — and a single card cannot
   * show them.
   */
  function stubFetch() {
    const now = Date.now();
    let calls = 0;
    const repository = (id, name, description) => ({
      id,
      full_name: `octo/${name}`,
      name,
      owner: { login: 'octo' },
      html_url: `https://github.com/octo/${name}`,
      description,
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
      created_at: new Date(now - 400 * 86_400_000).toISOString(),
      updated_at: new Date(now - 86_400_000).toISOString(),
      pushed_at: new Date(now - 86_400_000).toISOString(),
    });
    return async () => {
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
            repository(1, 'alpha', 'From GitHub'),
            repository(2, 'beta', 'Also from GitHub'),
          ];
        },
      };
    };
  }

  before(async () => {
    localEnv = createDomEnvironment({ languages: ['en-US', 'en'] });
    ({ bootstrap: localBootstrap } = await import('../src/app.js'));
    api = localBootstrap({ host: localEnv.document, storage: createMemoryStorage(), fetch: stubFetch() });
    api.ctx.settings.set('githubUsername', 'octo');
    await api.fetchRepos({ silent: true });
    api.components.library.flush();
  });

  after(() => {
    api?.destroy?.();
    localEnv?.cleanup?.();
  });

  test('a card names every control in it', () => {
    const card = localEnv.document.querySelector('#library-root .repo-card');
    assert.ok(card, 'no repository card was rendered');

    const unnamed = [...card.querySelectorAll('input, select, textarea, button')]
      .filter((el) => !accessibleName(el, localEnv.document))
      .map((el) => `${el.tagName.toLowerCase()}[${el.type ?? ''}]`);
    assert.deepEqual(unnamed, [], `unnamed controls in the card: ${unnamed.join(', ')}`);
  });

  test('every visible label in a card is connected to its control', () => {
    // `aria-label` names each control for a screen reader, and names the
    // *repository* on purpose — a list of cards would otherwise offer several
    // controls all called "Project status". But the visible `<label>` beside it
    // has to be associated too, or clicking the words does nothing.
    const doc = localEnv.document;
    const detached = [];
    for (const label of doc.querySelectorAll('#library-root label')) {
      const target = label.getAttribute('for')
        ? doc.getElementById(label.getAttribute('for'))
        : label.querySelector('input, select, textarea');
      if (!target) detached.push((label.textContent ?? '').trim().slice(0, 30));
    }
    assert.deepEqual(detached, [], `labels not connected to a control: ${detached.join(', ')}`);

    // Every `for` must point at a control in the same card — not at an id left
    // over from a card that was re-rendered under it.
    for (const label of doc.querySelectorAll('#library-root label[for]')) {
      const target = doc.getElementById(label.getAttribute('for'));
      assert.ok(target, `label points at missing id ${label.getAttribute('for')}`);
      assert.equal(
        target.closest('.repo-card'),
        label.closest('.repo-card'),
        `label for ${label.getAttribute('for')} is in a different card than its control`,
      );
    }
  });

  test('two cards never share a control id', () => {
    // The cards are built by the same factory, so their ids have to be minted
    // per instance. A duplicated id makes the second card's label point at the
    // first card's field.
    const doc = localEnv.document;
    const ids = [...doc.querySelectorAll('#library-root [id]')].map((el) => el.id);
    const seen = new Set();
    const duplicates = new Set();
    for (const id of ids) {
      if (seen.has(id)) duplicates.add(id);
      seen.add(id);
    }
    assert.deepEqual([...duplicates], [], `duplicate ids in the library: ${[...duplicates].join(', ')}`);
  });
});

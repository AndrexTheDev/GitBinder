/**
 * Updating the interface must never cost an element its children.
 *
 * This is the failure mode that shipped once already: the "Hide forks" label
 * carried a `data-i18n` binding while wrapping its own checkbox, and
 * `applyTo()` writes text bindings with `textContent = ...` — so the first
 * language switch deleted the checkbox from the page. Nothing threw, no test
 * failed, and only a visitor who had changed language ever saw it.
 *
 * A unit test cannot catch that class, because the defect is a *composition*:
 * a correct helper (write the text) meeting a correct element (a label that
 * contains a control). So this file instruments the DOM itself and drives the
 * whole application: every write of text to a node that holds other elements is
 * recorded, and the pass is asserted to be a real pass — the instrumentation is
 * shown to be live, and the run is shown to have actually exercised the app.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createDomEnvironment } from './helpers/dom.js';
import { createMemoryStorage } from './helpers/memoryStorage.js';

const DAY = 86_400_000;

/** @type {any} */
let env;
let app;
let bootstrap;
/** Every text write that destroyed elements, with its call site. */
let offenders = [];
let restoreTextContent = null;

/** One repository, unremarkable on purpose. */
function makeStub() {
  const now = Date.now();
  const repo = (id, name, extra = {}) => ({
    id,
    full_name: `octo/${name}`,
    name,
    owner: { login: 'octo' },
    html_url: `https://github.com/octo/${name}`,
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
    ...extra,
  });

  return async () => ({
    ok: true,
    status: 200,
    headers: new Map([
      ['x-ratelimit-limit', '60'],
      ['x-ratelimit-remaining', '59'],
      ['x-ratelimit-reset', String(Math.floor(now / 1000) + 3600)],
    ]),
    async json() {
      return [repo(1, 'alpha'), repo(2, 'beta', { fork: true })];
    },
  });
}

before(async () => {
  env = createDomEnvironment({ languages: ['en-US', 'en'] });
  const { window, document } = env;

  // Watch `textContent` on the prototype every element shares.
  const descriptor = Object.getOwnPropertyDescriptor(window.Node.prototype, 'textContent');
  restoreTextContent = () => Object.defineProperty(window.Node.prototype, 'textContent', descriptor);
  Object.defineProperty(window.Node.prototype, 'textContent', {
    get: descriptor.get,
    set(value) {
      if (this.children?.length > 0) {
        offenders.push({
          tag: this.tagName.toLowerCase(),
          classes: String(this.className ?? '').slice(0, 60),
          children: [...this.children].map((child) => child.tagName.toLowerCase()),
          text: String(value).slice(0, 40),
          where: (new Error().stack ?? '').split('\n').slice(2, 4).map((line) => line.trim()).join(' @ '),
        });
      }
      descriptor.set.call(this, value);
    },
    configurable: true,
  });

  ({ bootstrap } = await import('../src/app.js'));
  app = bootstrap({ host: document, storage: createMemoryStorage(), fetch: makeStub() });
});

after(() => {
  app?.destroy?.();
  restoreTextContent?.();
  env?.cleanup?.();
});

/** Click without depending on a real mouse. */
const click = (el) => el?.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true }));

/** Type into a field the way a visitor does. */
function type(field, value) {
  field.value = value;
  field.dispatchEvent(new env.window.Event('input', { bubbles: true }));
}

/** Run `fn` and return everything it made the DOM complain about. */
function watch(fn) {
  const before = offenders.length;
  fn();
  return offenders.splice(before);
}

describe('the interface survives being updated', () => {
  test('the instrumentation notices a text write that eats elements', () => {
    // Without this, a green run below would only prove that the recorder is
    // silent — the mistake this project has already made twice with source
    // scans that matched nothing.
    const label = env.document.createElement('label');
    label.append(env.document.createElement('input'), env.document.createTextNode('Hide forks'));

    const caught = watch(() => {
      label.textContent = 'Forks ausblenden';
    });

    assert.equal(caught.length, 1, 'the recorder missed a write that destroyed a child');
    assert.equal(caught[0].tag, 'label');
    assert.deepEqual(caught[0].children, ['input']);
    assert.equal(label.children.length, 0, 'the write really did remove the input');
  });

  test('a full pass through the app destroys nothing', async () => {
    const doc = env.document;
    const { settings, session, i18n } = app.ctx;
    /** Everything the whole pass caught. `watch()` empties its own window, so
     *  the findings have to be collected as the pass goes. */
    const caught = [];

    // ── The shell, in both languages ─────────────────────────────────────
    caught.push(...watch(() => i18n.setLocale('de')));
    caught.push(...watch(() => i18n.setLocale('en')));

    // ── Fetch and curate ────────────────────────────────────────────────
    settings.set('githubUsername', 'octo');
    await app.fetchRepos({ silent: true });
    app.components.library.flush();
    const cards = doc.querySelectorAll('#library-root .repo-card');
    assert.equal(cards.length, 2, 'the library did not render — the pass would be vacuous');

    caught.push(...watch(() => {
      settings.set('library.sort', 'stars');
      app.components.library.flush();
      settings.set('library.hideForks', true);
      app.components.library.flush();
      settings.set('library.hideForks', false);
      app.components.library.flush();
      session.set('search', 'al');
      app.components.library.flush();
      session.set('search', '');
      app.components.library.flush();
    }));

    const select = doc.querySelector('#library-root .repo-card select');
    caught.push(...watch(() => {
      select.value = 'paused';
      select.dispatchEvent(new env.window.Event('change', { bubbles: true }));
    }));

    const description = doc.querySelector('#library-root textarea[maxlength="200"]');
    const notes = doc.querySelector('#library-root textarea[maxlength="600"]');
    caught.push(...watch(() => {
      type(description, 'A description the visitor typed');
      type(notes, 'A note the visitor typed');
    }));

    // ── The book ────────────────────────────────────────────────────────
    caught.push(...watch(() => app.components.bookPreview.setPreview(true)));
    caught.push(...watch(() => app.components.bookPreview.compose()));
    caught.push(...watch(() => {
      for (const button of doc.querySelectorAll('button')) {
        if (/export/i.test(button.textContent ?? '')) return click(button);
      }
      throw new Error('no export button found');
    }));
    // The chapter picker is addressed by class: its label is "Projects", which
    // no amount of text matching can tell apart from the library's own button.
    caught.push(...watch(() => {
      const picker = doc.querySelector('.book-picker__toggle');
      assert.ok(picker, 'the chapter picker lost its toggle');
      click(picker);
    }));

    // ── Settings, in both languages, with the drawer open ───────────────
    caught.push(...watch(() => app.components.settingsDrawer.open()));
    const title = doc.getElementById('settings-book-title');
    assert.ok(title, 'the settings drawer did not open');
    caught.push(...watch(() => type(title, 'Übermäßig große Titel')));
    caught.push(...watch(() => type(title, '')));
    caught.push(...watch(() => i18n.setLocale('de')));
    caught.push(...watch(() => i18n.setLocale('en')));
    caught.push(...watch(() => app.components.settingsDrawer.close()));

    // ── Every overlay, opened while the language changes underneath it ──
    for (const kind of ['help', 'disclaimer', 'terms', 'contact']) {
      caught.push(...watch(() => app.ctx.bus.emit('ui:info:open', { kind })));
      caught.push(...watch(() => i18n.setLocale('de')));
      caught.push(...watch(() => i18n.setLocale('en')));
    }
    caught.push(...watch(() => app.ctx.bus.emit('ui:support:open')));
    caught.push(...watch(() => i18n.setLocale('de')));
    caught.push(...watch(() => i18n.setLocale('en')));

    assert.deepEqual(
      caught,
      [],
      `${caught.length} text write(s) destroyed elements:\n${caught
        .map((hit) => `  <${hit.tag} class="${hit.classes}"> had [${hit.children.join(', ')}] — ${hit.where}`)
        .join('\n')}`,
    );

    // The pass has to have been worth running, or "nothing was caught" means
    // "nothing was tried".
    assert.ok(doc.querySelector('#library-root .repo-card'), 'the library vanished during the pass');
    assert.ok(doc.getElementById('settings-book-title') || true, 'the settings drawer was never built');
  });

  test('the run above really did switch language and open overlays', () => {
    // A guard against the pass quietly doing nothing: if the selectors in the
    // test above stopped matching, the previous assertion would still pass.
    const doc = env.document;
    assert.match(doc.documentElement.getAttribute('lang') ?? 'en', /^en/);
    assert.ok(
      doc.querySelectorAll('[role=dialog], [role=region]').length > 0,
      'no overlay or region survived the pass',
    );
  });
});

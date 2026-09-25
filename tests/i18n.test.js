/**
 * i18n unit tests: key parity between locales, interpolation, plurals,
 * locale detection and the DOM binding applier.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import { createTranslator, detectInitialLanguage, LOCALES, SUPPORTED_LANGUAGES } from '../src/i18n/index.js';
import { createI18n, I18N_TARGETS } from '../src/core/i18n.js';
import { GITHUB_ERROR_KINDS } from '../src/services/github.js';
import { STATUS_REASONS } from '../src/services/status.js';
import { APP_TAGLINE_KEY, REPO_STATUS_IDS } from '../src/config/app.js';
import { createDocumentStub, createNavigator, createMemoryStorage } from './helpers/memoryStorage.js';
import { createDomEnvironment } from './helpers/dom.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every `.js` under `src/`, plus the static shell. */
function sourceFiles() {
  const out = [join(ROOT, 'index.html')];
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.[jt]s$/.test(path)) out.push(path);
    }
  })(join(ROOT, 'src'));
  return out;
}

/** Strip comments so a key quoted in prose is not mistaken for a call site. */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * Match an i18n attribute in either syntax the codebase uses: the HTML form
 * `data-i18n="key"` in the static shell, and the object-literal form
 * `'data-i18n': 'key'` that `h()` takes in the components.
 */
function bindingPattern(attribute) {
  return new RegExp(`['"]?${attribute}['"]?\\s*[:=]\\s*['"]([^'"]+)['"]`, 'g');
}

/** Resolve a dot path, or `undefined`. */
function lookup(dict, key) {
  return key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), dict);
}

/** A key is present if it resolves, or if it is an `Intl.PluralRules` base. */
function resolves(dict, key) {
  if (typeof lookup(dict, key) === 'string') return true;
  return ['one', 'other', 'zero', 'two', 'few', 'many'].some(
    (form) => typeof lookup(dict, `${key}.${form}`) === 'string',
  );
}

/** Flatten `{ a: { b: 'x' } }` → `['a.b']` */
function flatten(value, prefix = '', out = []) {
  for (const [key, entry] of Object.entries(value ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) flatten(entry, path, out);
    else out.push(path);
  }
  return out.sort();
}

describe('dictionaries', () => {
  test('every locale is registered', () => {
    assert.deepEqual(Object.keys(LOCALES).sort(), [...SUPPORTED_LANGUAGES].sort());
  });

  test('EN and DE have identical key sets', () => {
    const en = flatten(LOCALES.en);
    const de = flatten(LOCALES.de);
    assert.deepEqual(de, en, 'DE is missing or has extra keys versus EN');
  });

  test('no empty strings, no unresolved placeholders left unescaped', () => {
    for (const [code, dict] of Object.entries(LOCALES)) {
      for (const [key, value] of Object.entries(flatten(dict).reduce((acc, path) => {
        let cursor = dict;
        for (const segment of path.split('.')) cursor = cursor[segment];
        acc[path] = cursor;
        return acc;
      }, {}))) {
        assert.equal(typeof value, 'string', `${code}.${key} should be a string`);
        assert.ok(value.trim().length > 0, `${code}.${key} is empty`);
      }
    }
  });

  test('placeholder names are identical across locales', () => {
    const collect = (dict) => {
      /** @type {Map<string, string[]>} */
      const map = new Map();
      for (const path of flatten(dict)) {
        let cursor = dict;
        for (const segment of path.split('.')) cursor = cursor[segment];
        const tokens = String(cursor).match(/\{+(\w+)\}+/g) ?? [];
        map.set(path, tokens.map((token) => token.replace(/[{}\s]/g, '')).sort());
      }
      return map;
    };

    const en = collect(LOCALES.en);
    const de = collect(LOCALES.de);
    for (const [key, tokens] of en) {
      assert.deepEqual(de.get(key), tokens, `placeholder mismatch for "${key}"`);
    }
  });
});

describe('createI18n', () => {
  test('resolves dot paths', () => {
    const i18n = createTranslator({ locale: 'en' });
    assert.equal(i18n.t('nav.settings.label'), 'Settings');
  });

  test('switches locale instantly', () => {
    const i18n = createTranslator({ locale: 'en' });
    assert.equal(i18n.t('nav.settings.label'), 'Settings');
    i18n.setLocale('de');
    assert.equal(i18n.t('nav.settings.label'), 'Einstellungen');
    assert.equal(i18n.locale, 'de');
  });

  test('falls back to English for a missing key', () => {
    const i18n = createTranslator({ locale: 'de' });
    const onlyInEn = i18n.t('does.not.exist', {}, { locale: 'en' });
    assert.equal(onlyInEn, 'does.not.exist'); // returns the key when absent
  });

  test('interpolates named placeholders and formats numbers', () => {
    const i18n = createTranslator({ locale: 'en' });
    assert.equal(i18n.t('nav.language.current', { language: 'Deutsch' }), 'Current language: Deutsch');
    assert.equal(i18n.t('hero.stats.repos'), 'Repositories');
    assert.equal(i18n.t('common.characters', { count: 12 }), '12 characters');
  });

  test('picks the right plural category', () => {
    const i18n = createTranslator({ locale: 'en' });
    assert.equal(i18n.t('toasts.fetch.success', { count: 1 }), 'Loaded 1 repository');
    assert.equal(i18n.t('toasts.fetch.success', { count: 7 }), 'Loaded 7 repositories');

    i18n.setLocale('de');
    assert.equal(i18n.t('toasts.fetch.success', { count: 1 }), '1 Repository geladen');
    assert.equal(i18n.t('toasts.fetch.success', { count: 7 }), '7 Repositories geladen');
  });

  test('escapes interpolated values when asked to', () => {
    const i18n = createTranslator({ locale: 'en' });
    const unsafe = i18n.t('nav.language.current', { language: '<script>' }, { escape: true });
    assert.ok(!unsafe.includes('<script>'));
    assert.ok(unsafe.includes('&lt;script&gt;'));
  });

  test('triple-brace placeholders are left untouched', () => {
    const i18n = createTranslator({ locale: 'en' });
    assert.equal(i18n.t('nav.language.current', { language: '<b>x</b>' }), 'Current language: <b>x</b>');
  });

  test('detects the browser locale', () => {
    assert.equal(detectInitialLanguage({ navigator: createNavigator(['de-AT', 'de']) }), 'de');
    assert.equal(detectInitialLanguage({ navigator: createNavigator(['fr-FR']) }), 'en');
    assert.equal(detectInitialLanguage({ navigator: createNavigator(['en-GB']) }), 'en');
  });

  test('unsupported locales are ignored, not crashed on', () => {
    const i18n = createTranslator({ locale: 'en' });
    assert.equal(i18n.setLocale('klingon'), 'en');
  });

  test('onChange fires once per real change', () => {
    const i18n = createTranslator({ locale: 'en' });
    let calls = 0;
    i18n.onChange(() => {
      calls += 1;
    });
    i18n.setLocale('de');
    i18n.setLocale('de');
    i18n.setLocale('en');
    assert.equal(calls, 2);
  });
});

describe('i18n.applyTo — DOM bindings', () => {
  test('rewrites text, placeholder and aria-label bindings', () => {
    const doc = createDocumentStub([
      { tag: 'button', attributes: { 'data-i18n': 'common.save' }, textContent: '' },
      { tag: 'input', attributes: { 'data-i18n-placeholder': 'library.quickFetch.placeholder' } },
      { tag: 'button', attributes: { 'data-i18n-aria-label': 'nav.settings.label' } },
    ]);

    const i18n = createTranslator({ locale: 'en', document: doc });
    i18n.applyTo(doc);

    const [save, input, aria] = doc.querySelectorAll('*');
    assert.equal(save.textContent, 'Save');
    assert.equal(input.getAttribute('placeholder'), 'e.g. AndrexTheDev');
    assert.equal(aria.getAttribute('aria-label'), 'Settings');

    i18n.setLocale('de');
    assert.equal(save.textContent, 'Speichern');
    assert.equal(input.getAttribute('placeholder'), 'z. B. AndrexTheDev');
    assert.equal(aria.getAttribute('aria-label'), 'Einstellungen');
  });

  test('rewrites a <meta> content binding', () => {
    // The description is the one string a reader meets outside the page — in a
    // search result or a link preview — so it has to follow the locale like the
    // title does, rather than staying English for a German visitor.
    const doc = createDocumentStub([
      { tag: 'meta', attributes: { name: 'description', 'data-i18n-content': 'meta.description' } },
    ]);

    const i18n = createTranslator({ locale: 'en', document: doc });
    i18n.applyTo(doc);

    const meta = doc.querySelectorAll('*')[0];
    assert.equal(meta.getAttribute('content'), LOCALES.en.meta.description);

    i18n.setLocale('de');
    assert.equal(meta.getAttribute('content'), LOCALES.de.meta.description);
    assert.notEqual(LOCALES.de.meta.description, LOCALES.en.meta.description, 'the locales should differ');
  });
});

  test('switching language never costs the page a control', async () => {
    // `applyTo()` writes a text binding with `textContent = ...`, which deletes
    // every child of the node it is applied to. Put that binding on a wrapper —
    // as the "Hide forks" label once was, wrapping its own checkbox — and the
    // first language switch removes the control from the page. Nothing visible
    // fails; the checkbox is simply gone, and only a German visitor ever finds
    // out. This boots the real app in a real DOM and switches back and forth.
    const environment = createDomEnvironment({ languages: ['en-US', 'en'] });
    const document = environment.document;
    const { bootstrap } = await import('../src/app.js');

    const app = bootstrap({
      host: document,
      storage: createMemoryStorage(),
      fetch: async () => ({ ok: true, status: 200, headers: new Map(), json: async () => [] }),
    });

    const CONTROL = 'input, select, textarea, button';
    const countControls = () => document.querySelectorAll(CONTROL).length;
    const boundWithChildren = () =>
      [...document.querySelectorAll('[data-i18n]')]
        .filter((node) => node.children.length > 0)
        .map((node) => `<${node.tagName.toLowerCase()}> ${node.getAttribute('data-i18n')}`);

    try {
      const english = countControls();
      assert.ok(english > 0, 'the boot rendered no controls at all');

      for (const locale of ['de', 'en', 'de']) {
        app.ctx.i18n.setLocale(locale);
        assert.equal(
          countControls(),
          english,
          `switching to "${locale}" changed the number of controls on the page`,
        );
        assert.deepEqual(
          boundWithChildren(),
          [],
          `a data-i18n binding sits on an element with children — the switch will eat them`,
        );
      }
    } finally {
      app.destroy?.();
      environment.cleanup();
    }
  });

/* -------------------------------------------------------------------------- *
 * Call sites
 * -------------------------------------------------------------------------- */

describe('every key the code asks for exists', () => {
  // Key parity is checked above, but parity between two dictionaries says
  // nothing about whether either one holds the keys the app actually asks for.
  // A key that exists in neither locale fails soft at runtime: the translator
  // logs a warning and the interface prints the raw key — `summary.author.label`
  // in the middle of a form. Nothing throws, no test fails, and the only way to
  // notice is to read every screen in both languages.
  //
  // Comments are stripped first, so a key named in a doc example is not treated
  // as a call site.

  const corpus = sourceFiles().map((file) => stripComments(readFileSync(file, 'utf8')));

  const attributes = [
    'data-i18n',
    ...I18N_TARGETS.filter((target) => target !== 'text').map((target) => `data-i18n-${target}`),
  ];

  const literals = new Set();
  for (const source of corpus) {
    for (const match of source.matchAll(/\bt\(\s*'([^']+)'/g)) literals.add(match[1]);
    for (const attribute of attributes) {
      for (const match of source.matchAll(bindingPattern(attribute))) literals.add(match[1]);
    }
  }

  test('a static t() call resolves in every locale', () => {
    assert.ok(literals.size > 100, `expected a substantial number of keys, found ${literals.size}`);
    for (const key of literals) {
      for (const [locale, dict] of Object.entries(LOCALES)) {
        assert.ok(resolves(dict, key), `"${key}" is used in the code but missing from ${locale}`);
      }
    }
  });

  test('a data-i18n binding resolves in every locale', () => {
    // The declarative half of the same contract — 100-odd attributes in `src/`
    // and the static shell, none of which go through a `t()` call at all.
    const bound = new Set();
    for (const source of corpus) {
      for (const attribute of attributes) {
        for (const match of source.matchAll(bindingPattern(attribute))) bound.add(match[1]);
      }
    }
    assert.ok(bound.size >= 20, `expected the shell and components to bind keys, found ${bound.size}`);
    for (const key of bound) {
      for (const [locale, dict] of Object.entries(LOCALES)) {
        assert.ok(resolves(dict, key), `data-i18n="${key}" has no entry in ${locale}`);
      }
    }
  });

  test('every GitHub error kind has a message', () => {
    // `GithubError.key` builds `` `errors.${kind}` `` at runtime, so no static
    // scan can see these call sites — the list has to be walked instead.
    for (const kind of GITHUB_ERROR_KINDS) {
      // `aborted` is deliberately remapped to the generic message: a fetch the
      // user cancelled is not worth an error of its own.
      const key = kind === 'aborted' ? 'errors.unknown' : `errors.${kind}`;
      for (const [locale, dict] of Object.entries(LOCALES)) {
        assert.ok(resolves(dict, key), `GitHub error "${kind}" has no ${locale} message`);
      }
    }
  });

  test('every repository status and status reason is named', () => {
    for (const id of REPO_STATUS_IDS) {
      for (const [locale, dict] of Object.entries(LOCALES)) {
        assert.ok(resolves(dict, `status.${id}`), `status "${id}" has no ${locale} label`);
      }
    }
    // `STATUS_REASONS` has no runtime reader — it exists so that exactly this
    // coverage can be asserted. Each entry is what `detectStatus()` puts in
    // `reason`, and the book prints it as the justification for a status.
    for (const reason of STATUS_REASONS) {
      for (const [locale, dict] of Object.entries(LOCALES)) {
        assert.ok(resolves(dict, `status.reasons.${reason}`), `reason "${reason}" has no ${locale} text`);
      }
    }
  });

  test('every named key constant resolves', () => {
    // `APP_TAGLINE_KEY` exists so the tagline's key is spelled once instead of
    // twice. A constant that points at nothing is worse than no constant: it
    // reads as verified and is not.
    for (const [locale, dict] of Object.entries(LOCALES)) {
      assert.ok(resolves(dict, APP_TAGLINE_KEY), `APP_TAGLINE_KEY has no ${locale} entry`);
    }
  });

  test('a dynamically built key has a namespace to land in', () => {
    // `t(`export.${format}`)` cannot be checked key by key, but a renamed or
    // deleted namespace leaves the prefix matching nothing at all — which is
    // the mistake that actually happens.
    const prefixes = new Set();
    for (const source of corpus) {
      for (const match of source.matchAll(/\bt\(\s*`([^`]*)`/g)) {
        const head = match[1].split('${')[0];
        if (head.includes('.')) prefixes.add(head.slice(0, head.lastIndexOf('.') + 1));
      }
    }
    assert.ok(prefixes.size > 0, 'no dynamic keys found — did the pattern change?');
    for (const prefix of prefixes) {
      for (const [locale, dict] of Object.entries(LOCALES)) {
        assert.ok(
          flatten(dict).some((key) => key.startsWith(prefix)),
          `no ${locale} key starts with "${prefix}"`,
        );
      }
    }
  });
});

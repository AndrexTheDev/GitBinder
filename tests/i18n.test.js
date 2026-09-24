/**
 * i18n unit tests: key parity between locales, interpolation, plurals,
 * locale detection and the DOM binding applier.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createTranslator, detectInitialLanguage, LOCALES, SUPPORTED_LANGUAGES } from '../src/i18n/index.js';
import { createI18n } from '../src/core/i18n.js';
import { createDocumentStub, createNavigator } from './helpers/memoryStorage.js';

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
});

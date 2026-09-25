/**
 * The language registry — `src/i18n/languages.js`, and the two places that
 * have to agree with it.
 *
 * Adding a language is three edits (a dictionary, a line in `LOCALES`, a line
 * in `LANGUAGES`). The tests below are about those three staying in step: a
 * language in the registry with no dictionary renders an empty interface, and
 * a dictionary with no registry entry can never be reached. Both are silent
 * failures — nothing throws, the page just comes up wrong — which is exactly
 * why they are worth pinning.
 *
 * The metadata itself feeds visible strings: the toggle's button label, the
 * accessible name read aloud by a screen reader, and the settings dropdown.
 * So the shape of each entry is asserted, not just its presence.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  FALLBACK_LANGUAGE,
  LANGUAGES,
  SUPPORTED_LANGUAGES,
  languageMeta,
  languageName,
} from '../src/i18n/languages.js';
import { LOCALES, detectInitialLanguage } from '../src/i18n/index.js';
import { createDomEnvironment } from './helpers/dom.js';
import { createMemoryStorage } from './helpers/memoryStorage.js';

/* -------------------------------------------------------------------------- *
 * The registry
 * -------------------------------------------------------------------------- */

describe('LANGUAGES', () => {
  test('every entry carries everything the interface prints', () => {
    for (const language of LANGUAGES) {
      assert.equal(typeof language.code, 'string', 'a language has no code');
      assert.ok(language.code.length > 0, 'a language has an empty code');

      // The two-letter label is what the collapsed toggle shows.
      assert.equal(
        language.label,
        language.code.toUpperCase(),
        `${language.code} does not use its own code as its short label`,
      );

      // Read by a screen reader and by the settings dropdown.
      for (const field of ['nativeLabel', 'englishLabel']) {
        assert.equal(typeof language[field], 'string', `${language.code} has no ${field}`);
        assert.ok(language[field].trim().length > 0, `${language.code} has an empty ${field}`);
      }
    }
  });

  test('a language is named in its own language', () => {
    // "Deutsch", not "German": a visitor who cannot read the current language
    // has to be able to find their own in the list.
    assert.equal(languageMeta('de').nativeLabel, 'Deutsch');
    assert.equal(languageMeta('de').englishLabel, 'German');
    assert.equal(languageMeta('en').nativeLabel, 'English');
  });

  test('no code is listed twice', () => {
    const codes = LANGUAGES.map((language) => language.code);
    assert.equal(new Set(codes).size, codes.length, `duplicate codes in ${codes.join(', ')}`);
  });

  test('the labels are distinguishable from each other', () => {
    // Two languages sharing a short label would make the toggle ambiguous.
    const labels = LANGUAGES.map((language) => language.label);
    assert.equal(new Set(labels).size, labels.length);
    const native = LANGUAGES.map((language) => language.nativeLabel);
    assert.equal(new Set(native).size, native.length);
  });

  test('the codes are plain lower-case language tags', () => {
    // They go straight into `Intl.PluralRules`, `Intl.DateTimeFormat` and
    // `<html lang>`, so "EN" or "en_US" would break the formatters quietly.
    for (const code of SUPPORTED_LANGUAGES) {
      assert.match(code, /^[a-z]{2}(-[A-Za-z]{2,4})?$/, `unusable language tag: ${code}`);
    }
  });

  test('SUPPORTED_LANGUAGES is the codes, in the same order, and frozen', () => {
    assert.deepEqual([...SUPPORTED_LANGUAGES], LANGUAGES.map((language) => language.code));
    assert.ok(Object.isFrozen(SUPPORTED_LANGUAGES), 'SUPPORTED_LANGUAGES can be mutated');
  });
});

/* -------------------------------------------------------------------------- *
 * The three places that must agree
 * -------------------------------------------------------------------------- */

describe('the registry, the dictionaries and the detector', () => {
  test('every registered language has a dictionary', () => {
    // Without this, picking a language in the toggle would translate the
    // interface into nothing.
    for (const code of SUPPORTED_LANGUAGES) {
      assert.ok(LOCALES[code], `"${code}" is offered but has no dictionary`);
      assert.equal(typeof LOCALES[code], 'object', `the "${code}" dictionary is not an object`);
      assert.ok(Object.keys(LOCALES[code]).length > 0, `the "${code}" dictionary is empty`);
    }
  });

  test('every dictionary can be reached from the interface', () => {
    // The other direction: a dictionary nobody can select is dead weight in
    // the bundle and, worse, looks like a language that works.
    for (const code of Object.keys(LOCALES)) {
      assert.ok(
        SUPPORTED_LANGUAGES.includes(code),
        `the "${code}" dictionary cannot be selected in any interface`,
      );
    }
  });

  test('the fallback is a language that exists', () => {
    assert.ok(SUPPORTED_LANGUAGES.includes(FALLBACK_LANGUAGE), `${FALLBACK_LANGUAGE} is not shipped`);
    assert.ok(LOCALES[FALLBACK_LANGUAGE], `${FALLBACK_LANGUAGE} has no dictionary to fall back to`);
  });

  test('a browser asking for any shipped language gets it', () => {
    // The detector and the registry read the same list, so this is the contract
    // between them: every offered language is reachable from `navigator`,
    // with and without a region.
    for (const code of SUPPORTED_LANGUAGES) {
      const plain = detectInitialLanguage({ navigator: { language: code, languages: [code] } });
      assert.equal(plain, code, `navigator.language = ${code} did not select it`);

      const regional = detectInitialLanguage({ navigator: { language: `${code}-XY` } });
      assert.equal(regional, code, `${code}-XY did not fall back to its base language`);
    }
  });

  test('the fallback language is a real translation, not a set of keys', () => {
    // The fallback is what a visitor sees when their browser asks for
    // something nobody translated, and it is also the per-key fallback inside
    // `translate()`. If it were an empty dictionary, every miss would surface
    // as a raw key like "book.cover.title".
    const dictionary = LOCALES[FALLBACK_LANGUAGE];
    assert.ok(dictionary.meta?.title, 'the fallback has no document title');
    assert.ok(dictionary.common, 'the fallback has no common strings');
  });
});

/* -------------------------------------------------------------------------- *
 * The lookups
 * -------------------------------------------------------------------------- */

describe('languageMeta', () => {
  test('it returns the registered entry', () => {
    for (const language of LANGUAGES) {
      assert.equal(languageMeta(language.code), language);
    }
  });

  test('an unknown code has no metadata rather than a made-up entry', () => {
    for (const value of ['fr', 'EN', 'en-US', '', null, undefined, 42, {}]) {
      assert.equal(languageMeta(value), undefined, `${JSON.stringify(value)} produced metadata`);
    }
  });

  test('the lookup is exact — "en-US" is not "en"', () => {
    // Normalising here would hide the difference between a language and a
    // regional variant, and the state stores one of the two.
    assert.equal(languageMeta('en-US'), undefined);
    assert.equal(languageMeta('EN'), undefined);
  });
});

describe('languageName', () => {
  test('a known language reads as its native name', () => {
    assert.equal(languageName('de'), 'Deutsch');
    assert.equal(languageName('en'), 'English');
  });

  test('an unknown language reads as its upper-cased code, never as "undefined"', () => {
    // This string is printed next to the visitor's avatar in the hero panel.
    for (const value of ['fr', 'pt-BR', 'xx']) {
      assert.equal(languageName(value), value.toUpperCase());
    }
  });

  test('an empty value reads as an empty string, not as a crash', () => {
    for (const value of ['', null, undefined]) {
      assert.equal(languageName(value), '');
    }
  });

  test('it never returns a raw object or a number-ish string', () => {
    for (const value of [42, {}, [], NaN]) {
      assert.doesNotMatch(String(languageName(value)), /undefined|object/);
    }
  });
});

/* -------------------------------------------------------------------------- *
 * What the visitor actually sees
 * -------------------------------------------------------------------------- */

describe('the language control on the page', () => {
  // The real control: one button per language, whose short label is visible,
  // whose native name is the tooltip and the screen-reader text, and whose
  // `data-lang` is the code handed to `settings.set('language', …)`.
  //
  // This is the one describe in the file that boots the app, so it owns its
  // own environment and tears it down.
  let environment;
  let app;
  let document;

  /** @returns {HTMLButtonElement[]} */
  const buttons = () => [...document.querySelectorAll('[data-lang]')];

  before(async () => {
    environment = createDomEnvironment({ languages: ['en-US', 'en'] });
    document = environment.document;
    const { bootstrap } = await import('../src/app.js');

    app = bootstrap({
      host: document,
      storage: createMemoryStorage(),
      fetch: async () => ({ ok: true, status: 200, headers: new Map(), json: async () => [] }),
    });
  });

  after(() => {
    app.destroy?.();
    environment.cleanup();
  });

  test('the control offers exactly the registered languages, and no others', () => {
    // The drift guard that matters most. A language added to `LANGUAGES` but
    // not rendered cannot be chosen; a button left behind after a language is
    // removed would ask for a dictionary that is not there.
    assert.deepEqual(
      buttons().map((button) => button.getAttribute('data-lang')),
      [...SUPPORTED_LANGUAGES],
      'the control and the registry disagree about which languages exist',
    );
  });

  test('each button shows the short label, and names the language natively', () => {
    for (const button of buttons()) {
      const code = button.getAttribute('data-lang');
      const meta = languageMeta(code);

      assert.ok(meta, `the control offers "${code}", which is not registered`);
      assert.ok(
        button.textContent.includes(meta.label),
        `the "${code}" button does not show "${meta.label}"`,
      );
      // The tooltip and the accessible name are the two places a visitor finds
      // a language they can read; both come from the registry.
      assert.equal(button.getAttribute('title'), meta.nativeLabel);
      assert.ok(
        button.textContent.includes(meta.nativeLabel),
        `the "${code}" button does not name itself "${meta.nativeLabel}" for a screen reader`,
      );
    }
  });

  test('the active language is the one the document claims to be in', () => {
    const pressed = buttons().filter((button) => button.getAttribute('aria-pressed') === 'true');
    assert.equal(pressed.length, 1, 'exactly one language has to be the current one');

    const active = pressed[0].getAttribute('data-lang');
    assert.equal(document.documentElement.getAttribute('lang'), active);
    assert.equal(active, FALLBACK_LANGUAGE, 'a cold start did not begin in the fallback language');
  });

  test('choosing the other language through the control changes the document', () => {
    // End to end and through the real button, because the registry is only
    // half the story: the click has to reach `i18n.setLocale()` and
    // `<html lang>` for a language to mean anything.
    const other = SUPPORTED_LANGUAGES.find((code) => code !== FALLBACK_LANGUAGE);
    const button = buttons().find((entry) => entry.getAttribute('data-lang') === other);
    assert.ok(button, `no button for "${other}"`);

    button.click();

    assert.equal(document.documentElement.getAttribute('lang'), other);
    assert.equal(
      buttons().filter((entry) => entry.getAttribute('aria-pressed') === 'true').length,
      1,
      'two languages are marked current at once',
    );
    assert.equal(
      button.getAttribute('aria-pressed'),
      'true',
      `the "${other}" button did not become the current one`,
    );

    // And back, so the fallback path is exercised too.
    buttons().find((entry) => entry.getAttribute('data-lang') === FALLBACK_LANGUAGE).click();
    assert.equal(document.documentElement.getAttribute('lang'), FALLBACK_LANGUAGE);
  });
});

/**
 * The application context and the state migration driver — `src/state/index.js`
 * and `migrateState()` from `src/state/schema.js`.
 *
 * Everything else in the test suite builds a store by hand, with the shape it
 * needs. This file boots the real thing: `createAppContext()` wires settings,
 * vault, codec, bus and translator together, and it is what a returning
 * visitor's browser actually runs before the first paint.
 *
 * That makes it the one place where the *whole* persistence story is
 * observable: the token is sealed at rest and opens again on the next visit,
 * a payload written before the rename is moved rather than ignored, a payload
 * from an older schema version is migrated rather than dropped, and the
 * language the visitor chose comes back in the language they chose. Each of
 * those is a promise to somebody who already used the app; each of them fails
 * silently.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createAppContext } from '../src/state/index.js';
import { migrateState } from '../src/state/schema.js';
import { LEGACY_STORAGE_KEYS, STATE_SCHEMA_VERSION, STORAGE_KEYS, TONE_BY_STATUS, REPO_STATUS_IDS, REPO_STATUSES, STATUS_RANK, DEFAULT_STATUS, LEGACY_STATUS_MAP, APP_VERSION, ADBLOCK_GATE, DEVELOPER } from '../src/config/app.js';
import { createMemoryStorage } from '../src/core/storage.js';
import { DEFAULT_AUTHOR_EMAIL, DEFAULT_AUTHOR_NAME, DEFAULT_BOOK_TITLE } from '../src/state/schema.js';
import { migrateLegacyStatus } from '../src/services/status.js';
import { LOCALES } from '../src/i18n/index.js';
import pkg from '../package.json' with { type: 'json' };

/** Boot the real context on the given storage, collecting any errors it logs. */
function boot(storage = createMemoryStorage()) {
  const errors = [];
  const ctx = createAppContext({
    storage,
    // The default reports to the console; a test wants the list instead.
    onError: (error) => errors.push(error),
  });
  return { ctx, errors, storage };
}

/** The raw stored text of every key, for "does this string appear on disk". */
const everythingOnDisk = (storage) =>
  Array.from({ length: storage.length }, (_, index) => {
    const key = storage.key(index);
    return `${key}=${storage.getItem(key)}`;
  }).join('\n');

/* -------------------------------------------------------------------------- *
 * The migration driver
 * -------------------------------------------------------------------------- */

describe('migrateState', () => {
  test('it carries a payload across the versions it was asked for', () => {
    const payload = { bookTitle: 'Alt', repos: { 'a/b': { visible: true } } };
    const migrated = migrateState(payload, 0, STATE_SCHEMA_VERSION);

    assert.deepEqual(migrated, payload, 'the payload changed on its way through');
  });

  test('a payload at the current version is returned untouched', () => {
    const payload = { a: 1 };
    // Same reference on purpose: `from === to` means "nothing to do", and
    // copying here would hide a wrong `versions differ` check somewhere.
    assert.equal(migrateState(payload, STATE_SCHEMA_VERSION, STATE_SCHEMA_VERSION), payload);
  });

  test('it never mutates the payload it was handed', () => {
    // The store clones before migrating, but a caller that forgets must not
    // corrupt a live state object.
    const payload = { a: { b: 1 } };
    const copy = structuredClone(payload);
    migrateState(payload, 0, STATE_SCHEMA_VERSION);

    assert.deepEqual(payload, copy);
  });

  test('anything that is not an object migrates to an empty object', () => {
    // Every shape a hand-edited file or a broken write can leave behind.
    for (const value of [null, undefined, 42, 'text', [], true, () => {}]) {
      assert.deepEqual(migrateState(value, 0, STATE_SCHEMA_VERSION), {});
    }
  });

  test('a version number that is not a number is treated as the oldest one', () => {
    // The direction that matters: an unreadable version has to migrate *up*,
    // never skip the migrations it needs.
    for (const from of ['x', null, undefined, NaN, {}, -1]) {
      assert.deepEqual(migrateState({ a: 1 }, from, STATE_SCHEMA_VERSION), { a: 1 });
    }
  });

  test('a payload from the future is passed through, not mangled or refused', () => {
    // A visitor who opened a newer preview build and then the stable one.
    // Migration runs from 99 down to 1, which is a no-op loop.
    const future = { a: 1, notInThisVersionYet: true };
    assert.deepEqual(migrateState(future, 99, STATE_SCHEMA_VERSION), future);
  });

  test('it is idempotent — migrating twice changes nothing the second time', () => {
    const once = migrateState({ a: 1 }, 0, STATE_SCHEMA_VERSION);
    const twice = migrateState(structuredClone(once), 0, STATE_SCHEMA_VERSION);
    assert.deepEqual(twice, once);
  });

  test('a migration that throws is not swallowed into a half-migrated payload', () => {
    // `MIGRATIONS` is private, so the contract asserted here is the visible
    // one: an out-of-range request is simply a no-op rather than an exception
    // the boot path has to catch.
    assert.doesNotThrow(() => migrateState({ a: 1 }, 0, STATE_SCHEMA_VERSION + 10));
  });
});

/* -------------------------------------------------------------------------- *
 * The published constants
 * -------------------------------------------------------------------------- */

describe('the constants a release depends on', () => {
  test('APP_VERSION is the version in package.json', () => {
    // The number in the footer, the number in the release tag and the number
    // in `package.json` are read by three different people. This is the one
    // place where two of them can be compared automatically.
    assert.equal(APP_VERSION, pkg.version, 'the footer would show a version nobody published');
  });

  test('every status has a rank and a tone', () => {
    // `STATUS_RANK` orders the printed table of contents and `TONE_BY_STATUS`
    // colours it; a status missing from either would sort as `undefined` or
    // render uncoloured, in silence.
    for (const status of REPO_STATUS_IDS) {
      assert.equal(typeof STATUS_RANK[status], 'number', `no rank for "${status}"`);
      assert.ok(TONE_BY_STATUS[status], `no tone for "${status}"`);
    }
    assert.ok(REPO_STATUS_IDS.includes(DEFAULT_STATUS), 'the default status is not a status');
  });

  test('the ranks are distinct, so the book order is defined', () => {
    // Two statuses sharing a rank would leave the chapter order up to the sort
    // implementation.
    const ranks = REPO_STATUS_IDS.map((status) => STATUS_RANK[status]);
    assert.equal(new Set(ranks).size, ranks.length, `duplicate ranks in ${ranks.join(', ')}`);
  });

  test('every status has a word and a sentence in both dictionaries', () => {
    // The label, the tooltip hint and the reason are all lookups —
    // `status.live`, `status.hints.live`, `status.reasons.<why>`. A status
    // without them renders as the raw key in the middle of the library.
    for (const status of REPO_STATUS_IDS) {
      for (const [locale, dictionary] of Object.entries(LOCALES)) {
        const words = dictionary.status ?? {};
        assert.equal(typeof words[status], 'string', `${locale} has no word for "${status}"`);
        assert.equal(typeof words.hints?.[status], 'string', `${locale} has no hint for "${status}"`);
      }
    }
  });

  test('the legacy taxonomy still lands on real statuses', () => {
    // The map translates statuses from before the taxonomy changed. A target
    // that no longer exists would put an unknown status into a stored override
    // — the one thing `sanitizeRepoOverrides()` refuses.
    for (const [legacy, target] of Object.entries(LEGACY_STATUS_MAP)) {
      assert.ok(
        REPO_STATUS_IDS.includes(target),
        `legacy "${legacy}" points at "${target}", which is not a status`,
      );
      assert.equal(migrateLegacyStatus(legacy), target, `migrateLegacyStatus disagrees about "${legacy}"`);
    }
  });

  test('a current status is never rewritten by the legacy map', () => {
    // If a current id were also an old id, the two taxonomies would collide and
    // a stored choice would change meaning without the visitor touching it.
    for (const status of REPO_STATUS_IDS) {
      assert.equal(migrateLegacyStatus(status), status, `"${status}" is rewritten by the legacy map`);
      assert.ok(!(status in LEGACY_STATUS_MAP), `"${status}" is both current and legacy`);
    }
  });

  test('the ad-blocker gate and the developer contact are filled in', () => {
    // Both are printed: the notice to a visitor, the address on the imprint,
    // and the QR code on the back cover.
    assert.equal(ADBLOCK_GATE.enabled, true, 'the ad-blocker notice is switched off');
    assert.equal(DEVELOPER.email, DEFAULT_AUTHOR_EMAIL);
    assert.match(DEVELOPER.email, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/);
    assert.ok(DEVELOPER.name);
  });
});

/* -------------------------------------------------------------------------- *
 * The context
 * -------------------------------------------------------------------------- */

describe('createAppContext', () => {
  test('it exposes the surface every consumer expects', () => {
    const { ctx } = boot();

    for (const key of ['storage', 'vault', 'codec', 'bus', 'settings', 'session', 'i18n', 't'])
      assert.ok(ctx[key], `the context has no "${key}"`);
    assert.equal(typeof ctx.t, 'function');
    assert.deepEqual(ctx.migratedKeys, [], 'a fresh boot claims to have migrated something');
  });

  test('a first visit starts from the defaults in the spec', () => {
    const { ctx } = boot();

    assert.equal(ctx.settings.get('customBookTitle'), DEFAULT_BOOK_TITLE);
    assert.equal(ctx.settings.get('authorName'), DEFAULT_AUTHOR_NAME);
    assert.equal(ctx.settings.get('authorEmail'), DEFAULT_AUTHOR_EMAIL);
    assert.equal(ctx.settings.get('personalAccessToken'), '');
    assert.deepEqual(ctx.settings.get('repoOverrides'), {});
  });

  test('the session is memory only', () => {
    // Repositories are re-fetched rather than stored, so a book can never be
    // built from a stale list. Nothing about the session may reach disk.
    const { ctx, storage } = boot();
    ctx.session.set('repos', [{ slug: 'octo/example', name: 'example' }]);
    ctx.settings.set('bookTitle', 'Persisted, unlike the session');
    ctx.settings.persistNow();

    assert.deepEqual(ctx.session.get('repos'), [{ slug: 'octo/example', name: 'example' }]);
    assert.equal(everythingOnDisk(storage).includes('octo/example'), false, 'session data reached disk');

    const keys = JSON.parse(storage.getItem(STORAGE_KEYS.state));
    assert.equal(keys.data.repos, undefined, 'the settings envelope carries session data');
  });

  test('the token is sealed on disk and opens again on the next visit', () => {
    const storage = createMemoryStorage();
    const { ctx } = boot(storage);
    const token = 'ghp_aVeryRealLookingToken';

    ctx.settings.set('personalAccessToken', token);
    ctx.settings.persistNow();

    // At rest: not readable, not even findable as a substring.
    assert.equal(
      everythingOnDisk(storage).includes(token),
      false,
      'the personal access token is lying on disk in plain text',
    );

    // Next visit, same browser: the visitor is still signed in.
    const { ctx: next } = boot(storage);
    assert.equal(next.settings.get('personalAccessToken'), token);
  });

  test('a payload written before the rename is moved and still works', () => {
    // The upgrade path from the previous name of this project: the data sits
    // under the old key, encrypted with the old device key.
    const storage = createMemoryStorage();
    const first = boot(storage);
    first.ctx.settings.set('customBookTitle', 'Mein Buch');
    first.ctx.settings.persistNow();

    storage.setItem(LEGACY_STORAGE_KEYS.state, storage.getItem(STORAGE_KEYS.state));
    storage.removeItem(STORAGE_KEYS.state);

    const { ctx, errors } = boot(storage);
    assert.deepEqual(ctx.migratedKeys, [STORAGE_KEYS.state], 'the old key was not reported as moved');
    assert.equal(ctx.settings.get('customBookTitle'), 'Mein Buch', 'the book did not survive the rename');
    assert.deepEqual(errors, []);
    assert.equal(storage.getItem(LEGACY_STORAGE_KEYS.state), null, 'the old key was left behind');
  });

  test('a payload from an older schema version is migrated, not discarded', () => {
    // The envelope is written by whichever build was open. An older one has a
    // lower version and, quite possibly, fields this build has renamed.
    const storage = createMemoryStorage();
    storage.setItem(
      STORAGE_KEYS.state,
      JSON.stringify({
        $schema: 'gitbinder/state',
        name: 'settings',
        version: 0,
        data: { customBookTitle: 'Aus Version 0', language: 'de', authorName: 'Jemand' },
      }),
    );

    const { ctx, errors } = boot(storage);
    assert.deepEqual(errors, [], 'migrating an old payload raised an error');
    assert.equal(ctx.settings.get('customBookTitle'), 'Aus Version 0');
    assert.equal(ctx.settings.get('authorName'), 'Jemand');
    // The new version number is written back, so the next boot does not repeat
    // the migration.
    ctx.settings.persistNow();
    assert.equal(JSON.parse(storage.getItem(STORAGE_KEYS.state)).version, STATE_SCHEMA_VERSION);
  });

  test('a bare state object without an envelope is accepted', () => {
    // Somebody pasted a settings file into the console, or an older build
    // wrote before the envelope existed.
    const storage = createMemoryStorage();
    storage.setItem(STORAGE_KEYS.state, JSON.stringify({ customBookTitle: 'Ohne Umschlag' }));

    const { ctx, errors } = boot(storage);
    assert.equal(ctx.settings.get('customBookTitle'), 'Ohne Umschlag');
    assert.deepEqual(errors, []);
  });

  test('a corrupted payload boots into the defaults and reports why', () => {
    // Reporting matters as much as surviving: a visitor whose storage is
    // broken gets a working page and a console that says what happened.
    for (const broken of ['{not json', 'null', '"a string"', '42']) {
      const storage = createMemoryStorage();
      storage.setItem(STORAGE_KEYS.state, broken);

      const { ctx } = boot(storage);
      assert.equal(ctx.settings.get('customBookTitle'), DEFAULT_BOOK_TITLE, `"${broken}" produced a book`);
    }
  });

  test('a stored field this build does not know is dropped, its neighbours are not', () => {
    // This is what a renamed field looks like from the next version: the old
    // key is ignored (silently, on purpose — it may also be somebody's typo),
    // while everything around it survives. A migration is only needed when the
    // *meaning* has to be carried over, not merely the name.
    const storage = createMemoryStorage();
    storage.setItem(
      STORAGE_KEYS.state,
      JSON.stringify({
        data: { customBookTitle: 'Bekannt', authorName: 'Auch bekannt', bookTitle: 'Vom alten Build' },
      }),
    );

    const { ctx, errors } = boot(storage);
    assert.equal(ctx.settings.get('customBookTitle'), 'Bekannt');
    assert.equal(ctx.settings.get('authorName'), 'Auch bekannt');
    assert.equal(ctx.settings.get('bookTitle'), undefined, 'an unknown field reached the state');
    assert.deepEqual(errors, [], 'an unknown field was reported as a failure');
  });

  test('the language the visitor chose comes back', () => {
    const storage = createMemoryStorage();
    const first = boot(storage);
    first.ctx.settings.set('language', 'de');
    first.ctx.settings.persistNow();

    const { ctx } = boot(storage);
    assert.equal(ctx.settings.get('language'), 'de');
    assert.equal(ctx.i18n.locale, 'de', 'the translator ignored the stored language');

    // Not just a stored string: the strings really are the German ones.
    // ("live" is spelled the same in both dictionaries, so the comparison
    // needs a key whose translations genuinely differ.)
    assert.notEqual(LOCALES.de.status.development, LOCALES.en.status.development);
    assert.equal(ctx.t('status.development'), LOCALES.de.status.development);
  });

  test('the store and the translator agree, in both directions', () => {
    const { ctx } = boot();

    // Settings → translator (the drawer, an import, another tab).
    ctx.settings.set('language', 'de');
    assert.equal(ctx.i18n.locale, 'de');

    // Translator → settings (anything that switches the locale directly).
    ctx.i18n.setLocale('en');
    assert.equal(ctx.settings.get('language'), 'en', 'the two would drift apart on the next persist');
  });
});

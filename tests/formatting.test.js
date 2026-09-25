/**
 * Presentation helpers, second half — `src/utils/format.js`.
 *
 * `tests/utils.test.js` covers the helpers that take a string and return a
 * string. This file covers the ones that go through `Intl`: the date, time and
 * number formatters the book and the interface print, plus the two small
 * string helpers that decide how a repository name appears in a chapter title.
 *
 * They are locale-dependent, so the tests pin a locale explicitly rather than
 * the machine's. Where a value is genuinely implementation-defined (a
 * non-breaking space in a German date, the exact width of a compact number),
 * the assertion is on the property that matters — it formatted, it agrees with
 * `Intl` — not on a literal that would break on a Node upgrade.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatCompact,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  normalizeUrl,
  sentenceCase,
  slugifyTitle,
  truncate,
} from '../src/utils/format.js';

/* -------------------------------------------------------------------------- *
 * Numbers
 * -------------------------------------------------------------------------- */

describe('formatNumber', () => {
  test('groups digits the way the locale does', () => {
    // 1.234 in German, 1,234 in English — the same number, and getting it
    // backwards on the cover of a printed book is very visible.
    assert.equal(formatNumber(1234, 'en'), '1,234');
    assert.equal(formatNumber(1234, 'de').replace(/\u00a0|\u202f/g, ' '), '1.234');
  });

  test('a value that is not a number reads as a dash, not as "NaN"', () => {
    for (const value of [undefined, 'not a number', NaN, Infinity, -Infinity, {}]) {
      assert.equal(formatNumber(value), '—', `${JSON.stringify(value)} did not format as a dash`);
    }
  });

  test('a missing count is zero, unlike a missing date', () => {
    // `Number(null)` is 0, and for a count that is the right answer: no stars
    // is genuinely no stars. A missing *date* is a different question — see
    // `formatDate` below, where null must not become 1 January 1970.
    assert.equal(formatNumber(null), '0');
  });

  test('zero is a number', () => {
    // The classic falsy bug: `if (!value) return '—'` would print a dash where
    // the book should print "0 stars".
    assert.equal(formatNumber(0), '0');
  });

  test('options are passed through to Intl', () => {
    assert.equal(formatNumber(0.5, 'en', { style: 'percent' }), '50%');
    assert.equal(formatNumber(2.345, 'en', { maximumFractionDigits: 1 }), '2.3');
  });

  test('negative numbers keep their sign', () => {
    assert.match(formatNumber(-42, 'en'), /^-42$/);
  });
});

describe('formatCompact', () => {
  test('large numbers are abbreviated', () => {
    // A stat chip has room for "1.2K", not for "1,234".
    const compact = formatCompact(1234, 'en');
    assert.match(compact, /1\.2\s?K/i, `unexpected compact form: ${compact}`);
    assert.ok(compact.length < String(1234).length + 3);
  });

  test('the abbreviation is locale-aware', () => {
    assert.notEqual(formatCompact(1_500_000, 'en'), formatCompact(1_500_000, 'de'));
  });

  test('small numbers stay readable', () => {
    assert.equal(formatCompact(12, 'en'), '12');
  });

  test('it inherits the dash for a non-number', () => {
    assert.equal(formatCompact('nonsense'), '—');
  });
});

/* -------------------------------------------------------------------------- *
 * Dates
 * -------------------------------------------------------------------------- */

describe('formatDate', () => {
  test('accepts a Date, an ISO string and a timestamp alike', () => {
    const date = new Date('2026-03-04T15:30:00.000Z');
    const expected = formatDate(date, 'en');

    assert.equal(formatDate(date.toISOString(), 'en'), expected);
    assert.equal(formatDate(date.getTime(), 'en'), expected);
  });

  test('the locale decides the order', () => {
    const value = '2026-03-04T12:00:00.000Z';
    assert.notEqual(formatDate(value, 'en'), formatDate(value, 'de'));
  });

  test('an unparseable date reads as a dash, not as "Invalid Date"', () => {
    // This value reaches the page as printed text; "Invalid Date" on the cover
    // of a book is worse than a dash.
    for (const value of ['', 'yesterday', null, undefined, NaN, {}]) {
      assert.equal(formatDate(value), '—', `${JSON.stringify(value)} did not format as a dash`);
    }
  });

  test('a date that is only a time is still a date', () => {
    assert.notEqual(formatDate('2026-03-04'), '—');
  });

  test('null is "no date", never 1 January 1970', () => {
    // `new Date(null)` is the epoch. `normalizeRepo()` writes
    // `updatedAt: raw?.updated_at ?? null`, so a repository whose date arrived
    // missing would have printed a date from 1970 — and "57 years ago".
    assert.equal(formatDate(null), '—');
    assert.equal(formatDateTime(null), '—');
    assert.equal(formatRelativeTime(null, 'en', Date.now()), '—');

    // A timestamp of zero is still a real moment, though.
    assert.match(formatDate(0), /1970/);
  });

  test('it cannot render the words "Invalid Date"', () => {
    for (const value of ['2026-13-45', 'nope', 1e20]) {
      assert.doesNotMatch(String(formatDate(value)), /Invalid|NaN/);
    }
  });
});

describe('formatDateTime', () => {
  test('it includes the time, unlike formatDate', () => {
    const value = '2026-03-04T15:30:00.000Z';
    assert.notEqual(formatDateTime(value, 'en'), formatDate(value, 'en'));
  });

  test('an unparseable value reads as a dash', () => {
    for (const value of ['', 'nope', null, undefined]) {
      assert.equal(formatDateTime(value), '—');
    }
  });

  test('both formatters agree on what is not a date', () => {
    // "last synchronised" prints one and "generated on" the other, so a
    // disagreement would show two different placeholders in one panel.
    for (const value of ['', 'nope', null, undefined, {}, NaN]) {
      assert.equal(formatDateTime(value), formatDate(value), `the two disagree about ${JSON.stringify(value)}`);
      assert.equal(formatDate(value), '—');
    }
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-06-15T12:00:00.000Z').getTime();
  const ago = (ms) => new Date(now - ms).toISOString();
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  test('it picks the largest unit that fits', () => {
    assert.match(formatRelativeTime(ago(3 * DAY), 'en', now), /3 days ago/);
    assert.match(formatRelativeTime(ago(5 * HOUR), 'en', now), /5 hours ago/);
    assert.match(formatRelativeTime(ago(10 * MINUTE), 'en', now), /10 minutes ago/);
  });

  test('the unit boundaries are inclusive of the unit below', () => {
    // Just under a day is hours, just over is a day — a jump in the wrong place
    // reads as "0 days ago".
    assert.match(formatRelativeTime(ago(DAY - HOUR), 'en', now), /hour/);
    assert.match(formatRelativeTime(ago(DAY), 'en', now), /day/);
    assert.match(formatRelativeTime(ago(30 * DAY), 'en', now), /month/);
    assert.match(formatRelativeTime(ago(365 * DAY), 'en', now), /year/);
  });

  test('anything under a minute is still a time, never "now" with no unit', () => {
    const value = formatRelativeTime(ago(5_000), 'en', now);
    assert.ok(value.trim().length > 0);
    assert.doesNotMatch(value, /undefined|NaN/);
  });

  test('it speaks the locale it was given', () => {
    const english = formatRelativeTime(ago(3 * DAY), 'en', now);
    const german = formatRelativeTime(ago(3 * DAY), 'de', now);
    assert.notEqual(english, german);
    assert.match(german, /Tagen/);
  });

  test('a future date is not reported in the past', () => {
    // Clock skew between the browser and GitHub is real, and "in 2 hours" is a
    // better answer than "-2 hours ago".
    const ahead = new Date(now + 2 * HOUR).toISOString();
    const value = formatRelativeTime(ahead, 'en', now);
    assert.match(value, /in 2 hours/, `unexpected future form: ${value}`);
  });

  test('an unparseable value reads as a dash', () => {
    for (const value of ['', 'nope', null, undefined]) {
      assert.equal(formatRelativeTime(value, 'en', now), '—');
    }
  });
});

/* -------------------------------------------------------------------------- *
 * Strings
 * -------------------------------------------------------------------------- */

describe('sentenceCase', () => {
  test('a lower-case string is capitalised for display', () => {
    assert.equal(sentenceCase('live'), 'Live');
    assert.equal(sentenceCase('in development'), 'In development');
  });

  test('an empty or missing value stays empty', () => {
    assert.equal(sentenceCase(''), '');
    assert.equal(sentenceCase(null), '');
    assert.equal(sentenceCase(undefined), '');
  });

  test('it only touches the first character', () => {
    // "MVP" and "API" survive because nothing is lower-cased; the function is
    // for display, not for normalising somebody's words. It is also not clever
    // about camelCase — "iOS build" becomes "IOS build", which is what
    // "capitalise the first letter" means and why this is only used on
    // lower-case labels like the status ids.
    assert.equal(sentenceCase('MVP ready'), 'MVP ready');
    assert.equal(sentenceCase('iOS build'), 'IOS build');
  });

  test('leading whitespace stays, so callers trim first', () => {
    assert.equal(sentenceCase('  spaced  '), '  spaced  ');
  });

  test('it tolerates a non-string', () => {
    assert.equal(typeof sentenceCase(42), 'string');
  });
});

describe('normalizeUrl', () => {
  test('an absolute URL comes back in canonical form', () => {
    assert.equal(normalizeUrl('https://example.com'), 'https://example.com/');
    assert.equal(normalizeUrl('https://example.com/path'), 'https://example.com/path');
    assert.equal(normalizeUrl('HTTPS://EXAMPLE.COM/A'), 'https://example.com/A');
  });

  test('it is a normaliser, not a gate — that is `safeUrl`’s job', () => {
    // The name invites the opposite reading, and the difference matters: this
    // function returns whatever it was given when `new URL()` refuses it. The
    // pair is what the book uses (see below), and the pair is what is safe.
    assert.equal(normalizeUrl('example.com'), 'example.com');
    assert.equal(normalizeUrl('javascript:alert(1)'), 'javascript:alert(1)');
    assert.equal(normalizeUrl('my project'), 'my project');
  });

  test('an empty value stays empty rather than becoming a bare scheme', () => {
    for (const value of ['', '   ', null, undefined]) {
      assert.equal(normalizeUrl(value), '');
    }
  });

  test('the composition the book uses refuses hostile input outright', async () => {
    // `compose.js` builds every printed link as `normalizeUrl(safeUrl(raw))`:
    // `safeUrl` is the gate, `normalizeUrl` tidies what survived. Chromium's
    // print-to-PDF keeps link annotations, so whatever gets through this pair
    // becomes a clickable href in somebody's PDF — dropping either half is a
    // real regression, not a tidiness question.
    const { safeUrl } = await import('../src/utils/format.js');

    for (const hostile of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ]) {
      assert.equal(normalizeUrl(safeUrl(hostile)), '', `${hostile} survived the pair`);
    }

    for (const fine of ['https://example.com', 'example.com', 'meine-seite.de/projekt']) {
      assert.notEqual(normalizeUrl(safeUrl(fine)), '', `${fine} was refused`);
    }
  });
});

describe('truncate and slugifyTitle together', () => {
  test('a long repository description is clamped before it reaches the page', () => {
    const long = 'w'.repeat(400);
    const short = truncate(long, 96);

    assert.equal(short.length, 96, 'the clamp is not the advertised length');
    assert.ok(short.endsWith('…'));
  });

  test('the slug of a clamped title still produces a usable file name', () => {
    const slug = slugifyTitle(truncate('Übermäßig große Titel'.repeat(20), 60));
    assert.match(slug, /^[a-z0-9-]+$/, `unusable slug: ${slug}`);
    assert.ok(slug.length <= 60);
    assert.doesNotMatch(slug, /-{2,}/, 'the slug has runs of hyphens');
  });

  test('a title with nothing usable in it yields an empty slug, and each caller has a fallback', () => {
    // The function does not invent a name; it reports that there is nothing to
    // build one from. Both consumers answer for that themselves —
    // `export.js` uses `|| 'book'` and `bookFilename()` falls back to the bare
    // prefix — which is asserted where they live (`tests/export.test.js`,
    // `tests/print.test.js`). Pinned here so the contract stays visible from
    // the function's own test file: '' means "no slug", not "an empty file name".
    for (const value of ['...', '!!!', '', '   ', '——']) {
      assert.equal(slugifyTitle(value), '', `${JSON.stringify(value)} produced a slug after all`);
    }
  });
});

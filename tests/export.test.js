/**
 * Text exports — `src/book/export.js`.
 *
 * CSV is the format that bites: a stray quote or an embedded newline turns a
 * spreadsheet into garbage, and it does so silently. These tests pin the
 * escaping rules from RFC 4180 and the BOM that keeps Excel on Windows from
 * mangling non-ASCII text.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXPORT_FORMATS,
  buildTextExport,
  emptyNotePlaceholder,
  toCsv,
  toMarkdown,
  toPlainText,
} from '../src/book/export.js';
import { slugifyTitle as slugify } from '../src/utils/format.js';

/**
 * Minimal translator. Most keys resolve to a readable stand-in, but a few
 * carry real copy so the tests can prove the actual wording reaches the file
 * rather than just proving that *some* key was looked up.
 */
const COPY = {
  'book.cover.subtitle': 'Project & Codebase Anthology',
  'book.toc.title': 'Table of contents',
  'book.entry.notes': 'Notes',
  'book.entry.language': 'Language',
  'book.entry.status': 'Status',
  'book.entry.updated': 'Last updated',
};

const t = (key, params) => {
  const text = COPY[key] ?? key;
  if (params && typeof params === 'object') {
    return Object.entries(params).reduce((out, [k, v]) => out.replace(`{${k}}`, v), text);
  }
  return text;
};

const NOW = new Date('2026-09-24T10:00:00Z');

function chapter(overrides = {}) {
  return {
    slug: 'octo/alpha',
    name: 'alpha',
    chapter: 1,
    status: 'live',
    language: 'Go',
    stars: 12,
    forks: 3,
    updatedAt: NOW.toISOString(),
    license: { spdx_id: 'MIT' },
    description: 'Fallback description',
    shortDescription: 'A short description',
    url: 'https://github.com/octo/alpha',
    homepage: 'https://alpha.dev',
    topics: ['cli'],
    notes: null,
    isFork: false,
    ...overrides,
  };
}

const SETTINGS = {
  customBookTitle: 'My Portfolio',
  authorName: 'AndrexTheDev',
  authorContact: 'hippie.high@ho.com',
  generatedAt: NOW.toISOString(),
};

/* -------------------------------------------------------------------------- */

test('three formats are offered, each with a mime type and extension', () => {
  assert.deepEqual(
    EXPORT_FORMATS.map((f) => f.id),
    ['markdown', 'text', 'csv'],
  );
  for (const format of EXPORT_FORMATS) {
    assert.match(format.extension, /^[a-z]+$/);
    assert.match(format.mime, /^text\//);
  }
});

test('markdown carries the title, TOC and one section per chapter', () => {
  const md = toMarkdown({ settings: SETTINGS, chapters: [chapter()], t, locale: 'en' });
  assert.match(md, /^# My Portfolio/);
  assert.match(md, /Project & Codebase Anthology/);
  assert.match(md, /AndrexTheDev/);
  assert.match(md, /## Table of contents/);
  assert.match(md, /## 1\. Alpha/);
  assert.match(md, /https:\/\/github\.com\/octo\/alpha/);
});

test('markdown prints notes as a blockquote, line breaks preserved', () => {
  const md = toMarkdown({
    settings: SETTINGS,
    chapters: [chapter({ notes: 'line one\nline two' })],
    t,
    locale: 'en',
  });
  assert.match(md, /^> line one$/m);
  assert.match(md, /^> line two$/m);
});

test('an empty note still produces a writable gap', () => {
  // The whole point of the field: it must be there to be filled in later.
  const md = toMarkdown({ settings: SETTINGS, chapters: [chapter({ notes: null })], t, locale: 'en' });
  assert.match(md, /^> \.+/m, 'markdown should print a dotted placeholder');

  const txt = toPlainText({ settings: SETTINGS, chapters: [chapter({ notes: null })], t, locale: 'en' });
  assert.match(txt, /\.{20,}/);
  assert.equal(emptyNotePlaceholder('.').split('\n').length, 3);
});

test('plain text is a fixed-width document with a rule and a TOC', () => {
  const txt = toPlainText({ settings: SETTINGS, chapters: [chapter()], t, locale: 'en' });
  assert.match(txt, /^={10,}/m);
  assert.match(txt, /MY PORTFOLIO/);
  assert.match(txt, /01\. ALPHA/);
  for (const line of txt.split('\n')) {
    assert.ok(line.length <= 100, `line too long: ${line.length}`);
  }
});

/* -------------------------------------------------------------------------- *
 * CSV
 * -------------------------------------------------------------------------- */

function csvRows(csv) {
  // Strip the BOM, then parse honouring quoted fields (including newlines).
  const body = csv.replace(/^﻿/, '');
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && body[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

test('csv starts with a BOM so Excel on Windows reads UTF-8', () => {
  const csv = toCsv({ settings: SETTINGS, chapters: [chapter()], t, locale: 'en' });
  assert.equal(csv.charCodeAt(0), 0xfeff);
});

test('csv has one header row and one row per chapter', () => {
  const chapters = [chapter(), chapter({ slug: 'octo/beta', name: 'beta', chapter: 2 })];
  const rows = csvRows(toCsv({ settings: SETTINGS, chapters, t, locale: 'en' }));
  assert.equal(rows.length, 3, 'header + 2 chapters');
  assert.equal(rows[0].length, rows[1].length, 'ragged row');
});

test('csv escapes quotes by doubling them', () => {
  const nasty = chapter({
    shortDescription: 'He said "hello" and left',
    notes: 'Quote: "done"',
  });
  const rows = csvRows(toCsv({ settings: SETTINGS, chapters: [nasty], t, locale: 'en' }));
  const description = rows[1][9];
  const notes = rows[1][12];
  assert.equal(description, 'He said "hello" and left');
  assert.equal(notes, 'Quote: "done"');
});

test('a multi-line note stays a single csv record', () => {
  const rows = csvRows(
    toCsv({ settings: SETTINGS, chapters: [chapter({ notes: 'a\nb\nc' })], t, locale: 'en' }),
  );
  assert.equal(rows.length, 2, 'the newline must not split the record');
  assert.equal(rows[1][12], 'a\nb\nc');
});

test('csv handles commas and semicolons inside fields', () => {
  const rows = csvRows(
    toCsv({
      settings: SETTINGS,
      chapters: [chapter({ shortDescription: 'one, two; three, four' })],
      t,
      locale: 'en',
    }),
  );
  assert.equal(rows[1][9], 'one, two; three, four');
  assert.equal(rows[1].length, 13, 'a comma must not create an extra column');
});

test('csv uses CRLF line endings as RFC 4180 requires', () => {
  const csv = toCsv({ settings: SETTINGS, chapters: [chapter()], t, locale: 'en' });
  assert.ok(csv.includes('\r\n'));
  // A bare LF *between records* is what breaks Excel. Newlines inside a
  // quoted field are legal, so strip the quoted fields first — the pattern
  // covers embedded newlines and doubled quotes alike. A plain
  // `includes('\n')` would false-positive on the LF of every CRLF pair.
  const outsideQuotes = csv.replace(/"(?:[^"]|"")*"/g, '""');
  assert.equal(/(?<!\r)\n/.test(outsideQuotes), false, 'found a bare LF between records');
  assert.ok(csv.endsWith('\r\n'), 'file should end with CRLF');
});

/* -------------------------------------------------------------------------- */

test('buildTextExport names the file after the book title', () => {
  for (const format of EXPORT_FORMATS) {
    const result = buildTextExport(format.id, {
      settings: SETTINGS,
      chapters: [chapter()],
      t,
      locale: 'en',
    });
    assert.equal(result.filename, `my-portfolio.${format.extension}`);
    assert.equal(result.mime, format.mime);
    assert.ok(result.content.length > 0);
  }
});

test('an unknown format falls back to markdown rather than throwing', () => {
  const result = buildTextExport('nope', { settings: SETTINGS, chapters: [chapter()], t, locale: 'en' });
  assert.equal(result.filename, 'my-portfolio.md');
});

test('slugify handles umlauts, spaces and unusable input', () => {
  assert.equal(slugify('Mein Portfolio'), 'mein-portfolio');
  assert.equal(slugify('Übermäßig große Titel'), 'uebermaessig-grosse-titel');
  assert.equal(slugify('Straße'), 'strasse');
  assert.equal(slugify('Ärger im Büro'), 'aerger-im-buero');
  assert.equal(slugify('Café & Crème'), 'cafe-creme');
  // Nothing usable in, nothing usable out — `buildTextExport` applies the
  // fallback so a nameless book still downloads as something.
  assert.equal(slugify('  '), '');
  assert.equal(slugify(null), '');
});

test('a book with an unusable title still exports under a real file name', () => {
  const bare = { ...SETTINGS, customBookTitle: '!!!' };
  const result = buildTextExport('markdown', { settings: bare, chapters: [chapter()], t, locale: 'en' });
  assert.equal(result.filename, 'book.md');
});

test('a book with no chapters still exports a valid document', () => {
  assert.match(toMarkdown({ settings: SETTINGS, chapters: [], t, locale: 'en' }), /# My Portfolio/);
  const rows = csvRows(toCsv({ settings: SETTINGS, chapters: [], t, locale: 'en' }));
  assert.equal(rows.length, 1, 'header only');
});

test('exports follow the requested locale for dates', () => {
  const en = toMarkdown({ settings: SETTINGS, chapters: [chapter()], t, locale: 'en' });
  const de = toMarkdown({ settings: SETTINGS, chapters: [chapter()], t, locale: 'de' });
  assert.notEqual(en, de, 'an English and a German export should not be byte-identical');
});

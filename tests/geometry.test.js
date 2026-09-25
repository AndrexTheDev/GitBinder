/**
 * Book geometry: the stylesheet and the config must agree.
 *
 * `src/config/book.js` states the numbers the pagination maths runs on, and
 * `src/styles/book.css` / `print.css` position the very same boxes. The CSS
 * header asks for it in so many words — "Every measurement here has a
 * counterpart in `src/config/book.js`" — but nothing enforced that, and the
 * failure mode is nastier than a mismatch usually is: the layout does not
 * follow the config. Deleting a millimetre from `--book-content-h` changes how
 * much fits on a sheet, while the table of contents keeps counting page
 * numbers from the stale number, so the printed index points at the wrong
 * pages. Nothing throws and nothing looks broken; the book is just wrong.
 *
 * The duplicated values are read straight out of the stylesheets here, so
 * drift fails the build instead of the print run.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { BOOK_PAPER, BOOK_RUNNERS, BOOK_LIMITS, BOOK_WEIGHTS } from '../src/config/book.js';
import { emptyNotePlaceholder } from '../src/book/export.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

const css = read('src', 'styles', 'book.css');
const printCss = read('src', 'styles', 'print.css');

/** Read a `--custom-property` value, asserting it exists. */
function property(source, name) {
  const match = source.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  assert.ok(match, `${name} is not declared`);
  return match[1].trim();
}

/** `-14mm` → `-14`, and refuse units we do not understand. */
function millimetres(value) {
  const match = value.match(/^(-?\d+(?:\.\d+)?)mm$/);
  assert.ok(match, `expected a millimetre length, got "${value}"`);
  return Number(match[1]);
}

/* -------------------------------------------------------------------------- *
 * The sheet
 * -------------------------------------------------------------------------- */

test('@page declares the sheet the pagination maths assumes', () => {
  const page = printCss.match(/@page\s*\{([^}]*)\}/);
  assert.ok(page, 'print.css has no @page rule');

  assert.match(page[1], /size:\s*A4/);
  assert.equal(BOOK_PAPER.format, 'A4');

  // `margin: top right bottom left` — a four-value shorthand, in that order.
  const shorthand = page[1].match(/margin:\s*([^;]+);/)?.[1].trim();
  assert.ok(shorthand, 'no margin in @page');
  const values = shorthand.split(/\s+/).map(millimetres);
  assert.equal(values.length, 4, 'expected the four-value shorthand');
  const [top, right, bottom, left] = values;

  assert.equal(top, BOOK_PAPER.marginTopMm);
  assert.equal(right, BOOK_PAPER.marginXMm);
  assert.equal(bottom, BOOK_PAPER.marginBottomMm);
  assert.equal(left, BOOK_PAPER.marginXMm);
});

test('the printable box is the arithmetic every other number assumes', () => {
  // These two relations are why the constants exist at all; if the sheet size
  // or a margin changes, they are what has to keep holding.
  assert.equal(
    BOOK_PAPER.contentWidthMm,
    BOOK_PAPER.widthMm - 2 * BOOK_PAPER.marginXMm,
    'contentWidthMm is not width minus both side margins',
  );

  const printable = BOOK_PAPER.heightMm - BOOK_PAPER.marginTopMm - BOOK_PAPER.marginBottomMm;
  assert.ok(
    BOOK_PAPER.contentHeightMm < printable,
    'there is no vertical slack for a line that renders taller than predicted',
  );
  // A deliberate reserve, not a rounding leftover: tuned with BOOK_WEIGHTS so
  // a ~600-character description still pairs up. Guard it against growing into
  // wasted paper or shrinking to nothing.
  const slack = printable - BOOK_PAPER.contentHeightMm;
  assert.ok(slack >= 2 && slack <= 12, `unexpected vertical slack: ${slack} mm`);
});

/* -------------------------------------------------------------------------- *
 * CSS custom properties
 * -------------------------------------------------------------------------- */

test('the preview box matches the config', () => {
  // The on-screen preview is meant to be true A4 — "what you see is what the
  // PDF will be". If the CSS box drifts from the config, the preview lies
  // about how much fits on a page.
  assert.equal(millimetres(property(css, '--book-content-w')), BOOK_PAPER.contentWidthMm);
  assert.equal(millimetres(property(css, '--book-content-h')), BOOK_PAPER.contentHeightMm);
});

test('the running header and footer offsets match the config', () => {
  assert.equal(
    millimetres(property(css, '--book-run-head-offset')),
    BOOK_RUNNERS.headerOffsetMm,
    'the header offset drifted from BOOK_RUNNERS',
  );
  assert.equal(
    millimetres(property(css, '--book-run-foot-offset')),
    BOOK_RUNNERS.footerOffsetMm,
    'the footer offset drifted from BOOK_RUNNERS',
  );
});

test('both runners land inside the paper margin', () => {
  // The offsets are negative — the runners sit *outside* the content box, in
  // the sheet margin. Deriving their distance from the paper edge is the only
  // way to tell whether that is still on the sheet: a runner that runs off the
  // page is silently clipped by the printer, and a runner that reaches into the
  // content box collides with the text.
  const headerFromEdge = BOOK_PAPER.marginTopMm + BOOK_RUNNERS.headerOffsetMm;
  const footerFromEdge = BOOK_PAPER.marginBottomMm + BOOK_RUNNERS.footerOffsetMm;

  assert.ok(headerFromEdge > 0, 'the header runs off the top of the sheet');
  assert.ok(footerFromEdge > 0, 'the footer runs off the bottom of the sheet');

  // And inside the margin, so it never overlaps the content box.
  assert.ok(headerFromEdge < BOOK_PAPER.marginTopMm, 'the header intrudes into the content box');
  assert.ok(footerFromEdge < BOOK_PAPER.marginBottomMm, 'the footer intrudes into the content box');
});

/* -------------------------------------------------------------------------- *
 * Notes
 * -------------------------------------------------------------------------- */

test('the empty-note placeholder stays inside its ruled lines', () => {
  // The placeholder stands in for the notes the reader fills in by hand, so it
  // has to be exactly as tall as the block it replaces: one line per ruled
  // line, and never long enough to wrap onto an extra one. A wrapped line makes
  // the printed block taller than the pagination maths allowed for.
  const lines = emptyNotePlaceholder().split('\n');

  assert.equal(lines.length, BOOK_LIMITS.noteLines, 'the placeholder has the wrong number of lines');
  for (const line of lines) {
    assert.ok(line.length > 0, 'an empty placeholder line is not a ruled line');
    assert.ok(
      line.length <= BOOK_WEIGHTS.notesCharsPerLine,
      `a ${line.length}-character placeholder line wraps at ${BOOK_WEIGHTS.notesCharsPerLine} per line`,
    );
  }
});

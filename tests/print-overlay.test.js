/**
 * Screen-only UI must never reach paper.
 *
 * The print stylesheet hides `button` and `input`, which covers most
 * interactive chrome — but the panels that *contain* those controls also carry
 * plain text (a picker's project names, an export menu's file extensions), and
 * plain text is exactly what prints. These tests pin both halves of the fix:
 * the stylesheet exclusions, and the behaviour that closes the panels when the
 * print dialog opens.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createDomEnvironment } from './helpers/dom.js';
import { createMemoryStorage } from './helpers/memoryStorage.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The stylesheet source, concatenated, so `@layer` nesting does not matter. */
function stylesSource() {
  const dir = join(root, 'src', 'styles');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.css'))
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n');
}

test('every screen-only panel is excluded from print', () => {
  const css = stylesSource();

  for (const selector of [
    '.book-shell__toolbar',
    '.book-picker',
    '.book-export',
    '.modal',
    '.drawer',
    '#overlay-root',
    '#book-bar-root',
    '#navbar-root',
    '#footer-root',
  ]) {
    // Match the selector inside a comma-separated list that ends in the
    // display:none !important rule.
    const pattern = new RegExp(
      `(^|[,\\s])${selector.replace(/[.#]/g, (m) => `\\${m}`)}\\s*[,{]`,
      'm',
    );
    assert.ok(pattern.test(css), `${selector} is not excluded from print`);
  }
});

test('the exclusions sit inside an @media print block', () => {
  const css = readFileSync(join(root, 'src', 'styles', 'print.css'), 'utf8');
  const start = css.indexOf('@media print');
  assert.notEqual(start, -1, 'print.css has no @media print block');

  // Everything between the block's opening brace and its close must contain
  // the panel exclusions; a stray rule outside would apply on screen too.
  const block = css.slice(start);
  const picker = block.indexOf('.book-picker');
  assert.notEqual(picker, -1, '.book-picker excluded outside @media print');
  assert.ok(picker < block.indexOf('\n}', block.indexOf('textarea')), 'exclusion is outside the block');
});

test('the printer gets the book, not the app chrome', () => {
  const css = readFileSync(join(root, 'src', 'styles', 'print.css'), 'utf8');
  // The catalogue must stay visible — an over-eager exclusion list would
  // produce blank paper, which is worse than a stray button.
  assert.match(css, /#app,\s*\n\s*main,\s*\n\s*\.print-area\s*\{[^}]*display:\s*block\s*!important/);
  assert.match(css, /@page\s*\{[^}]*size:\s*A4/);
});

test('opening the print dialog closes the screen-only panels', async () => {
  const env = createDomEnvironment();
  const { bootstrap } = await import('../src/app.js');
  const app = bootstrap({ host: env.document, storage: createMemoryStorage() });

  const doc = env.document;
  // `.book-picker` is the panel; the toggle is its sibling inside the wrapper.
  const pickerToggle = doc.querySelector('#book-bar-root .book-picker__toggle');
  const exportToggle = doc.querySelector('#book-bar-root .book-export button[aria-haspopup]');
  assert.ok(pickerToggle, 'no picker toggle');
  assert.ok(exportToggle, 'no export toggle');

  pickerToggle.click();
  exportToggle.click();
  assert.equal(doc.querySelector('.book-picker').hidden, false, 'picker should be open');
  assert.equal(
    doc.querySelector('#book-bar-root [role=menu]').hidden,
    false,
    'export menu should be open',
  );

  // The print path refuses when the book is empty — which is exactly the
  // moment the panels are most likely to be left open, so it has to clean up
  // before it checks.
  app.components.bookPreview.print();

  assert.equal(doc.querySelector('.book-picker').hidden, true, 'picker left open across print');
  assert.equal(
    doc.querySelector('#book-bar-root [role=menu]').hidden,
    true,
    'export menu left open across print',
  );

  app.destroy();
  env.cleanup();
});

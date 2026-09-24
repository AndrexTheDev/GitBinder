/**
 * Print-stylesheet contract.
 *
 * jsdom cannot apply `@media print`, so this is not a pixel test — it is a
 * structural one. It parses the real stylesheets with the browser's own CSSOM
 * and walks every rule *inside* an `@media print` block (including rules nested
 * in `@layer`), which catches the regressions that actually happen: a rule
 * moved out of the print block, a selector dropped during a refactor, or a
 * modal class that was added to the DOM but never to the print exclusions.
 *
 * The requirement it protects is the one from the brief: the printed book must
 * contain the book, and nothing else. No modal, no button, no navbar.
 */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDomEnvironment } from './helpers/dom.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/** @type {any} */
let env;

before(() => {
  env = createDomEnvironment();
});
after(() => env?.cleanup());

/**
 * Parses a stylesheet file and returns every rule that lives inside an
 * `@media print` block, at any nesting depth (through `@layer`, for one).
 *
 * Media rules are detected structurally rather than by comparing `rule.type`
 * against `CSSRule.MEDIA_RULE`: jsdom's CSSOM does not export that constant,
 * and comparing against `undefined` silently matches nothing.
 *
 * @param {string} file  path relative to the repo root
 */
function printRules(file) {
  const css = readFileSync(resolve(root, file), 'utf8');
  const style = env.document.createElement('style');
  style.textContent = css;
  env.document.head.append(style);
  const sheet = style.sheet;

  /** @type {any[]} */
  const found = [];
  const walk = (/** @type {any[]} */ rules, /** @type {boolean} */ inPrint) => {
    for (const rule of rules) {
      // Order matters: a CSSStyleRule in jsdom carries an *empty* `cssRules`
      // collection, which is truthy, so the selector test has to come first.
      if (rule.selectorText) {
        if (inPrint) found.push(rule);
        continue;
      }

      const condition = rule.conditionText ?? rule.media?.mediaText;
      if (typeof condition === 'string') {
        // A media query (or @supports): narrow the context if it mentions print.
        walk(rule.cssRules, inPrint || /print/.test(condition));
      } else if (rule.cssRules) {
        // Grouping rule — @layer, for instance — keeps the surrounding context.
        walk(rule.cssRules, inPrint);
      }
    }
  };
  walk(/** @type {any} */ (sheet).cssRules, false);
  return found;
}

/** Every selector set to `display: none` inside a print block. */
function hiddenSelectors(files) {
  const selectors = new Set();
  for (const file of files) {
    for (const rule of printRules(file)) {
      if (rule.style?.display === 'none') {
        for (const selector of rule.selectorText.split(',')) {
          selectors.add(selector.trim());
        }
      }
    }
  }
  return selectors;
}

const PRINT_SHEETS = ['src/styles/print.css', 'src/styles/book.css'];

test('the print stylesheets parse and contain print-scoped rules', () => {
  for (const file of PRINT_SHEETS) {
    const rules = printRules(file);
    assert.ok(rules.length > 0, `${file} has no rules inside @media print`);
  }
});

/** What must never reach paper, and why. */
const EXCLUSIONS = Object.freeze({
  'app chrome': ['#navbar-root', '#footer-root', '#toast-root', '#book-bar-root', '.skip-link', '.no-print'],
  // The container, the generic shapes, and the ARIA role — three independent
  // ways to catch a dialog that would otherwise print over the book.
  modals: ['#overlay-root', '.overlay-scrim', '.modal', '.drawer', "[role='dialog']", '.tabs'],
  'interactive controls': ['button', '.btn', 'input', 'select', 'textarea'],
});

const ALL_EXCLUSIONS = Object.values(EXCLUSIONS).flat();

test('app chrome is hidden on paper', () => {
  const hidden = hiddenSelectors(PRINT_SHEETS);
  for (const selector of EXCLUSIONS['app chrome']) {
    assert.ok(hidden.has(selector), `${selector} is not hidden when printing`);
  }
});

test('modals and their backdrop are hidden, even one left open', () => {
  const hidden = hiddenSelectors(PRINT_SHEETS);
  for (const selector of EXCLUSIONS.modals) {
    assert.ok(hidden.has(selector), `${selector} is not hidden when printing`);
  }
});

test('interactive controls never reach paper', () => {
  const hidden = hiddenSelectors(PRINT_SHEETS);
  for (const selector of EXCLUSIONS['interactive controls']) {
    assert.ok(hidden.has(selector), `${selector} is not hidden when printing`);
  }
});

test('the book itself is not hidden', () => {
  // The point of the exclusions is to keep paper clean, not empty. If a future
  // edit makes the hide-list greedy, this is the test that notices.
  const hidden = hiddenSelectors(PRINT_SHEETS);
  for (const selector of ['.book', '.book-page', '.book-cover', '.book-chapter', '.book-run']) {
    assert.ok(!hidden.has(selector), `${selector} is hidden — nothing would print`);
  }
});

test('the exclusions are forced, so specificity cannot override them', () => {
  // Component rules live in unlayered sheets. Without `!important`, a later
  // `.modal { display: flex }` would win and print the dialog over the book.
  for (const file of PRINT_SHEETS) {
    for (const rule of printRules(file)) {
      if (rule.style?.display !== 'none') continue;
      const selectors = rule.selectorText.split(',').map((bit) => bit.trim());
      if (!selectors.some((selector) => ALL_EXCLUSIONS.includes(selector))) continue;

      assert.equal(
        rule.style.getPropertyPriority('display'),
        'important',
        `${rule.selectorText} hides an exclusion without !important`,
      );
    }
  }
});

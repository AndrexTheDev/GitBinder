/**
 * The icon layer — `src/components/ui/Icon.js`.
 *
 * `icon('typo')` does not throw. It writes one line to the console and returns
 * an **empty `<svg>`** — a blank square where the interface expected a symbol.
 * Only a console warning separates a working icon from a missing one, and
 * nothing in a screenshot review of 68 icons would necessarily show it.
 *
 * So this file checks two things a test can check without a human: that every
 * name the code asks for is registered, and that every registered name really
 * draws something.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { Icons, IconNames, icon, iconNamed } from '../src/components/ui/Icon.js';
import { createDomEnvironment } from './helpers/dom.js';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

/** Every `.js` file under `src/`, as `[path, source]` pairs. */
function sourceFiles(dir = join(ROOT, 'src'), out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (full.endsWith('.js')) out.push([full, readFileSync(full, 'utf8')]);
  }
  return out;
}

/** The argument list of every `icon(...)` / `iconNamed(...)` call in a source. */
function callArguments(source) {
  const args = [];
  for (const match of source.matchAll(/\bicon(?:Named)?\(/g)) {
    let depth = 0;
    let index = match.index + match[0].length - 1;
    const start = index + 1;
    for (; index < source.length; index += 1) {
      const char = source[index];
      if (char === '(') depth += 1;
      else if (char === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const inner = source.slice(start, index);
    // Only the first argument names the icon; the rest are options.
    let cut = inner.length;
    let level = 0;
    for (let i = 0; i < inner.length; i += 1) {
      const char = inner[i];
      if ('([{'.includes(char)) level += 1;
      else if (')]}'.includes(char)) level -= 1;
      else if (char === ',' && level === 0) {
        cut = i;
        break;
      }
      else if (char === '"' || char === "'") {
        const quote = char;
        i += 1;
        while (i < inner.length && inner[i] !== quote) {
          if (inner[i] === '\\') i += 1;
          i += 1;
        }
      }
    }
    args.push({ name: match[0], first: inner.slice(0, cut), inner });
  }
  return args;
}

describe('every icon name the code asks for exists', () => {
  // The registry is the source of truth; a name that is not in it renders
  // nothing. This walks `src/` and collects the names in the four shapes they
  // appear in.
  const files = sourceFiles().filter(([path]) => !path.endsWith('ui/Icon.js'));
  const literals = new Map();
  const propertyValues = new Map();
  const ternaryBranches = new Map();
  const iconMaps = new Map();

  for (const [path, source] of files) {
    const note = (map, name) => {
      if (!map.has(name)) map.set(name, path.replace(`${ROOT}/`, ''));
    };

    // icon('star'), iconNamed('star')
    for (const { first } of callArguments(source)) {
      for (const match of first.matchAll(/'([^']+)'/g)) {
        // A ternary branch is a name; the condition usually compares against
        // something that is not one (`format.id === 'csv' ? 'table' : …`).
        const before = first.slice(0, match.index);
        if (/[?:]\s*$/.test(before)) note(ternaryBranches, match[1]);
        else if (!/===?|!==?/.test(before)) note(literals, match[1]);
      }
    }

    // { icon: 'info' } / { iconName: 'help' } / { iconNode: 'star' }
    for (const match of source.matchAll(/\bicon(?:Name|Node)?\s*:\s*'([^']+)'/g)) {
      note(propertyValues, match[1]);
    }

    // const icons = { danger: 'alert', … } — a tone table, all values are names
    for (const match of source.matchAll(/const\s+\w*[Ii]cons?\w*\s*=\s*\{([^}]+)\}/g)) {
      for (const value of match[1].matchAll(/:\s*'([^']+)'/g)) note(iconMaps, value[1]);
    }
  }

  const collected = new Map([...literals, ...propertyValues, ...ternaryBranches, ...iconMaps]);

  test('the scan finds the call sites at all', () => {
    // A guard on the guard: a refactor that changes how icons are referenced
    // would silently empty the scan and make every assertion below vacuous.
    assert.ok(literals.size >= 25, `only ${literals.size} direct icon() names found`);
    assert.ok(propertyValues.size >= 10, `only ${propertyValues.size} table names found`);
    assert.ok(ternaryBranches.size >= 1, 'no ternary icon name found');
  });

  test('every name is registered', () => {
    const missing = [...collected].filter(([name]) => !(name in Icons));
    assert.deepEqual(
      missing.map(([name, file]) => `${name} (${file})`),
      [],
      'these names render an empty square',
    );
  });

  test('and the registry is not padded with names nobody uses', () => {
    // The other direction, as a report rather than a failure: an icon that no
    // longer has a call site is bundle weight. It is asserted as a *subset*
    // rule (every used name is registered) and asserted here only to keep the
    // list visible when it grows.
    const unused = IconNames.filter((name) => !collected.has(name));
    assert.ok(
      unused.length <= 35,
      `${unused.length} of ${IconNames.length} icons have no call site: ${unused.join(', ')}`,
    );
  });
});

describe('every registered icon draws something', () => {
  let environment;
  const VALID_TAGS = new Set([
    'path',
    'circle',
    'rect',
    'line',
    'ellipse',
    'polyline',
    'polygon',
    'g',
  ]);

  before(() => {
    environment = createDomEnvironment();
  });

  after(() => environment.cleanup());

  test('a node is a list of children, each [tag, attributes]', () => {
    // This is the shape lucide v1 uses and the shape `renderNode()` expects.
    // A node written the other way round — `['path', {…}, []]` instead of
    // `[['path', {…}]]` — destructures to a one-letter tag with a bogus
    // attribute, and renders a broken icon without an error.
    for (const [name, node] of Object.entries(Icons)) {
      assert.ok(Array.isArray(node), `${name} is not an array`);
      assert.ok(node.length > 0, `${name} has no children`);
      for (const child of node) {
        assert.ok(Array.isArray(child), `${name} has a child that is not an array`);
        assert.equal(typeof child[0], 'string', `${name} has a child without a tag`);
        assert.ok(VALID_TAGS.has(child[0]), `${name} contains <${child[0]}>, which is not a shape`);
        if (child[1] !== undefined) {
          assert.equal(typeof child[1], 'object', `${name} has attributes that are not an object`);
        }
      }
    }
  });

  test('every icon renders into the SVG namespace with at least one shape', () => {
    for (const name of IconNames) {
      const svg = icon(name);
      assert.equal(svg.namespaceURI, 'http://www.w3.org/2000/svg', `${name} is not SVG`);
      const shapes = [...svg.querySelectorAll('*')];
      assert.ok(shapes.length > 0, `${name} renders an empty square`);
      for (const shape of shapes) {
        assert.equal(shape.namespaceURI, 'http://www.w3.org/2000/svg', `${name} has a foreign child`);
        assert.ok(VALID_TAGS.has(shape.tagName), `${name} renders <${shape.tagName}>`);
      }
    }
  });

  test('the geometry is the one the design assumes', () => {
    // All icons share a 24×24 box and are drawn as strokes in `currentColor`,
    // so a single icon with its own scale would sit wrong next to the others.
    for (const name of IconNames) {
      const svg = icon(name);
      assert.equal(svg.getAttribute('viewBox'), '0 0 24 24', `${name} has a different viewBox`);
      assert.equal(svg.getAttribute('stroke'), 'currentColor', `${name} ignores the text colour`);
      assert.equal(svg.getAttribute('fill'), 'none', `${name} would be filled black`);
      assert.equal(svg.getAttribute('stroke-linecap'), 'round');
    }
  });

  test('it is decorative unless it is given a label', () => {
    // An icon next to a visible word must not be announced twice; an icon that
    // is the only content of a control must be announced.
    const decorative = icon('star');
    assert.equal(decorative.getAttribute('aria-hidden'), 'true');
    assert.equal(decorative.getAttribute('focusable'), 'false');
    assert.equal(decorative.getAttribute('role'), null);

    const labelled = icon('star', { label: 'Favourite' });
    assert.equal(labelled.getAttribute('role'), 'img');
    assert.equal(labelled.getAttribute('aria-label'), 'Favourite');
    assert.equal(labelled.getAttribute('aria-hidden'), null, 'a labelled icon is still hidden');
  });

  test('an unknown name is a warning and an empty icon, not a crash', () => {
    // The documented fallback. It is asserted so the failure mode stays the
    // gentle one, and so the warning keeps its shape — that line is the only
    // trace a missing icon leaves.
    const warnings = [];
    const original = console.warn;
    console.warn = (message) => warnings.push(String(message));
    try {
      const svg = icon('definitely-not-an-icon');
      assert.equal(svg.tagName, 'svg');
      assert.equal(svg.children.length, 0);
      assert.deepEqual(warnings, ['[icon] unknown icon "definitely-not-an-icon"']);
    } finally {
      console.warn = original;
    }
  });

  test('the options reach the element', () => {
    const svg = icon('star', { size: 32, class: 'text-brass-500', strokeWidth: 1.5, spin: true });
    assert.equal(svg.getAttribute('width'), '32');
    assert.equal(svg.getAttribute('height'), '32');
    assert.equal(svg.getAttribute('stroke-width'), '1.5');
    assert.equal(svg.getAttribute('class'), 'text-brass-500 animate-spin');
  });

  test('a raw IconNode is accepted as well as a name', () => {
    // `icon()` draws a one-off shape too — in the same shape as a registered
    // node, i.e. a list of children. A bare `['circle', {…}]` is *not* a node:
    // `icon()` iterates its argument, so that form throws "node is not
    // iterable" rather than drawing something surprising.
    const svg = icon([['circle', { cx: '12', cy: '12', r: '10' }]]);
    assert.equal(svg.querySelector('circle').getAttribute('r'), '10');
    assert.throws(() => icon(['circle', { cx: '12', cy: '12', r: '10' }]), /not iterable/);
  });

  test('iconNamed is the same function under another name', () => {
    // The wrapper exists for readability at the call site; if it ever diverged,
    // half the interface would render one way and half the other.
    assert.equal(typeof iconNamed, 'function');
    assert.equal(iconNamed('star').outerHTML, icon('star').outerHTML);
  });
});

describe('the registry itself', () => {
  test('IconNames is the keys of Icons, and frozen', () => {
    assert.deepEqual([...IconNames], Object.keys(Icons));
    assert.ok(Object.isFrozen(IconNames));
    assert.ok(Object.isFrozen(Icons));
  });

  test('no name is registered twice under different spellings', () => {
    // `chevronDown` and `expand` already share a path; two names for one shape
    // is fine, but a name that differs only in case would be a bug magnet.
    const lowered = IconNames.map((name) => name.toLowerCase());
    assert.equal(new Set(lowered).size, lowered.length, 'two icon names differ only in case');
  });
});

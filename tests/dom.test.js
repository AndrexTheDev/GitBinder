/**
 * Micro DOM layer — `src/core/dom.js`.
 *
 * Every component is built out of these helpers, so a wrong assumption here is
 * wrong in fifty places at once. Two of them have already cost real bugs in this
 * project: `hidden: ''` does not hide an element (it is a DOM *property*, and
 * `''` coerces to false), and `setText()` on an element that contains other
 * elements deletes them. Both are pinned below, as behaviour rather than as
 * folklore, so the next person meets them here and not in a browser.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createDomEnvironment } from './helpers/dom.js';
import {
  FOCUSABLE,
  append,
  clear,
  focusFirst,
  fragment,
  h,
  mount,
  on,
  qs,
  qsa,
  setAttr,
  setInputValue,
  setText,
} from '../src/core/dom.js';

/** @type {any} */
let env;
/** @type {Document} */
let doc;

before(() => {
  env = createDomEnvironment();
  doc = env.document;
});

after(() => {
  env.cleanup();
});

/* -------------------------------------------------------------------------- *
 * h()
 * -------------------------------------------------------------------------- */

describe('h()', () => {
  test('builds an element with attributes and children', () => {
    const el = h('button', { class: 'btn', type: 'button' }, 'Save');

    assert.equal(el.tagName, 'BUTTON');
    assert.equal(el.className, 'btn');
    assert.equal(el.getAttribute('type'), 'button');
    assert.equal(el.textContent, 'Save');
  });

  test('props can be omitted entirely', () => {
    assert.equal(h('p', 'hello').textContent, 'hello');
    assert.equal(h('p').textContent, '');
    assert.equal(h('p', 'a', 'b').textContent, 'ab');
  });

  test('a single node or array can stand in for props', () => {
    const child = h('span', 'x');
    assert.equal(h('p', child).firstChild, child);
    assert.equal(h('p', [child, 'tail']).textContent, 'xtail');
  });

  test('children are flattened, and nullish or boolean ones are skipped', () => {
    // `t('…') && h(…)` and `condition ? el : null` are everywhere in the
    // components; a `false` child must not become the text "false".
    const el = h('div', null, 'a', null, undefined, false, true, [['b'], 'c'], 0);

    assert.equal(el.textContent, 'abc0');
  });

  test('numbers become text, not attributes', () => {
    assert.equal(h('span', 42).textContent, '42');
    assert.equal(typeof h('span', 42).textContent, 'string');
  });

  test('text: and html: are different roads', () => {
    const asText = h('p', { text: '<b>bold</b>' });
    const asHtml = h('p', { html: '<b>bold</b>' });

    assert.equal(asText.textContent, '<b>bold</b>');
    assert.equal(asText.children.length, 0, 'text: parsed markup');
    assert.equal(asHtml.children.length, 1, 'html: did not parse markup');
    assert.equal(asHtml.querySelector('b').textContent, 'bold');
  });

  test('class accepts a string, an array, a Set and a condition object', () => {
    assert.equal(h('i', { class: 'a b' }).className, 'a b');
    assert.equal(h('i', { class: ['a', false, 'b', null] }).className, 'a b');
    assert.equal(h('i', { class: new Set(['a', 'b']) }).className, 'a b');
    assert.equal(
      h('i', { class: { a: true, b: false, c: 1 } }).className,
      'a c',
      'the condition object included an inactive class',
    );
  });

  test('an absent or false class leaves the element class-less', () => {
    assert.equal(h('i', { class: null }).className, '');
    assert.equal(h('i', { class: false }).className, '');
    assert.equal(h('i', {}).className, '');
  });

  test('style accepts a string and an object, and null removes a property', () => {
    assert.equal(h('i', { style: 'color: red' }).getAttribute('style'), 'color: red');

    const el = h('i', { style: { color: 'red', display: null, margin: false } });
    assert.equal(el.style.color, 'red');
    assert.equal(el.style.display, '', 'a null value was written as the text "null"');
    assert.equal(el.style.margin, '');
  });

  test('dataset entries become data- attributes', () => {
    const el = h('i', { dataset: { format: 'csv', index: 3 } });
    assert.equal(el.dataset.format, 'csv');
    assert.equal(el.getAttribute('data-index'), '3');
  });

  test('ref hands the element to the caller', () => {
    let captured = null;
    const el = h('i', { ref: (node) => (captured = node) });
    assert.equal(captured, el);
  });

  test('a true value writes an empty attribute, a false one removes it', () => {
    assert.equal(h('i', { draggable: true }).getAttribute('draggable'), '');
    assert.equal(h('i', { draggable: false }).hasAttribute('draggable'), false);
    assert.equal(h('i', { draggable: null }).hasAttribute('draggable'), false);
    assert.equal(h('i', { 'aria-hidden': 'true' }).getAttribute('aria-hidden'), 'true');
  });

  test('DOM properties are assigned as properties, not attributes', () => {
    // `value`, `checked`, `disabled` and friends do not round-trip through
    // setAttribute: a checkbox set via `setAttribute('checked', ...)` looks
    // ticked in the HTML and reports `checked === false`.
    const input = h('input', { type: 'checkbox', checked: true, disabled: true, value: 'x' });
    assert.equal(input.checked, true);
    assert.equal(input.disabled, true);
    assert.equal(input.value, 'x');

    const off = h('input', { type: 'checkbox', checked: false });
    assert.equal(off.checked, false);
    assert.equal(off.hasAttribute('checked'), false);
  });

  test('hidden: true hides, hidden: false shows — and the string "" does not', () => {
    // The trap. `hidden` is a property, `el.hidden = ''` is falsy, and the
    // element stays on screen. `BookPreview` carries a comment about exactly
    // this. Use `true`/`false`; if a test ever starts failing here, the
    // workarounds at the call sites are what changed.
    assert.equal(h('div', { hidden: true }).hidden, true);
    assert.equal(h('div', { hidden: false }).hidden, false);
    assert.equal(h('div', { hidden: '' }).hidden, false, 'the documented trap changed behaviour');

    // `setAttr` is the attribute-driven alternative, and it does what you mean.
    const el = h('div', {});
    setAttr(el, 'hidden', true);
    assert.equal(el.hasAttribute('hidden'), true);
  });

  test('event handlers attach, and an object form attaches several at once', () => {
    const clicks = [];
    const button = h('button', { onClick: () => clicks.push('one') }, 'x');
    button.click();
    assert.deepEqual(clicks, ['one']);

    const box = h('input', {
      on: { focus: () => clicks.push('focus'), blur: () => clicks.push('blur') },
    });
    box.dispatchEvent(new env.window.Event('focus'));
    box.dispatchEvent(new env.window.Event('blur'));
    assert.deepEqual(clicks, ['one', 'focus', 'blur']);
  });

  test('an element is built into a document that can render it', () => {
    const el = h('div', { class: 'probe' }, h('span', 'deep'));
    doc.body.append(el);

    assert.equal(doc.querySelector('.probe span').textContent, 'deep');
    el.remove();
  });
});

/* -------------------------------------------------------------------------- *
 * append / fragment / clear / mount
 * -------------------------------------------------------------------------- */

describe('tree helpers', () => {
  test('append returns the parent and skips nothing useful', () => {
    const parent = h('div');
    assert.equal(append(parent, 'a', null, false, ['b', undefined]), parent);
    assert.equal(parent.textContent, 'ab');
  });

  test('append accepts an existing node without cloning it', () => {
    const child = h('span', 'x');
    const parent = h('div');
    append(parent, child);
    assert.equal(parent.firstChild, child);
  });

  test('fragment collects children without a wrapper element', () => {
    const frag = fragment(h('li', 'one'), h('li', 'two'));
    assert.equal(frag.nodeType, 11, 'a fragment is expected here');
    assert.equal(frag.childNodes.length, 2);
  });

  test('clear empties an element and returns it', () => {
    const el = h('div', null, 'a', h('span', 'b'));
    assert.equal(clear(el), el);
    assert.equal(el.childNodes.length, 0);
    assert.equal(el.tagName, 'DIV', 'clear removed the element itself');
  });

  test('clear survives null and an empty element', () => {
    assert.equal(clear(null), null);
    assert.doesNotThrow(() => clear(h('div')));
  });

  test('mount replaces everything and returns the root', () => {
    // Used for whole-list re-renders: the old children must go, not pile up.
    const root = h('div', null, 'old', h('span', 'older'));
    const fresh = h('b', 'new');

    assert.equal(mount(root, fresh), root);
    assert.equal(root.childNodes.length, 1);
    assert.equal(root.firstChild, fresh);
    assert.equal(root.textContent, 'new');
  });

  test('mount with no children empties the root', () => {
    const root = h('div', null, 'old');
    mount(root);
    assert.equal(root.childNodes.length, 0);
  });
});

/* -------------------------------------------------------------------------- *
 * on()
 * -------------------------------------------------------------------------- */

describe('on()', () => {
  test('a plain listener is added and its disposer removes it', () => {
    const el = h('button');
    let calls = 0;
    const off = on(el, 'click', () => (calls += 1));

    el.click();
    off();
    el.click();

    assert.equal(calls, 1);
  });

  test('a delegated listener fires for a match anywhere inside', () => {
    const list = h('ul', null, h('li', { 'data-id': 'a' }, h('span', 'deep')));
    const seen = [];

    on(list, 'click', 'li', (event, match) => seen.push(match.dataset.id));
    list.querySelector('span').click();

    assert.deepEqual(seen, ['a'], 'a click on a nested child did not resolve to the row');
  });

  test('a delegated listener ignores clicks outside the selector', () => {
    const list = h('ul', null, h('li', { 'data-id': 'a' }), h('div', 'other'));
    const seen = [];
    on(list, 'click', 'li', (_event, match) => seen.push(match.dataset.id));

    list.querySelector('div').click();
    assert.deepEqual(seen, []);
  });

  test('a delegated listener ignores a match outside its own subtree', () => {
    // The guard is `target.contains(match)`: a row inside a *different* list
    // element must not be routed here, which is what would happen if the
    // listener were attached to the document.
    const list = h('ul');
    const outside = h('li', { 'data-id': 'outside' });
    doc.body.append(list, outside);

    const seen = [];
    on(list, 'click', 'li', (_event, match) => seen.push(match.dataset.id));
    outside.click();

    assert.deepEqual(seen, []);
    list.remove();
    outside.remove();
  });

  test('disposing a delegated listener stops it', () => {
    const list = h('ul', null, h('li', { 'data-id': 'a' }));
    let calls = 0;
    const off = on(list, 'click', 'li', () => (calls += 1));

    list.querySelector('li').click();
    off();
    list.querySelector('li').click();

    assert.equal(calls, 1);
  });

  test('a null target is tolerated and returns a usable disposer', () => {
    // Components subscribe before/after mounting; a disposer that throws would
    // take down `destroy()`.
    let off;
    assert.doesNotThrow(() => (off = on(null, 'click', () => {})));
    assert.doesNotThrow(() => off());
  });
});

/* -------------------------------------------------------------------------- *
 * qs / qsa
 * -------------------------------------------------------------------------- */

describe('qs() and qsa()', () => {
  test('qsa returns a real array, not a NodeList', () => {
    const root = h('div', null, h('i'), h('i'));
    const found = qsa('i', root);

    assert.equal(Array.isArray(found), true, 'a NodeList lacks map/filter');
    assert.equal(found.length, 2);
  });

  test('both search inside the given root, not the document', () => {
    const root = h('div', null, h('i', { id: 'inside' }));
    doc.body.append(h('i', { id: 'outside' }), root);

    assert.ok(qs('#inside', root));
    assert.equal(qs('#outside', root), null, 'the search escaped its root');
    assert.ok(qs('#outside'));

    root.remove();
    doc.getElementById('outside')?.remove();
  });

  test('a miss is null and an empty array', () => {
    assert.equal(qs('.nothing-here'), null);
    assert.deepEqual(qsa('.nothing-here'), []);
  });
});

/* -------------------------------------------------------------------------- *
 * setInputValue / setText / setAttr
 * -------------------------------------------------------------------------- */

describe('setInputValue()', () => {
  test('writes a value and coerces nullish to an empty string', () => {
    const input = h('input');
    setInputValue(input, 'hello');
    assert.equal(input.value, 'hello');

    setInputValue(input, null);
    assert.equal(input.value, '');
    setInputValue(input, undefined);
    assert.equal(input.value, '');
  });

  test('numbers become strings', () => {
    const input = h('input');
    setInputValue(input, 7);
    assert.equal(input.value, '7');
  });

  test('it refuses to overwrite the field the visitor is typing in', () => {
    // This is the guard that keeps a background store update from moving the
    // caret to the end of the line mid-word.
    doc.body.append(h('div', { id: 'host' }));
    const host = doc.getElementById('host');
    const input = h('input', { value: 'typed by a human' });
    host.append(input);
    input.focus();

    assert.equal(doc.activeElement, input, 'the field could not be focused at all');
    setInputValue(input, 'from the store');
    assert.equal(input.value, 'typed by a human');

    input.blur();
    setInputValue(input, 'from the store');
    assert.equal(input.value, 'from the store', 'the guard stayed on after blur');

    host.remove();
  });

  test('a value that already matches is not written again', () => {
    const input = h('input', { value: 'same' });
    let writes = 0;
    const original = Object.getOwnPropertyDescriptor(env.window.HTMLInputElement.prototype, 'value');
    Object.defineProperty(input, 'value', {
      get: () => original.get.call(input),
      set: (next) => {
        writes += 1;
        original.set.call(input, next);
      },
      configurable: true,
    });

    setInputValue(input, 'same');
    assert.equal(writes, 0, 'an unchanged value was written into the field');

    setInputValue(input, 'different');
    assert.equal(writes, 1);
  });

  test('a missing element is a no-op', () => {
    assert.doesNotThrow(() => setInputValue(null, 'x'));
  });
});

describe('setText()', () => {
  test('writes text and coerces nullish to empty', () => {
    const el = h('span', 'old');
    setText(el, 'new');
    assert.equal(el.textContent, 'new');

    setText(el, null);
    assert.equal(el.textContent, '');
    setText(el, 5);
    assert.equal(el.textContent, '5');
  });

  test('an unchanged value leaves the existing text node in place', () => {
    // Text identity matters because replacing the node re-runs layout; this is
    // the "avoid layout thrash" promise in the doc comment.
    const el = h('span', 'same');
    const node = el.firstChild;

    setText(el, 'same');
    assert.equal(el.firstChild, node, 'the text node was replaced with an equal one');

    setText(el, 'other');
    assert.equal(el.firstChild.textContent, 'other');
  });

  test('it replaces children, so it must only target text hosts', () => {
    // The same failure mode that removed the "Hide forks" checkbox: a text
    // write to an element that holds other elements deletes them. This test is
    // here so the contract is written down where the next person will look.
    const el = h('span', null, h('b', 'bold'), 'plain');
    setText(el, 'replacement');

    assert.equal(el.children.length, 0, 'the assumption changed: setText stopped clobbering');
    assert.equal(el.textContent, 'replacement');
  });

  test('a missing element is a no-op', () => {
    assert.doesNotThrow(() => setText(null, 'x'));
  });
});

describe('setAttr()', () => {
  test('true writes an empty attribute, null and false remove it', () => {
    const el = h('div');

    setAttr(el, 'hidden', true);
    assert.equal(el.getAttribute('hidden'), '');
    setAttr(el, 'hidden', false);
    assert.equal(el.hasAttribute('hidden'), false);
    setAttr(el, 'hidden', true);
    setAttr(el, 'hidden', null);
    assert.equal(el.hasAttribute('hidden'), false);
  });

  test('strings and numbers are written as text', () => {
    const el = h('div');
    setAttr(el, 'data-count', 4);
    assert.equal(el.getAttribute('data-count'), '4');
    setAttr(el, 'tabindex', '-1');
    assert.equal(el.getAttribute('tabindex'), '-1');
  });

  test('an unchanged value does not touch the DOM', () => {
    // `syncChrome()` runs on every store change, so a write per call would be a
    // mutation record per keystroke.
    const el = h('div', { 'aria-pressed': 'true' });
    const changes = [];
    const observer = new env.window.MutationObserver((records) => {
      for (const record of records) changes.push(record.attributeName);
    });
    observer.observe(el, { attributes: true });

    setAttr(el, 'aria-pressed', 'true');
    setAttr(el, 'aria-pressed', 'true');

    observer.takeRecords().forEach((record) => changes.push(record.attributeName));
    assert.deepEqual(changes, [], 'an unchanged attribute was written anyway');

    setAttr(el, 'aria-pressed', 'false');
    observer.takeRecords().forEach((record) => changes.push(record.attributeName));
    assert.deepEqual(changes, ['aria-pressed']);

    observer.disconnect();
  });

  test('a missing element is a no-op', () => {
    assert.doesNotThrow(() => setAttr(null, 'hidden', true));
  });
});

/* -------------------------------------------------------------------------- *
 * Focus
 * -------------------------------------------------------------------------- */

describe('focusFirst()', () => {
  test('the focusable selector covers the interactive elements the UI uses', () => {
    const host = h(
      'div',
      null,
      h('button', { type: 'button' }, 'a'),
      h('a', { href: '#' }, 'b'),
      h('input', { type: 'text' }),
      h('select'),
      h('textarea'),
      h('div', { tabindex: '0' }),
    );
    host.querySelectorAll(FOCUSABLE).forEach((el) => assert.ok(el));

    assert.equal(qsa(FOCUSABLE, host).length, 6);
  });

  test('it skips a disabled control and a hidden input', () => {
    const host = h(
      'div',
      null,
      h('button', { type: 'button', disabled: true }, 'no'),
      h('input', { type: 'hidden' }),
      h('a', { href: '#' }, 'yes'),
    );

    assert.equal(focusFirst(host), host.querySelector('a'), 'focus landed on an unusable element');
  });

  test('it skips an element explicitly taken out of the tab order', () => {
    const host = h('div', null, h('div', { tabindex: '-1', id: 'first' }), h('button', {}, 'second'));
    assert.equal(focusFirst(host).tagName, 'BUTTON');
  });

  test('an empty container takes focus itself, and becomes focusable to do it', () => {
    // A dialog with no controls still has to receive focus, or Escape and the
    // screen reader both lose the thread. The container has to be in the
    // document for that: an unattached element cannot hold focus at all.
    const host = h('div');
    doc.body.append(host);
    const result = focusFirst(host);

    assert.equal(result, host);
    assert.equal(host.getAttribute('tabindex'), '-1');
    assert.equal(doc.activeElement, host);

    host.remove();
  });

  test('an existing tabindex is not overwritten by the fallback', () => {
    const host = h('div', { tabindex: '0' });
    focusFirst(host);
    assert.equal(host.getAttribute('tabindex'), '0');
  });

  test('the fallback can be switched off', () => {
    const host = h('div');
    assert.equal(focusFirst(host, { fallbackToContainer: false }), null);
    assert.equal(host.hasAttribute('tabindex'), false, 'the container was still made focusable');
  });

  test('the first match in document order wins', () => {
    const host = h('div', null, h('button', { id: 'one' }, '1'), h('button', { id: 'two' }, '2'));
    assert.equal(focusFirst(host).id, 'one');
  });
});

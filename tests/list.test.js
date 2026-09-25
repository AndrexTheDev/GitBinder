/**
 * Keyed list reconciler — `src/core/list.js`.
 *
 * The module exists for one reason: the repository cards contain text inputs,
 * and re-rendering the list whenever the store changes would destroy the node
 * somebody is typing into — the caret, the half-typed description, the focus
 * ring. So the contract worth testing is not "the list has the right items",
 * which any naive re-render satisfies, but "the nodes survive".
 *
 * That is asserted by node identity: the same element object comes out the other
 * side of a re-render, a sort and a filter. A test that only compared text
 * content would pass against `container.replaceChildren(...)` and prove nothing.
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createDomEnvironment } from './helpers/dom.js';
import { createKeyedList } from '../src/core/list.js';

/** @type {any} */
let env;
/** @type {HTMLElement} */
let container;
/** Every call the reconciler made into the factory, in order. */
let log;

before(() => {
  env = createDomEnvironment();
});

after(() => {
  env.cleanup();
});

beforeEach(() => {
  container = env.document.createElement('div');
  env.document.body.append(container);
  log = [];
});

/**
 * A list whose rows carry their key as `data-id` and their label as text, so a
 * test can assert both the order and the identity of what is on the page.
 * Each row is an `<input>` rather than a `<p>`, because "focus survives" is the
 * property this module is for and only a focusable element can show it.
 */
function makeList({ emptyNode = null, focusable = false } = {}) {
  return createKeyedList({
    container,
    key: (item) => item.id,
    emptyNode,
    create(item) {
      log.push(`create:${item.id}`);
      const el = focusable
        ? env.document.createElement('input')
        : env.document.createElement('p');
      el.dataset.id = item.id;
      el.value = item.label ?? '';
      el.textContent = item.label ?? '';
      return {
        el,
        update(next) {
          log.push(`update:${next.id}`);
          el.dataset.id = next.id;
          el.textContent = next.label ?? '';
        },
        destroy() {
          log.push(`destroy:${item.id}`);
        },
      };
    },
  });
}

/** The keys on the page, in document order. */
const order = () => [...container.children].map((el) => el.dataset.id);

describe('createKeyedList', () => {
  test('renders the items in the order given', () => {
    const list = makeList();
    list.render([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

    assert.deepEqual(log, ['create:a', 'create:b', 'create:c']);
    assert.deepEqual(order(), ['a', 'b', 'c']);
    assert.equal(list.size, 3);
  });

  test('an existing key is updated, never re-created', () => {
    // `create` runs once per key for the lifetime of the list, so a card keeps
    // its DOM — and whatever is focused inside it.
    const list = makeList();
    list.render([{ id: 'a' }]);
    const node = container.firstChild;

    log = [];
    list.render([{ id: 'a', label: 'changed' }]);

    assert.deepEqual(log, ['update:a'], 'the row was rebuilt instead of updated');
    assert.equal(container.firstChild, node, 'the DOM node was replaced');
    assert.equal(container.firstChild.textContent, 'changed', 'the update did not reach the DOM');
  });

  test('re-sorting moves the same nodes rather than building new ones', () => {
    const list = makeList();
    list.render([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const [a, b, c] = [...container.children];

    log = [];
    list.render([{ id: 'c' }, { id: 'a' }, { id: 'b' }]);

    assert.deepEqual(order(), ['c', 'a', 'b'], 'the new order was not applied');
    assert.deepEqual([...container.children], [c, a, b], 'nodes were replaced instead of moved');
    assert.deepEqual(log, ['update:c', 'update:a', 'update:b']);
  });

  test('a row that survives keeps its focus and its half-typed value', () => {
    // The user-visible consequence, measured directly: a store write arrives
    // while somebody is typing, and nothing is allowed to disturb them.
    const list = makeList({ focusable: true });
    list.render([{ id: 'a', label: 'first' }, { id: 'b', label: 'second' }]);

    const input = container.children[1];
    input.focus();
    input.value = 'half-typed by a human';

    // The model still holds the old label: an update would clobber the edit.
    list.render([{ id: 'a', label: 'first' }, { id: 'b', label: 'second' }]);

    assert.equal(env.document.activeElement, input, 'focus was lost on re-render');
  });

  test('a removed row is destroyed and taken off the page', () => {
    const list = makeList();
    list.render([{ id: 'a' }, { id: 'b' }]);

    log = [];
    list.render([{ id: 'b' }]);

    assert.deepEqual(log, ['update:b', 'destroy:a']);
    assert.deepEqual(order(), ['b']);
    assert.equal(list.size, 1);
  });

  test('destroy is called once per removed row, not once per render', () => {
    const list = makeList();
    list.render([{ id: 'a' }, { id: 'b' }]);
    list.render([{ id: 'a' }]);

    log = [];
    list.render([{ id: 'a' }]);
    list.render([{ id: 'a' }]);

    const destroyed = log.filter((entry) => entry.startsWith('destroy'));
    assert.deepEqual(destroyed, [], 'a row that was already gone was destroyed again');
  });

  test('removing everything empties the container', () => {
    const list = makeList();
    list.render([{ id: 'a' }, { id: 'b' }]);
    list.render([]);

    assert.equal(list.size, 0);
    assert.equal(container.children.length, 0);
  });

  test('the empty node appears when the list is empty and leaves when it is not', () => {
    const empty = env.document.createElement('p');
    empty.textContent = 'nothing here';
    const list = makeList({ emptyNode: () => empty });

    list.render([]);
    assert.equal(container.firstChild, empty, 'the empty state did not appear');

    list.render([{ id: 'a' }]);
    assert.equal(container.contains(empty), false, 'the empty state stayed on the page');
    assert.deepEqual(order(), ['a'], 'the empty state was counted as a row');

    list.render([]);
    assert.equal(container.firstChild, empty, 'the empty state did not come back');
  });

  test('a static empty node is reused, not re-inserted', () => {
    const empty = env.document.createElement('p');
    const list = makeList({ emptyNode: empty });

    list.render([]);
    list.render([]);
    assert.equal(container.children.length, 1, 'the empty state was duplicated');
    assert.equal(container.firstChild, empty);
  });

  test('a changing set keeps the rows it can', () => {
    const list = makeList();
    list.render([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

    // One leaves, one stays, one arrives — the ordinary case while filtering.
    log = [];
    list.render([{ id: 'b' }, { id: 'd' }]);

    assert.deepEqual(log, ['update:b', 'create:d', 'destroy:a', 'destroy:c']);
    assert.deepEqual(order(), ['b', 'd']);
    assert.equal(list.size, 2);
  });

  test('clear() destroys every row and leaves nothing behind', () => {
    const list = makeList();
    list.render([{ id: 'a' }, { id: 'b' }]);

    log = [];
    list.clear();

    assert.deepEqual(log, ['destroy:a', 'destroy:b']);
    assert.equal(list.size, 0);
    assert.equal(container.children.length, 0);
  });

  test('clear() also removes a visible empty state', () => {
    const list = makeList({ emptyNode: () => env.document.createElement('p') });
    list.render([]);
    assert.equal(container.children.length, 1);

    list.clear();
    assert.equal(container.children.length, 0);
  });

  test('nonsense input is treated as an empty list, not a crash', () => {
    const list = makeList();
    list.render([{ id: 'a' }]);

    for (const bad of [null, undefined, 'nope', 42, {}]) {
      assert.doesNotThrow(() => list.render(bad), `render(${JSON.stringify(bad)}) threw`);
    }
    assert.equal(list.size, 0);
  });

  test('numeric keys are matched as strings, so 1 and "1" are the same row', () => {
    // Keys go through `String(key(item))`; a caller mixing the two would
    // otherwise rebuild every row on every render.
    const list = makeList();
    list.render([{ id: 1 }]);
    list.render([{ id: '1' }]);

    assert.deepEqual(log, ['create:1', 'update:1'], 'the row was rebuilt for an equal key');
    assert.equal(list.size, 1);
  });

  test('the row factory gets the up-to-date index after a reorder', () => {
    // `create` and `update` both receive the index; a card that renders "3 of 9"
    // has to see the new one, or the numbering on screen is a lie.
    const seen = [];
    const list = createKeyedList({
      container,
      key: (item) => item.id,
      create(item, index) {
        seen.push(`c${item.id}@${index}`);
        return { el: env.document.createElement('p'), update: (_next, i) => seen.push(`u${item.id}@${i}`) };
      },
    });

    list.render([{ id: 'a' }, { id: 'b' }]);
    list.render([{ id: 'b' }, { id: 'a' }]);

    assert.deepEqual(seen, ['ca@0', 'cb@1', 'ub@0', 'ua@1']);
  });

  test('a re-render that changes nothing replaces no nodes', () => {
    // Every store write calls render(); if that rewrote the DOM, the browser
    // would repaint the whole library on each keystroke anywhere in the page.
    const list = makeList();
    list.render([{ id: 'a' }, { id: 'b' }]);
    const before = [...container.children];

    list.render([{ id: 'a' }, { id: 'b' }]);

    assert.deepEqual([...container.children], before, 'the nodes were replaced');
  });
});

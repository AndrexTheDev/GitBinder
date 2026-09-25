/**
 * The UI event bus — `src/core/events.js`.
 *
 * The bus carries *signals*, not data: "open the settings drawer", "run the
 * fetch". The data itself goes through the store. That split is the reason the
 * bus is worth testing on its own — a signal that nobody listens to is a button
 * that does nothing, and a listener that nobody signals is wiring that can never
 * fire. Both are invisible in review, so the last test in this file reads the
 * source and refuses to let either exist.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import { createEmitter, UI_EVENTS } from '../src/core/events.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every `.js` file under `src/`, as `[relativePath, source]` pairs. */
function sources() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.js')) out.push([relative(ROOT, full), readFileSync(full, 'utf8')]);
    }
  };
  walk(join(ROOT, 'src'));
  return out;
}

describe('createEmitter', () => {
  test('a handler receives the payload, in subscription order', () => {
    const bus = createEmitter();
    const seen = [];

    bus.on('go', (payload) => seen.push(`first:${payload}`));
    bus.on('go', (payload) => seen.push(`second:${payload}`));
    bus.emit('go', 7);

    assert.deepEqual(seen, ['first:7', 'second:7']);
  });

  test('an event with no listeners is a no-op', () => {
    const bus = createEmitter();
    assert.doesNotThrow(() => bus.emit('nobody-listens', { a: 1 }));
  });

  test('on() returns a disposer that unsubscribes exactly that handler', () => {
    const bus = createEmitter();
    let a = 0;
    let b = 0;
    const offA = bus.on('go', () => (a += 1));
    bus.on('go', () => (b += 1));

    offA();
    bus.emit('go');

    assert.equal(a, 0);
    assert.equal(b, 1, 'the disposer removed the wrong handler');
  });

  test('off() is idempotent and off() for a stranger is harmless', () => {
    const bus = createEmitter();
    let calls = 0;
    const handler = () => (calls += 1);
    bus.on('go', handler);

    bus.off('go', handler);
    bus.off('go', handler);
    bus.off('never-registered', handler);
    bus.emit('go');

    assert.equal(calls, 0);
  });

  test('the same handler registered twice is only called once', () => {
    // Handlers live in a `Set`. Two subscriptions to the same function are one
    // subscription — worth pinning, because a component that subscribes on every
    // render would otherwise accumulate calls.
    const bus = createEmitter();
    let calls = 0;
    const handler = () => (calls += 1);

    bus.on('go', handler);
    bus.on('go', handler);
    bus.emit('go');

    assert.equal(calls, 1);
  });

  test('once() fires exactly once', () => {
    const bus = createEmitter();
    let calls = 0;
    bus.once('go', () => (calls += 1));

    bus.emit('go');
    bus.emit('go');
    bus.emit('go');

    assert.equal(calls, 1);
  });

  test('once() can be cancelled before it ever fires', () => {
    const bus = createEmitter();
    let calls = 0;
    const off = bus.once('go', () => (calls += 1));

    off();
    bus.emit('go');

    assert.equal(calls, 0);
  });

  test('a handler may unsubscribe itself while running', () => {
    // This is what the copy in `emit()` is for: the map is mutated during the
    // loop. Without the copy, the remaining handlers would be skipped or the
    // iteration would throw.
    const bus = createEmitter();
    const seen = [];

    const off = bus.on('go', () => {
      seen.push('self');
      off();
    });
    bus.on('go', () => seen.push('after'));

    bus.emit('go');
    assert.deepEqual(seen, ['self', 'after'], 'a self-unsubscribe cut the dispatch short');

    bus.emit('go');
    assert.deepEqual(seen, ['self', 'after', 'after'], 'the handler came back');
  });

  test('a later handler can subscribe for the next emit', () => {
    const bus = createEmitter();
    let calls = 0;
    bus.on('go', () => bus.on('go', () => (calls += 1)));

    bus.emit('go');
    assert.equal(calls, 0, 'a listener added during dispatch must not run in the same dispatch');

    bus.emit('go');
    assert.equal(calls, 1);
  });

  test('one throwing handler does not stop the others', () => {
    // The bus carries UI signals, so a broken handler must not be able to
    // silence the rest of the interface. The error is reported instead.
    const bus = createEmitter();
    const seen = [];
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => errors.push(args[0]);

    try {
      bus.on('go', () => {
        throw new Error('this handler is broken');
      });
      bus.on('go', () => seen.push('survivor'));

      assert.doesNotThrow(() => bus.emit('go'));
      assert.deepEqual(seen, ['survivor']);
      assert.equal(errors.length, 1, 'the failure was swallowed without a word');
      assert.match(String(errors[0]), /go/, 'the log should name the event that threw');
    } finally {
      console.error = originalError;
    }
  });

  test('clear(event) drops one event, clear() drops everything', () => {
    const bus = createEmitter();
    let go = 0;
    let other = 0;
    bus.on('go', () => (go += 1));
    bus.on('other', () => (other += 1));

    bus.clear('go');
    bus.emit('go');
    assert.equal(go, 0);
    bus.emit('other');
    assert.equal(other, 1, 'clearing one event must not touch another');

    bus.clear();
    bus.emit('other');
    assert.equal(other, 1);
  });

  test('a non-function handler is ignored rather than crashing later', () => {
    const bus = createEmitter();
    assert.doesNotThrow(() => bus.emit('go'));

    const off = bus.on('go', /** @type {any} */ (undefined));
    assert.equal(typeof off, 'function', 'on() still has to return a usable disposer');
    off();
    bus.emit('go');
  });

  test('events are independent', () => {
    const bus = createEmitter();
    let a = 0;
    let b = 0;
    bus.on('a', () => (a += 1));
    bus.on('b', () => (b += 1));

    bus.emit('a');
    assert.deepEqual([a, b], [1, 0]);
  });
});

describe('UI_EVENTS', () => {
  test('the names are frozen, so a typo cannot be patched in at runtime', () => {
    assert.equal(Object.isFrozen(UI_EVENTS), true);
    assert.throws(() => {
      // @ts-expect-error — deliberately writing to a frozen object
      UI_EVENTS.openSettings = 'ui:settings:OPEN';
    }, TypeError);
  });

  test('every name is namespaced and unique', () => {
    // Two shapes are in use: `ui:<domain>:<action>` for the signals that belong
    // to a surface, and the shorter `ui:toast` for the one global. Both are
    // checked, because the point of the list is that a name is never a guess.
    const values = Object.values(UI_EVENTS);
    assert.equal(new Set(values).size, values.length, 'two events share a name');
    for (const value of values) {
      assert.match(value, /^ui:[a-z-]+(:[a-z-]+)?$/, `"${value}" breaks the naming scheme`);
    }
  });
});

/* -------------------------------------------------------------------------- *
 * The wiring
 * -------------------------------------------------------------------------- */

describe('every UI event is wired at both ends', () => {
  test('nothing signals into the void and nothing waits for a signal nobody sends', () => {
    // A signal with no listener is a button that silently does nothing. A
    // listener for a signal nobody emits is wiring that can never run. Both look
    // perfectly reasonable in a diff, and both are invisible in the browser
    // until somebody clicks the thing and nothing happens. This is the check
    // that found `toggleBookPreview`: subscribed in `BookPreview`, emitted
    // nowhere — a dead wire registered at boot on every page load.
    const files = sources();
    const emitted = new Set();
    const subscribed = new Set();

    for (const [, source] of files) {
      for (const match of source.matchAll(/\.emit\(\s*UI_EVENTS\.([A-Za-z0-9_$]+)/g)) {
        emitted.add(match[1]);
      }
      for (const match of source.matchAll(/\.(?:on|once)\(\s*UI_EVENTS\.([A-Za-z0-9_$]+)/g)) {
        subscribed.add(match[1]);
      }
    }

    // The scan has to be able to see the wiring at all — otherwise it would
    // pass by finding nothing.
    assert.ok(emitted.size > 0 && subscribed.size > 0, 'the scan found no bus usage; it is broken');

    const neverEmitted = [...subscribed].filter((name) => !emitted.has(name));
    assert.deepEqual(neverEmitted, [], `subscribed but never emitted: ${neverEmitted.join(', ')}`);

    const neverHandled = [...emitted].filter((name) => !subscribed.has(name));
    assert.deepEqual(neverHandled, [], `emitted but never handled: ${neverHandled.join(', ')}`);

    // And the constant list has to match exactly: an entry that is neither
    // emitted nor subscribed is a name nobody uses.
    const unusedNames = Object.keys(UI_EVENTS).filter(
      (name) => !emitted.has(name) && !subscribed.has(name),
    );
    assert.deepEqual(unusedNames, [], `declared but unused: ${unusedNames.join(', ')}`);
  });

});

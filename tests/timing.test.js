/**
 * Timing helpers — `src/utils/timing.js`.
 *
 * These three functions sit under every interaction that looks "instant" but is
 * not: the debounced description field, the throttled scroll handler, the
 * coalesced re-render. Their failure mode is not a crash but a feel — a caret
 * that jumps, a filter that runs on every keystroke, a scroll listener that
 * fires a hundred times a second. So the assertions are about call counts and
 * ordering rather than about return values.
 *
 * `mock.timers` drives the clock; nothing here waits on real time.
 */

import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import { mock } from 'node:test';
import assert from 'node:assert/strict';

import { debounce, delay, nextFrame, throttle } from '../src/utils/timing.js';

/** Animation frames, held until the test decides to draw one. */
let frames = [];
let realRaf;

before(() => {
  // Node has no `requestAnimationFrame`, and jsdom's own is a real timer that a
  // mocked clock cannot drive. A queue the test drains is both available and
  // deterministic.
  realRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => {
    frames.push(callback);
    return frames.length;
  };
});

after(() => {
  if (realRaf) globalThis.requestAnimationFrame = realRaf;
  else delete globalThis.requestAnimationFrame;
});

/** Run everything queued for the current frame. */
function drawFrame() {
  const due = frames;
  frames = [];
  for (const callback of due) callback();
}

beforeEach(() => {
  frames = [];
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  // Move off the mocked epoch. `throttle()` compares `Date.now()` against a
  // `last` of 0, so at time 0 every first call would look like it happened
  // inside a window that just closed — an artefact of the clock, not of the
  // code, and one that hides what the test is actually checking.
  mock.timers.tick(10_000);
});

afterEach(() => {
  mock.timers.reset();
});

/* -------------------------------------------------------------------------- */

describe('debounce', () => {
  test('a burst of calls collapses into one, with the last arguments', () => {
    const calls = [];
    const fn = debounce((...args) => calls.push(args), 100);

    fn('a');
    mock.timers.tick(30);
    fn('b');
    mock.timers.tick(30);
    fn('c');
    assert.deepEqual(calls, [], 'it ran while the typing was still going on');

    mock.timers.tick(100);
    assert.deepEqual(calls, [['c']], 'the last call should be the one that runs');
  });

  test('the wait restarts on every call, so a steady typer is never interrupted', () => {
    let runs = 0;
    const fn = debounce(() => (runs += 1), 100);

    for (let i = 0; i < 10; i += 1) {
      fn();
      mock.timers.tick(90); // just under the threshold, ten times over
    }
    assert.equal(runs, 0, 'a keystroke every 90 ms must not trigger the write');

    mock.timers.tick(100);
    assert.equal(runs, 1);
  });

  test('flush() runs the pending call immediately and leaves nothing queued', () => {
    // This is the `onBlur` path: the visitor leaves the field and the pending
    // write must land now, exactly once.
    const calls = [];
    const fn = debounce((value) => calls.push(value), 1000);
    fn('typed');

    fn.flush();
    assert.deepEqual(calls, ['typed'], 'flush did not deliver the pending call');

    mock.timers.tick(2000);
    assert.deepEqual(calls, ['typed'], 'the call ran a second time after the flush');
  });

  test('flush() with nothing pending is a no-op', () => {
    const calls = [];
    const fn = debounce((value) => calls.push(value), 100);

    assert.doesNotThrow(() => fn.flush());
    assert.deepEqual(calls, []);

    fn('x');
    mock.timers.tick(100);
    fn.flush();
    assert.deepEqual(calls, ['x'], 'flush replayed an already delivered call');
  });

  test('cancel() drops the pending call and its arguments', () => {
    const calls = [];
    const fn = debounce((value) => calls.push(value), 100);
    fn('never mind');

    fn.cancel();
    mock.timers.tick(1000);
    fn.flush();
    assert.deepEqual(calls, []);
  });

  test('pending() reports whether a call is queued', () => {
    const fn = debounce(() => {}, 100);
    assert.equal(fn.pending(), false);

    fn();
    assert.equal(fn.pending(), true);

    mock.timers.tick(100);
    assert.equal(fn.pending(), false, 'pending() stayed true after the call ran');

    fn();
    fn.cancel();
    assert.equal(fn.pending(), false, 'pending() stayed true after cancel()');
  });

  test('the debounced function can be called again after it fired', () => {
    const calls = [];
    const fn = debounce((value) => calls.push(value), 50);

    fn('one');
    mock.timers.tick(50);
    fn('two');
    mock.timers.tick(50);

    assert.deepEqual(calls, ['one', 'two']);
  });

  test('calls are not dropped when the arguments are falsy', () => {
    // `if (callArgs)` would skip re-delivery for an empty array; the store gets
    // `null` when a note is cleared, and that write has to happen.
    const calls = [];
    const fn = debounce((...args) => calls.push(args), 10);

    fn(0);
    mock.timers.tick(10);
    fn(null);
    mock.timers.tick(10);
    fn('');
    mock.timers.tick(10);

    assert.deepEqual(calls, [[0], [null], ['']]);
  });

  test('independent debounced functions keep their own timers', () => {
    const a = [];
    const b = [];
    const fa = debounce((v) => a.push(v), 100);
    const fb = debounce((v) => b.push(v), 200);

    fa('a');
    fb('b');
    mock.timers.tick(100);
    assert.deepEqual([a, b], [['a'], []], 'the slower one fired early');
    mock.timers.tick(100);
    assert.deepEqual([a, b], [['a'], ['b']]);
  });
});

/* -------------------------------------------------------------------------- */

describe('throttle', () => {
  test('the first call runs immediately', () => {
    // Leading edge: a scroll handler that waited 100 ms before doing anything
    // would feel broken even when it is technically "throttled".
    const calls = [];
    const fn = throttle((value) => calls.push(value), 100);

    fn('first');
    assert.deepEqual(calls, ['first']);
  });

  test('calls inside the window are collapsed into one trailing call', () => {
    const calls = [];
    const fn = throttle((value) => calls.push(value), 100);

    fn('a');
    mock.timers.tick(10);
    fn('b');
    mock.timers.tick(10);
    fn('c');
    assert.deepEqual(calls, ['a'], 'a call slipped through inside the window');

    mock.timers.tick(100);
    assert.equal(calls.length, 2, 'the trailing call did not arrive');
    assert.equal(calls[1], 'c', 'the trailing call should carry the newest argument');
  });

  test('at most one trailing call is queued, however many arrive', () => {
    const calls = [];
    const fn = throttle((value) => calls.push(value), 100);

    fn('lead');
    for (let i = 0; i < 20; i += 1) {
      mock.timers.tick(1);
      fn(`burst-${i}`);
    }
    mock.timers.tick(200);

    assert.equal(calls.length, 2, `expected lead + one trailing call, got ${calls.length}`);
    assert.equal(calls[1], 'burst-19');
  });

  test('a call after the window runs immediately again', () => {
    const calls = [];
    const fn = throttle((value) => calls.push(value), 100);

    fn('one');
    mock.timers.tick(150);
    fn('two');

    assert.deepEqual(calls, ['one', 'two'], 'the throttle stayed closed past its window');
  });

  test('the trailing call is not duplicated when the window has already passed', () => {
    const calls = [];
    const fn = throttle((value) => calls.push(value), 100);

    fn('lead');
    mock.timers.tick(10);
    fn('trailing');
    mock.timers.tick(1000);

    assert.deepEqual(calls, ['lead', 'trailing']);
  });
});

/* -------------------------------------------------------------------------- */

describe('delay', () => {
  test('resolves after the given time', async () => {
    const order = [];
    const promise = delay(500).then(() => order.push('resolved'));

    mock.timers.tick(499);
    await Promise.resolve();
    assert.deepEqual(order, [], 'it resolved early');

    mock.timers.tick(1);
    await promise;
    assert.deepEqual(order, ['resolved']);
  });

  test('a zero delay still resolves through the timer queue, not synchronously', async () => {
    const order = [];
    const promise = delay(0).then(() => order.push('delayed'));
    order.push('synchronous');
    assert.deepEqual(order, ['synchronous'], 'delay(0) resolved before the next statement');

    mock.timers.tick(0);
    await promise;
    assert.deepEqual(order, ['synchronous', 'delayed']);
  });
});

/* -------------------------------------------------------------------------- */

describe('nextFrame', () => {
  test('runs the task on the next frame, never synchronously', () => {
    const seen = [];
    const fn = nextFrame((value) => seen.push(value));

    fn('a');
    assert.deepEqual(seen, [], 'it ran synchronously');
    assert.equal(frames.length, 1, 'no frame was scheduled');

    drawFrame();
    assert.deepEqual(seen, ['a']);
  });

  test('repeated calls inside one frame collapse into one run', () => {
    // The coalescing is the whole point: a store change during a frame should
    // schedule one re-render, not one per subscriber.
    let runs = 0;
    const fn = nextFrame(() => (runs += 1));

    fn();
    fn();
    fn();
    assert.equal(frames.length, 1, 'a frame was scheduled per call');

    drawFrame();
    assert.equal(runs, 1, `${runs} runs for three calls in one frame`);
  });

  test('a call after the frame ran schedules a fresh one', () => {
    const seen = [];
    const fn = nextFrame((value) => seen.push(value));

    fn('first');
    drawFrame();
    fn('second');
    drawFrame();

    assert.deepEqual(seen, ['first', 'second']);
  });

  test('the arguments of the run it collapses into are the newest ones', () => {
    // Consistent with `debounce()` and `throttle()` in the same module. The
    // first draft kept whichever call opened the frame, so a caller's payload
    // was silently the stale one.
    const seen = [];
    const fn = nextFrame((value) => seen.push(value));

    fn('stale');
    fn('fresh');
    drawFrame();

    assert.deepEqual(seen, ['fresh'], 'the first call in the frame won the arguments');
  });

  test('it can be used again after a frame, with new arguments', () => {
    const seen = [];
    const fn = nextFrame((value) => seen.push(value));

    fn('one');
    drawFrame();
    fn('two');
    drawFrame();
    fn('three');
    drawFrame();

    assert.deepEqual(seen, ['one', 'two', 'three']);
  });

  test('two nextFrame wrappers do not share a queue slot', () => {
    const seen = [];
    const a = nextFrame((value) => seen.push(`a:${value}`));
    const b = nextFrame((value) => seen.push(`b:${value}`));

    a(1);
    b(2);
    assert.equal(frames.length, 2, 'the second wrapper was coalesced into the first');

    drawFrame();
    assert.deepEqual(seen, ['a:1', 'b:2']);
  });
});

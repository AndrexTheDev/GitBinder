/**
 * Timing helpers.
 * @module utils/timing
 */

/**
 * Trailing-edge debounce. Returns a function with `.cancel()` and `.flush()`.
 *
 * Used for the per-repository description inputs: every keystroke updates the
 * store (and therefore the book preview), but we do not want the table of
 * contents to re-sort while somebody is still typing.
 */
export function debounce(fn, wait = 200) {
  let timer = null;
  let lastArgs = null;

  const debounced = (...args) => {
    lastArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const callArgs = lastArgs;
      lastArgs = null;
      fn(...callArgs);
    }, wait);
  };

  debounced.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  debounced.flush = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    const callArgs = lastArgs;
    lastArgs = null;
    if (callArgs) fn(...callArgs);
  };

  debounced.pending = () => timer !== null;
  return debounced;
}

/**
 * Leading-edge throttle for scroll/resize handlers.
 *
 * The trailing call carries the *newest* arguments, the way `debounce()` here
 * and `throttle()` in lodash do. It used to keep whichever call opened the
 * window, so a handler that takes a position as an argument reported where the
 * visitor was when the window started rather than where they are — wrong in
 * exactly the situation a throttle is for.
 */
export function throttle(fn, wait = 100) {
  let last = 0;
  let timer = null;
  /** @type {any[]|null} */
  let lastArgs = null;
  return (...args) => {
    lastArgs = args;
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      lastArgs = null;
      fn(...args);
    } else if (timer === null) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        const callArgs = lastArgs ?? args;
        lastArgs = null;
        fn(...callArgs);
      }, remaining);
    }
  };
}

/** `new Promise((r) => setTimeout(r, ms))` */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `task` on the next animation frame, coalescing repeated calls.
 * Useful for "sync the DOM after state settled" work.
 *
 * The newest arguments win, like `debounce()` and `throttle()` above. The first
 * draft kept the args of whichever call opened the frame, which is the one thing
 * a caller cannot predict — and this module has three helpers, so they should
 * behave the same way at the edges.
 */
export function nextFrame(task) {
  let queued = false;
  /** @type {any[]|null} */
  let lastArgs = null;
  return (...args) => {
    lastArgs = args;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const callArgs = lastArgs ?? [];
      lastArgs = null;
      task(...callArgs);
    });
  };
}

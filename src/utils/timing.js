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

/** Leading-edge throttle for scroll/resize handlers. */
export function throttle(fn, wait = 100) {
  let last = 0;
  let timer = null;
  return (...args) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else if (timer === null) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        fn(...args);
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
 */
export function nextFrame(task) {
  let queued = false;
  return (...args) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      task(...args);
    });
  };
}

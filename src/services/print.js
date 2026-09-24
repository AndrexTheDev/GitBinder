/**
 * Print / PDF trigger.
 *
 * `window.print()` is a one-line API with three non-obvious wrinkles:
 *
 *   1. **The file name.** Chromium seeds "Save as PDF" with `document.title`,
 *      so we swap in the book title for the duration of the call and put the
 *      app name back afterwards.
 *   2. **What gets printed.** The app chrome must vanish and the composed book
 *      must appear, even if the on-screen preview is currently collapsed. A
 *      `body.is-printing-book` class flips that in CSS — no DOM shuffling, so
 *      there is nothing to tear down if the visitor cancels the dialog.
 *   3. **When it finished.** `afterprint` is not universally fired (Safari), so
 *      a safety timer releases the guard in case the event never arrives.
 *
 * @module services/print
 */

import { BOOK_FILENAME_PREFIX } from '../config/book.js';

/** `body` class that turns the app into a book for the duration of the print. */
export const PRINTING_CLASS = 'is-printing-book';

/** How long to wait for `afterprint` before assuming it will never fire. */
const SAFETY_TIMEOUT_MS = 2500;

/**
 * Turn arbitrary text into a file-name-safe slug.
 * @param {string} value
 * @param {number} [max]
 */
/** Letters NFKD leaves alone but ASCII has no equivalent for. */
const TRANSLITERATE = Object.freeze({
  ß: 'ss', æ: 'ae', œ: 'oe', ø: 'oe', đ: 'd', ð: 'd', þ: 'th',
  ł: 'l', ı: 'i', ŋ: 'n', ə: 'e', ĸ: 'k', ŧ: 't',
});

export function bookFilename(value, max = 60) {
  const slug = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents; the base letter survives
    .replace(/[\u00df\u00e6\u0153\u00f8\u0111\u00f0\u00fe\u0142\u0131\u014b\u018f\u0138\u0167]/gi, (char) => {
      const mapped = TRANSLITERATE[char.toLowerCase()];
      // Preserve a capital's position: "Über" → "Ueber", not "ueber".
      return char === char.toLowerCase() ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
    })
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return slug ? `${BOOK_FILENAME_PREFIX}-${slug}` : BOOK_FILENAME_PREFIX;
}

/**
 * @param {object} [options]
 * @param {Window} [options.window]
 * @param {Document} [options.document]
 * @param {() => void} [options.print]          injected for tests
 * @param {() => boolean} [options.canPrint]    guard; return false to refuse
 * @param {(reason: string) => void} [options.onRefuse]
 * @param {() => void} [options.onBefore]       last chance to compose the book
 * @param {(printed: boolean) => void} [options.onAfter]
 * @param {number} [options.safetyTimeout]
 */
export function createPrintController(options = {}) {
  const win = options.window ?? (typeof window !== 'undefined' ? window : null);
  const doc = options.document ?? win?.document ?? (typeof document !== 'undefined' ? document : null);
  const invokePrint = options.print ?? (() => win?.print?.());
  const safetyTimeout = options.safetyTimeout ?? SAFETY_TIMEOUT_MS;

  let printing = false;
  /** @type {number|null} */
  let timer = null;
  let restoreTitle = null;
  let disposed = false;

  function cleanup() {
    if (timer !== null && win?.clearTimeout) win.clearTimeout(timer);
    timer = null;
    printing = false;
    doc?.body?.classList.remove(PRINTING_CLASS);
    if (restoreTitle !== null && doc) {
      doc.title = restoreTitle;
      restoreTitle = null;
    }
  }

  function onAfterPrint() {
    if (!printing) return;
    cleanup();
    options.onAfter?.(true);
  }

  if (win && typeof win.addEventListener === 'function') {
    win.addEventListener('afterprint', onAfterPrint);
  }

  /**
   * Compose (if needed), then hand the document to the browser's print dialog.
   *
   * @param {{ title?: string, before?: () => void }} [args]
   * @returns {boolean} whether the print dialog was opened
   */
  function print(args = {}) {
    if (disposed || !win || typeof invokePrint !== 'function') return false;
    // A second click while the dialog is open would only queue another job.
    if (printing) return false;

    if (typeof options.canPrint === 'function' && options.canPrint() === false) {
      options.onRefuse?.('empty');
      return false;
    }

    printing = true;

    // Give the caller the chance to build the book synchronously *before* the
    // printer snapshots the DOM — the preview may never have been opened.
    args.before?.();
    options.onBefore?.();

    doc?.body?.classList.add(PRINTING_CLASS);

    if (doc && args.title) {
      restoreTitle = doc.title;
      doc.title = bookFilename(args.title);
    }

    try {
      invokePrint();
    } catch (error) {
      cleanup();
      options.onAfter?.(false);
      throw error;
    }

    // Safari never fires `afterprint`; release the guard anyway.
    if (safetyTimeout > 0 && win?.setTimeout) {
      timer = win.setTimeout(() => {
        if (!printing) return;
        cleanup();
        options.onAfter?.(true);
      }, safetyTimeout);
    }

    return true;
  }

  return {
    print,
    isPrinting: () => printing,
    /** Abandon an in-flight print without waiting for the event. */
    cancel: cleanup,
    dispose() {
      if (win && typeof win.removeEventListener === 'function') {
        win.removeEventListener('afterprint', onAfterPrint);
      }
      cleanup();
      disposed = true;
    },
  };
}

/**
 * Ad-blocker gate.
 *
 * GitBinder is free and shows no advertising of its own. The gate exists
 * because the brief asks for it: visitors running a content blocker are shown
 * a notice instead of the app.
 *
 * Two decisions shape the implementation:
 *
 *   1. **No network.** The usual trick — request a URL that ad blockers
 *      blacklist and see whether it fails — sends a request to a third party
 *      from every visitor's browser. This app's central promise is that it
 *      runs entirely client-side and talks to nobody but api.github.com, so
 *      detection is done purely by measuring bait elements in the DOM.
 *
 *   2. **Measured by computed style, not layout.** Cosmetic filters work by
 *      injecting CSS (`display: none`) or by deleting the node, so those are
 *      exactly what is checked. `offsetHeight`/`offsetParent` would be simpler
 *      but they are also zero in any environment without a layout engine —
 *      including the test suite — which would report every visitor as blocked.
 *
 * @module services/adblock
 */

/**
 * Bait elements. Class names come from two different naming families, so a
 * list that only covers one convention still trips the other.
 */
const BAITS = Object.freeze([
  { tag: 'div', class: 'adsbox ad-banner ad-placement', id: 'ad-banner-slot', size: '120px' },
  { tag: 'div', class: 'advertisement sponsored-content', id: 'adsense-bait', size: '60px' },
]);

/** How long to wait for a filter list to react before deciding. */
const SETTLE_MS = 220;

/** Computed values that mean "something hid this on purpose". */
const HIDDEN_DISPLAY = new Set(['none']);
const HIDDEN_VISIBILITY = new Set(['hidden', 'collapse']);

/**
 * @typedef {object} AdBlockVerdict
 * @property {boolean} blocked
 * @property {string[]} signals     human-readable reasons, for debugging/logging
 */

/**
 * Build the bait nodes and attach them off-screen.
 *
 * `position: fixed` with a real size and `top: -9999px` keeps them out of the
 * way while still giving a filter list something with geometry to match on.
 *
 * @param {Document} doc
 * @returns {{ nodes: HTMLElement[], host: HTMLElement }}
 */
function mountBaits(doc) {
  const host = doc.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.dataset.testid = 'adblock-baits';
  host.style.cssText = 'position:fixed;top:-9999px;left:-9999px;pointer-events:none;';

  const nodes = BAITS.map((spec) => {
    const el = doc.createElement(spec.tag);
    el.className = spec.class;
    el.id = spec.id;
    el.style.cssText = `width:${spec.size};height:${spec.size};`;
    host.append(el);
    return el;
  });

  (doc.body ?? doc.documentElement).append(host);
  return { nodes, host };
}

/**
 * @param {Window} win
 * @param {HTMLElement} el
 * @returns {string|null} the reason this element looks blocked, else null
 */
function hiddenReason(win, el) {
  if (!el.isConnected) return 'element removed from the DOM';

  const view = win.getComputedStyle?.(el);
  if (!view) return null;

  if (HIDDEN_DISPLAY.has(view.display)) return `display: ${view.display}`;
  if (view.visibility && HIDDEN_VISIBILITY.has(view.visibility)) return `visibility: ${view.visibility}`;
  if (view.opacity === '0') return 'opacity: 0';

  // A filter list may collapse the box instead of hiding it. Only an explicit
  // zero counts — an empty computed height (no layout engine) must not.
  if (view.height === '0px') return 'height collapsed to 0';
  if (view.width === '0px') return 'width collapsed to 0';

  return null;
}

/**
 * Has something hidden the baits?
 *
 * @param {Window} win
 * @param {Document} doc
 * @returns {AdBlockVerdict}
 */
function measure(win, doc) {
  const { nodes, host } = mountBaits(doc);
  /** @type {string[]} */
  const signals = [];

  try {
    for (const node of nodes) {
      const reason = hiddenReason(win, node);
      if (reason) signals.push(`${node.id}: ${reason}`);
    }
  } finally {
    // Remove the wrapper, not just the baits — otherwise every check leaves
    // a hidden div behind in the visitor's page.
    host.remove();
  }

  return { blocked: signals.length > 0, signals };
}

/**
 * Detect a content blocker.
 *
 * Resolves after a short settle window, because half the filter lists act on a
 * `MutationObserver` and hide the bait a tick after it appears.
 *
 * @param {object} [options]
 * @param {Window} [options.window]
 * @param {Document} [options.document]
 * @param {number} [options.settleMs]   delay before measuring; 0 measures twice
 * @param {boolean} [options.enabled]   config kill-switch
 * @returns {Promise<AdBlockVerdict>}
 */
export async function detectAdBlocker(options = {}) {
  // `in` rather than `??`: an explicitly passed null means "there is no
  // window, do not look for one", and must not silently fall back to a global.
  const win = 'window' in options ? options.window : globalThis.window ?? null;
  const doc = 'document' in options ? options.document : win?.document ?? null;

  if (options.enabled === false) return { blocked: false, signals: ['detection disabled'] };
  // No DOM (SSR, a worker, a test without a document): nothing to measure, and
  // guessing would lock people out, so the gate opens.
  if (!win || !doc || typeof doc.createElement !== 'function') {
    return { blocked: false, signals: ['no document to measure'] };
  }

  const settle = options.settleMs ?? SETTLE_MS;
  if (settle > 0) await new Promise((resolve) => setTimeout(resolve, settle));
  else await Promise.resolve();

  return measure(win, doc);
}

export const ADBLOCK_BAITS = BAITS;
export const ADBLOCK_SETTLE_MS = SETTLE_MS;

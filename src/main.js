/**
 * GitBinder entry point.
 *
 * Vite serves this as a module; `npm run build` bundles it into a static
 * `dist/` that Cloudflare Pages serves with no server involved.
 *
 * @module main
 */

import { bootstrap } from './app.js';
import { ADBLOCK_GATE } from './config/app.js';
import { AdBlockNotice } from './components/AdBlockNotice.js';
import { detectAdBlocker } from './services/adblock.js';
import { createTranslator, detectInitialLanguage } from './i18n/index.js';
// The stylesheet is linked from index.html (<link rel="stylesheet">) so the
// browser can start fetching it before this module is even parsed.

/**
 * A translator for the gate screen, which has to render *before* the app
 * exists — so it builds its own rather than borrowing the app's.
 *
 * The visitor's saved language lives in localStorage, but reading it here
 * would mean touching storage before the app decides it is allowed to; the
 * browser's own languages are enough to greet them in the right one.
 */
function gateTranslator() {
  const i18n = createTranslator({
    locale: detectInitialLanguage({ navigator: navigator }),
    document,
    navigator,
  });
  return (key, params) => i18n.t(key, params);
}

/**
 * Boot into either the app or the gate.
 *
 * When a content blocker is detected the app is never constructed: none of its
 * components mount, none of its listeners attach, and no state is read. That
 * is what "no access to the app's features" has to mean in practice — hiding a
 * running app behind an overlay would leave everything reachable through the
 * console and the keyboard.
 */
async function startGated() {
  const boot = document.getElementById('boot');
  const t = gateTranslator();

  const verdict = await detectAdBlocker({ enabled: ADBLOCK_GATE.enabled });
  if (!verdict.blocked) {
    start();
    return;
  }

  console.warn('[gitbinder] ad blocker detected:', verdict.signals.join('; '));
  boot?.remove();

  const gate = AdBlockNotice({
    host: document.getElementById('app') ?? document.body,
    t,
    recheck: () => detectAdBlocker({ enabled: ADBLOCK_GATE.enabled, settleMs: 120 }),
    onUnblocked: () => {
      gate.destroy();
      start();
    },
  });
}

function start() {
  const boot = document.getElementById('boot');
  try {
    const app = bootstrap();

    // Expose a tiny handle for console poking / debugging. Never a leak:
    // everything it exposes is already in the page.
    if (import.meta.env?.DEV) {
      window.__gitbinder = app;
    }

    boot?.remove();
  } catch (error) {
    console.error('[gitbinder] failed to start', error);
    if (boot) {
      boot.innerHTML = `
        <div class="mx-auto max-w-md px-6 text-center">
          <h1 class="font-serif text-xl font-semibold text-ink-900">GitBinder could not start</h1>
          <p class="mt-2 text-sm text-ink-600">
            Something went wrong while initialising the app. Reloading usually fixes it.
          </p>
          <pre class="mt-4 overflow-auto rounded-lg bg-paper-200 p-3 text-left text-xs text-ink-700">${String(
            error?.message ?? error,
          )}</pre>
        </div>`;
    }
  }
}

const run = () => {
  startGated().catch((error) => {
    // A gate that throws must not take the app down with it — a failed
    // detection is not evidence of a blocker, so open the gate.
    console.error('[gitbinder] ad-block check failed, starting anyway', error);
    start();
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', run, { once: true });
} else {
  run();
}

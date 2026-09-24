/**
 * GitBinder entry point.
 *
 * Vite serves this as a module; `npm run build` bundles it into a static
 * `dist/` that Cloudflare Pages serves with no server involved.
 *
 * @module main
 */

import { bootstrap } from './app.js';
// The stylesheet is linked from index.html (<link rel="stylesheet">) so the
// browser can start fetching it before this module is even parsed.

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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}

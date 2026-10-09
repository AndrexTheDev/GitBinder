/**
 * Application bootstrap.
 *
 * Builds the context (stores + i18n), mounts every component into the layout
 * shell defined in index.html, and owns the *only* place that talks to GitHub:
 * the fetch pipeline below.
 *
 * Data flow, one time around:
 *   visitor action → event bus → controller (this file) → GitHub service
 *     → session store (repos, status, error)
 *     → component subscriptions re-render
 *     → and `repoOverrides` written back into the settings store (persisted)
 *
 * @module app
 */

import { createAppContext } from './state/index.js';
import { UI_EVENTS } from './core/events.js';
import { GITHUB } from './config/app.js';
import { GithubError, fetchUserRepos } from './services/github.js';
import { createToaster } from './components/ui/Toast.js';
import { AppNavbar } from './components/AppNavbar.js';
import { HeroPanel } from './components/HeroPanel.js';
import { RepositoryLibrary } from './components/RepositoryLibrary.js';
import { BookSummary } from './components/BookSummary.js';
import { BookPreview } from './components/BookPreview.js';
import { AppFooter } from './components/AppFooter.js';
import { SettingsDrawer } from './components/SettingsDrawer.js';
import { SupportModal } from './components/SupportModal.js';
import { InfoModals } from './components/InfoModals.js';

/**
 * @param {object} [env]
 * @param {Document} [env.host]         document to mount into (defaults to `document`)
 * @param {Storage}  [env.storage]      storage adapter (defaults to `localStorage`)
 * @param {typeof fetch} [env.fetch]    fetch implementation, injectable for tests
 * @returns {{ destroy: () => void, ctx: ReturnType<typeof createAppContext> }}
 */
/**
 * The account the fetched repositories belong to.
 * `/user/repos` does not tell us the login, so derive it from the payload.
 */
function derivedOwner(repos) {
  const tally = new Map();
  for (const repo of repos) {
    if (!repo.owner) continue;
    tally.set(repo.owner, (tally.get(repo.owner) ?? 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [owner, count] of tally) {
    if (count > bestCount) {
      best = owner;
      bestCount = count;
    }
  }
  return best;
}

export function bootstrap(env = {}) {
  const doc = env.host ?? document;
  const ctx = createAppContext({ storage: env.storage });
  const { settings, session, i18n, bus } = ctx;
  const t = (...args) => i18n.t(...args);

  const toaster = createToaster({
    host: doc.querySelector('#toast-root'),
    labels: { close: t('common.close') },
  });

  /* ── Component mounting ────────────────────────────────────────────── */

  /** @type {Array<{ destroy: () => void }>} */
  const components = [];

  function mountComponent(selector, factory) {
    const host = doc.querySelector(selector);
    if (!host) {
      console.warn(`[bootstrap] missing host element "${selector}"`);
      return null;
    }
    const component = factory({ ...ctx, t, toaster });
    host.replaceChildren(component.el);
    components.push(component);
    return component;
  }

  const navbar = mountComponent('#navbar-root', AppNavbar);
  const hero = mountComponent('#hero-root', HeroPanel);
  const library = mountComponent('#library-root', RepositoryLibrary);
  const summary = mountComponent('#summary-root', BookSummary);
  const footer = mountComponent('#footer-root', AppFooter);

  // The book studio renders into two hosts: the preview region and the sticky
  // action bar that follows the visitor down the page.
  const bookPreview = mountComponent('#book-root', BookPreview);
  if (bookPreview?.barEl) {
    const barHost = doc.querySelector('#book-bar-root');
    if (barHost) barHost.replaceChildren(bookPreview.barEl);
    else console.warn('[bootstrap] missing host element "#book-bar-root"');
  }

  // Modeless "layers" — they own an overlay created on demand.
  const settingsDrawer = SettingsDrawer({ ...ctx, t, toaster });
  const supportModal = SupportModal({ ...ctx, t, toaster });
  // Help / Disclaimer / Terms / Contact. Renders no root element; every dialog
  // is built the first time somebody opens it.
  const infoModals = InfoModals({ ...ctx, t, toaster });
  components.push(settingsDrawer, supportModal, infoModals);

  /* ── Repository fetching ───────────────────────────────────────────── */

  /** @type {AbortController|null} */
  let inflight = null;

  /**
   * Fetch repositories for the configured user and reconcile overrides.
   *
   * Overrides are merged, not replaced: a repository that disappears from
   * GitHub keeps its curation (it may simply have been renamed or made
   * private), and newly appearing repositories get a sensible default.
   */
  async function fetchRepos({ silent = false } = {}) {
    const username = String(settings.state.githubUsername ?? '').trim();
    if (!username) {
      toaster.push({ tone: 'warning', message: t('errors.usernameRequired') });
      bus.emit(UI_EVENTS.openSettings);
      return;
    }

    inflight?.abort();
    inflight = new AbortController();

    session.batch(() => {
      session.state.status = 'loading';
      session.state.error = null;
      session.state.progress = null;
    });

    if (!silent) {
      toaster.push({
        tone: 'info',
        message: t('toasts.fetch.start', { username }),
        timeout: 2200,
      });
    }

    try {
      const { repos, rateLimit, source, truncated } = await fetchUserRepos({
        username,
        token: settings.state.personalAccessToken,
        signal: inflight.signal,
        ...(env.fetch ? { fetchImpl: env.fetch } : {}),
        // Progress only — the results are written once, at the end, so the
        // list never flashes half-loaded.
        onPage: ({ page, totalPages }) => {
          session.set(
            'progress',
            totalPages
              ? t('library.loading.pageOf', { page, totalPages })
              : t('library.loading.page', { page }),
          );
        },
      });

      const previousOverrides = settings.toJSON().repoOverrides ?? {};

      // Seed the *visibility* default only. Status and description stay `null`
      // so they keep tracking the live metadata until the visitor edits them.
      settings.batch(() => {
        for (const repo of repos) {
          if (previousOverrides[repo.slug]) continue;
          settings.state.repoOverrides[repo.slug] = {
            visible: !repo.isFork,
            status: null,
            shortDescription: null,
            updatedAt: null,
          };
        }
      });

      session.batch(() => {
        session.state.repos = repos;
        session.state.status = 'ready';
        session.state.fetchedAt = new Date().toISOString();
        session.state.fetchedUsername = derivedOwner(repos) ?? username;
        session.state.source = source;
        session.state.truncated = truncated;
        session.state.error = null;
        session.state.rateLimit = rateLimit;
        session.state.progress = null;
      });

      const count = repos.length;
      if (count === 0) {
        toaster.push({ tone: 'warning', message: t('toasts.fetch.empty', { username }) });
      } else {
        toaster.push({ tone: 'success', message: t('toasts.fetch.success', { count }) });
      }
      if (source === 'users' && count > 0) {
        toaster.push({ tone: 'info', message: t('toasts.fetch.publicOnly'), timeout: 5200 });
      }
      if (truncated) {
        toaster.push({
          tone: 'warning',
          message: t('toasts.fetch.truncated', { count, pages: GITHUB.maxPages }),
          timeout: 6000,
        });
      }
    } catch (error) {
      // A superseded fetch (the visitor asked again) is not an error.
      if (error instanceof GithubError && error.kind === 'aborted') return;
      if (error?.name === 'AbortError') return;

      const kind = error instanceof GithubError ? error.kind : 'unknown';
      const message =
        error instanceof GithubError
          ? t(error.i18nKey, {
              status: error.status ?? '',
              username: error.username ?? username,
              time: error.resetAt ? i18n.formatDate(error.resetAt) : '',
            })
          : t('errors.unknown');

      session.batch(() => {
        session.state.status = 'error';
        session.state.error = {
          kind,
          message,
          status: error?.status ?? null,
          resetAt: error?.resetAt ?? null,
        };
        session.state.progress = null;
      });

      toaster.push({
        tone: 'error',
        title: t('errors.unknown'),
        message,
        action: { label: t('common.retry'), onClick: () => fetchRepos() },
      });
    } finally {
      inflight = null;
    }
  }

  /* ── Event wiring ──────────────────────────────────────────────────── */

  const busDisposers = [
    bus.on(UI_EVENTS.fetchRepos, () => fetchRepos()),
    bus.on(UI_EVENTS.toast, (payload) => toaster.push(payload)),
    // A toast's text is translated when it is pushed, so it cannot follow a
    // later language switch. Clear the stack on a locale change rather than
    // leave stale-language messages on screen (new toasts use the new locale).
    i18n.onChange(() => toaster.clearAll()),
    // `printBook` and `buildPdf` are handled inside the book studio itself —
    // it owns the print controller, so nothing needs to be forwarded here.
  ];

  /* ── First paint housekeeping ──────────────────────────────────────── */

  // Strings declared in index.html (skip link, noscript, <title>) are
  // translated the same way as everything else.
  i18n.applyTo(document);
  i18n.syncDocument();

  // Deep link: ?u=<username> pre-fills the username, ?lang=<code> overrides.
  try {
    const params = new URLSearchParams(window.location.search);
    const user = params.get('u');
    const lang = params.get('lang');
    if (user && !settings.state.githubUsername) settings.set('githubUsername', user.trim());
    if (lang) settings.set('language', lang);
  } catch {
    /* non-browser environment */
  }

  // If we already know the user, populate the library right away.
  if (settings.state.githubUsername) {
    // Deferred so the first paint is never blocked by the network.
    queueMicrotask(() => fetchRepos({ silent: true }));
  }

  // The shell rendered, so the boot splash has done its job.
  doc.getElementById('boot')?.remove();

  // Last-resort flush: make sure a tab closed mid-edit still persists.
  // `beforeunload` is unreliable on mobile, so `pagehide` in the store covers us.
  window.addEventListener('beforeunload', () => settings.persistNow());

  return {
    ctx,
    fetchRepos,
    components: {
      navbar,
      hero,
      library,
      summary,
      bookPreview,
      footer,
      settingsDrawer,
      supportModal,
      infoModals,
    },
    toaster,
    destroy() {
      inflight?.abort();
      for (const dispose of busDisposers) dispose();
      for (const component of components) component.destroy?.();
      toaster.clearAll();
      settings.destroy();
      session.destroy();
    },
  };
}

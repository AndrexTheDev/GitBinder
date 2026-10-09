/**
 * Repository manager — the main working surface.
 *
 * Global controls (search, sort, hide-forks, bulk selection, refresh) plus the
 * keyed list of {@link RepoCard}s, the loading skeletons and every empty state.
 *
 * Cards are reconciled by slug (see core/list.js) rather than re-rendered, so
 * typing in a description field never loses focus — and the store is written on
 * every keystroke.
 *
 * @module components/RepositoryLibrary
 */

import { clear, h, mount, setText } from '../core/dom.js';
import { createKeyedList } from '../core/list.js';
import { UI_EVENTS } from '../core/events.js';
import { debounce } from '../utils/timing.js';
import { LIBRARY_SORTS } from '../state/schema.js';
import { selectLibrary, selectStats, selectViews } from '../state/selectors.js';
import { icon } from './ui/Icon.js';
import { RepoCard } from './RepoCard.js';

/**
 * @param {object} ctx
 * @param {import('../core/store.js').Store} ctx.settings
 * @param {import('../core/store.js').Store} ctx.session
 * @param {import('../core/i18n.js').I18n} ctx.i18n
 * @param {(key: string, params?: object) => string} ctx.t
 * @param {import('../core/events.js').ReturnType} ctx.bus
 * @param {import('./ui/Toast.js').Toaster} [ctx.toaster]
 */
export function RepositoryLibrary(ctx) {
  const { settings, session, i18n, t, bus } = ctx;

  /* ── Toolbar: search ───────────────────────────────────────────────── */

  const searchInput = h('input', {
    type: 'search',
    class: 'input pl-9',
    'aria-label': t('library.toolbar.search.label'),
    placeholder: t('library.toolbar.search.placeholder'),
    value: session.state.search,
    onInput: (event) => session.set('search', event.target.value),
  });

  const searchBox = h(
    'div',
    { class: 'input-affix min-w-0 flex-1' },
    h('span', { class: 'pointer-events-none absolute left-3 text-ink-400' }, icon('search', { size: 15 })),
    searchInput,
  );

  /* ── Toolbar: sort ─────────────────────────────────────────────────── */

  const sortSelect = h(
    'select',
    {
      class: 'input w-auto py-1.5 text-xs',
      'aria-label': t('library.toolbar.sort.label'),
      onChange: (event) => settings.set('library.sort', event.target.value),
    },
    LIBRARY_SORTS.map((key) =>
      h('option', {
        value: key,
        selected: settings.state.library.sort === key,
        text: t(`library.toolbar.sort.${key}`),
        'data-i18n': `library.toolbar.sort.${key}`,
      }),
    ),
  );

  /* ── Toolbar: hide forks ───────────────────────────────────────────── */

  const hideForksId = 'library-hide-forks';
  const hideForks = h('input', {
    id: hideForksId,
    type: 'checkbox',
    class: 'checkbox',
    checked: settings.state.library.hideForks === true,
    onChange: (event) => settings.set('library.hideForks', event.target.checked),
  });

  // The `data-i18n` binding belongs on the text `<span>`, never on the label:
  // `applyTo()` writes a text binding with `textContent = ...`, which would
  // delete every child of the node it is applied to — and this label *wraps*
  // the checkbox it describes. Bound to the label, the first language switch
  // removed the checkbox from the page.
  const hideForksLabel = h(
    'label',
    {
      for: hideForksId,
      class: 'flex cursor-pointer select-none items-center gap-2 whitespace-nowrap rounded-lg border border-paper-300 bg-paper-50 px-2.5 py-1.5 text-xs font-semibold text-ink-600 hover:border-brass-300 hover:bg-brass-50',
    },
    hideForks,
    h('span', { text: t('library.toolbar.hideForks'), 'data-i18n': 'library.toolbar.hideForks' }),
    h('span', { class: 'text-ink-400' }, icon('fork', { size: 13 })),
  );

  /* ── Toolbar: bulk + refresh ───────────────────────────────────────── */

  function bulkButton(iconName, key, action) {
    return h(
      'button',
      {
        type: 'button',
        class: 'btn btn-ghost text-xs',
        'data-tooltip': t(key),
        onClick: action,
      },
      icon(iconName, { size: 14 }),
      h('span', { class: 'hidden xl:inline', text: t(key), 'data-i18n': key }),
    );
  }

  const bulkAll = bulkButton('selectAll', 'library.toolbar.selectAll', () => setAllVisible(true));
  const bulkNone = bulkButton('selectNone', 'library.toolbar.selectNone', () => setAllVisible(false));
  const bulkInvert = bulkButton('sort', 'library.toolbar.invert', invertSelection);

  const refreshIcon = icon('fetch', { size: 14 });
  const refreshButton = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-outline text-xs',
      onClick: () => bus.emit(UI_EVENTS.fetchRepos),
    },
    refreshIcon,
    h('span', { class: 'hidden sm:inline', text: t('library.toolbar.refresh'), 'data-i18n': 'library.toolbar.refresh' }),
  );

  /* ── Header ────────────────────────────────────────────────────────── */

  const titleEl = h('h2', {
    id: 'library-title',
    class: 'card-title',
    text: t('library.title'),
    'data-i18n': 'library.title',
  });

  const subtitleEl = h('p', {
    class: 'mt-0.5 text-xs text-ink-500',
    text: t('library.subtitle'),
    'data-i18n': 'library.subtitle',
  });

  const counterEl = h('span', { class: 'chip' });
  // The "synchronised … / source" detail is secondary on a phone, and its
  // long, unbreakable string is what blew out the header at ≤ 390 px (F-03).
  const syncEl = h('span', { class: 'hidden flex-col items-end gap-0.5 sm:flex' });

  /* ── Body ──────────────────────────────────────────────────────────── */

  const listHost = h('div', { class: 'flex flex-col gap-2.5 p-3', role: 'list', 'aria-label': t('a11y.repositoryList') });
  const body = h('div', { class: 'px-0 py-0' });

  const list = createKeyedList({
    container: listHost,
    key: (repo) => repo.slug,
    create: (repo) =>
      RepoCard({
        repo,
        t,
        locale: () => i18n.locale,
        onPatch: (slug, patch) => {
          const current = settings.state.repoOverrides[slug] ?? {};
          // Array path: a repo name may contain dots, which a dot path would split.
          settings.set(['repoOverrides', slug], {
            ...current,
            ...patch,
            updatedAt: new Date().toISOString(),
          });
        },
      }),
    emptyNode: () => h('div', { class: 'p-4' }),
  });

  /* ── Bulk actions ──────────────────────────────────────────────────── */

  function setAllVisible(visible) {
    const views = selectViews(session.state, settings.state);
    if (views.length === 0) return;
    settings.batch(() => {
      for (const repo of views) {
        const current = settings.state.repoOverrides[repo.slug] ?? {};
        settings.state.repoOverrides[repo.slug] = {
          ...current,
          visible,
          updatedAt: new Date().toISOString(),
        };
      }
    });
    ctx.toaster?.push({
      tone: 'info',
      message: visible ? t('toasts.repos.allVisible') : t('toasts.repos.noneVisible'),
      timeout: 2400,
    });
  }

  function invertSelection() {
    const views = selectViews(session.state, settings.state);
    if (views.length === 0) return;
    settings.batch(() => {
      for (const repo of views) {
        const current = settings.state.repoOverrides[repo.slug] ?? {};
        settings.state.repoOverrides[repo.slug] = {
          ...current,
          visible: !repo.visible,
          updatedAt: new Date().toISOString(),
        };
      }
    });
  }

  /* ── Empty / loading / error states ────────────────────────────────── */

  function emptyState({ iconName, titleKey, bodyKey, action }) {
    return h(
      'div',
      { class: 'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center' },
      h(
        'span',
        { class: 'flex h-12 w-12 items-center justify-center rounded-full bg-paper-200 text-ink-400' },
        icon(iconName, { size: 22 }),
      ),
      h('p', { class: 'font-serif text-base font-semibold text-ink-800', text: t(titleKey), 'data-i18n': titleKey }),
      h('p', { class: 'max-w-sm text-sm leading-relaxed text-ink-500', text: t(bodyKey), 'data-i18n': bodyKey }),
      action,
    );
  }

  function settingsAction() {
    return h(
      'button',
      { type: 'button', class: 'btn btn-primary', onClick: () => bus.emit(UI_EVENTS.openSettings) },
      icon('settings', { size: 15 }),
      h('span', { text: t('library.empty.fetch.cta'), 'data-i18n': 'library.empty.fetch.cta' }),
    );
  }

  /** Inline error banner: keeps the previous results visible while explaining
   *  what went wrong and offering a retry. */
  function errorBanner() {
    const error = session.state.error;
    if (!error) return null;
    return h(
      'div',
      { class: 'flex flex-wrap items-center gap-3 border-b border-crimson-100 bg-crimson-100/50 px-4 py-3' },
      h('span', { class: 'shrink-0 text-crimson-700' }, icon('error', { size: 16 })),
      h('p', { class: 'min-w-0 flex-1 text-xs leading-relaxed text-crimson-700', text: error.message }),
      h(
        'button',
        { type: 'button', class: 'btn btn-outline shrink-0 text-xs', onClick: () => bus.emit(UI_EVENTS.fetchRepos) },
        icon('fetch', { size: 14 }),
        h('span', { text: t('common.retry'), 'data-i18n': 'common.retry' }),
      ),
    );
  }

  function skeletonCards(count = 5) {
    return Array.from({ length: count }, () =>
      h(
        'div',
        { class: 'repo-card' },
        h(
          'div',
          { class: 'flex items-start gap-2.5' },
          h('span', { class: 'skeleton h-4 w-4 rounded' }),
          h(
            'div',
            { class: 'min-w-0 flex-1 space-y-2' },
            h('span', { class: 'skeleton block h-4 w-48' }),
            h('span', { class: 'skeleton block h-3 w-72' }),
          ),
        ),
        h(
          'div',
          { class: 'ml-[4.5rem] mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]' },
          h('span', { class: 'skeleton block h-[4.5rem] rounded-md' }),
          h('span', { class: 'skeleton block h-[4.5rem] rounded-md' }),
        ),
      ),
    );
  }

  /* ── Render ────────────────────────────────────────────────────────── */

  function renderNow() {
    if (session.state.status === 'loading') {
      mount(body, ...skeletonCards(5));
      return;
    }

    const views = selectViews(session.state, settings.state);

    if (views.length === 0) {
      list.clear();
      const state = session.state.error?.kind === 'notFound' ? 'username' : 'fetch';
      mount(
        body,
        emptyState({
          iconName: 'library',
          titleKey: `library.empty.${state}.title`,
          bodyKey: `library.empty.${state}.body`,
          action: settingsAction(),
        }),
      );
      return;
    }

    const rows = selectLibrary(views, {
      search: session.state.search,
      sort: settings.state.library.sort,
      hideForks: settings.state.library.hideForks,
    });

    if (rows.length === 0) {
      list.clear();
      mount(
        body,
        emptyState({
          iconName: 'search',
          titleKey: 'library.empty.search.title',
          bodyKey: 'library.empty.search.body',
          action: h(
            'button',
            {
              type: 'button',
              class: 'btn btn-outline',
              onClick: () => {
                session.set('search', '');
                settings.set('library.hideForks', false);
              },
            },
            icon('undo', { size: 15 }),
            h('span', { text: t('library.empty.search.cta'), 'data-i18n': 'library.empty.search.cta' }),
          ),
        }),
      );
      return;
    }

    // Only re-parent the list host when it is not already mounted.
    if (body.firstChild !== listHost) mount(body, listHost);
    list.render(rows);

    // Keep previously loaded results on screen and explain the failure above them.
    if (session.state.error) listHost.parentNode.insertBefore(errorBanner(), listHost);
  }

  // First paint is synchronous; everything afterwards is debounced so a burst
  // of keystrokes in the search box does not re-render 100 cards per character.
  const render = debounce(renderNow, 30);

  /* ── Sync chrome ───────────────────────────────────────────────────── */

  function syncChrome() {
    const views = selectViews(session.state, settings.state);
    const stats = selectStats(views);

    const parts = [
      h('span', { text: t('library.counts.repos', { count: stats.total }) }),
      h('span', { class: 'text-paper-400', 'aria-hidden': 'true', text: '·' }),
      h('span', { class: 'font-semibold text-brass-700', text: t('library.counts.visible', { count: stats.visible }) }),
    ];
    if (settings.state.library.hideForks && stats.forks > 0) {
      parts.push(
        h('span', { class: 'text-paper-400', 'aria-hidden': 'true', text: '·' }),
        h('span', { class: 'text-ink-400', text: t('library.counts.forksHidden', { count: stats.forks }) }),
      );
    }
    counterEl.replaceChildren(...parts);

    // When it was fetched, and through which door.
    const syncParts = [
      h('span', {
        class: 'text-2xs text-ink-400',
        text: session.state.fetchedAt
          ? t('library.fetchedAt', { time: i18n.formatDate(session.state.fetchedAt) })
          : t('library.neverFetched'),
      }),
    ];
    if (session.state.source) {
      syncParts.push(
        h('span', {
          class: 'badge badge--neutral',
          text: t(`library.source.${session.state.source}`),
        }),
      );
    }
    syncEl.replaceChildren(...syncParts);

    searchInput.placeholder = t('library.toolbar.search.placeholder');
    searchInput.setAttribute('aria-label', t('library.toolbar.search.label'));
    sortSelect.setAttribute('aria-label', t('library.toolbar.sort.label'));

    for (const button of [bulkAll, bulkNone, bulkInvert, refreshButton]) {
      const span = button.querySelector('[data-i18n]');
      const key = span?.getAttribute('data-i18n');
      if (key) {
        setText(span, t(key));
        button.setAttribute('data-tooltip', t(key));
      }
    }
    setText(hideForksLabel.querySelector('span'), t('library.toolbar.hideForks'));

    setText(titleEl, t('library.title'));
    setText(subtitleEl, t('library.subtitle'));
    listHost.setAttribute('aria-label', t('a11y.repositoryList'));

    if (sortSelect.value !== settings.state.library.sort) sortSelect.value = settings.state.library.sort;
    if (hideForks.checked !== settings.state.library.hideForks) {
      hideForks.checked = settings.state.library.hideForks;
    }

    const empty = views.length === 0;
    for (const control of [bulkAll, bulkNone, bulkInvert, sortSelect, hideForks]) {
      control.disabled = empty;
    }
    hideForksLabel.classList.toggle('opacity-50', empty);

    const loading = session.state.status === 'loading';
    refreshButton.disabled = loading;
    refreshIcon.classList.toggle('animate-spin', loading);
  }

  /* ──────────────────────────────────────────────────────────────────── */

  const el = h(
    'section',
    { class: 'card overflow-hidden' },
    h(
      'div',
      { class: 'card-header flex-wrap' },
      h(
        'div',
        { class: 'min-w-0' },
        h('div', { class: 'flex items-center gap-2' }, h('span', { class: 'text-brass-600' }, icon('library', { size: 17 })), titleEl),
        subtitleEl,
      ),
      h('div', { class: 'flex min-w-0 flex-wrap items-center justify-end gap-2' }, counterEl, syncEl),
    ),
    h(
      'div',
      { class: 'flex flex-wrap items-center gap-2 border-b border-paper-200 bg-paper-100/60 px-3 py-2.5' },
      searchBox,
      sortSelect,
      hideForksLabel,
      h('div', { class: 'ml-auto flex items-center gap-1' }, bulkAll, bulkNone, bulkInvert, refreshButton),
    ),
    body,
  );

  const disposers = [
    i18n.onChange(() => {
      syncChrome();
      render();
    }),
    session.subscribe(['repos', 'status', 'search', 'error', 'fetchedAt', 'source'], () => {
      syncChrome();
      render();
    }),
    settings.subscribe(['repoOverrides', 'library'], () => {
      syncChrome();
      render();
    }),
  ];

  syncChrome();
  renderNow();

  return {
    el,
    /** Force a synchronous re-render (used by tests and after a language switch). */
    flush: renderNow,
    sync() {
      syncChrome();
      renderNow();
    },
    destroy() {
      for (const dispose of disposers) dispose();
      render.cancel();
      list.clear();
      clear(body);
    },
  };
}

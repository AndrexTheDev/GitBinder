/**
 * Application header.
 *
 * Layout: brand on the left, then — in the order a visitor needs them —
 * language switch, support, settings and the primary "Fetch repositories"
 * action. Everything degrades to icon-only controls below `sm`, where the
 * tooltips carry the labels.
 *
 * @module components/AppNavbar
 */

import { h, setText } from '../core/dom.js';
import { UI_EVENTS } from '../core/events.js';
import { APP_NAME } from '../config/app.js';
import { icon } from './ui/Icon.js';
import { LanguageToggle } from './LanguageToggle.js';

/**
 * @param {object} ctx
 * @param {import('../core/store.js').Store} ctx.settings
 * @param {import('../core/store.js').Store} ctx.session
 * @param {import('../core/i18n.js').I18n} ctx.i18n
 * @param {(key: string, params?: object) => string} ctx.t
 * @param {import('../core/events.js').ReturnType} ctx.bus
 */
export function AppNavbar(ctx) {
  const { settings, session, i18n, t, bus } = ctx;

  const languageToggle = LanguageToggle(ctx, { compact: false });

  /* ── Brand ─────────────────────────────────────────────────────────── */

  const wordmark = h(
    'span',
    { class: 'font-serif text-lg font-semibold tracking-tight text-ink-900', text: APP_NAME },
  );

  const tagline = h(
    'span',
    {
      class: 'hidden truncate text-xs text-ink-400 xl:block',
      'data-i18n': 'nav.brand.tagline',
      text: t('nav.brand.tagline'),
    },
  );

  const brand = h(
    'a',
    {
      href: '#main',
      class: 'group flex min-w-0 items-center gap-2.5 rounded-lg pr-2 focus-visible:outline-none',
      'aria-label': `${APP_NAME} — ${t('meta.tagline')}`,
    },
    h(
      'span',
      {
        class:
          'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.6rem] bg-ink-900 text-brass-200 shadow-card transition-transform duration-200 group-hover:-rotate-3',
      },
      icon('logo', { size: 19, strokeWidth: 1.9 }),
      // Gilded spine detail
      h('span', {
        class: 'absolute inset-y-1.5 left-[3px] w-px rounded-full bg-brass-400/70',
        'aria-hidden': 'true',
      }),
    ),
    h('span', { class: 'flex min-w-0 flex-col leading-tight' }, wordmark, tagline),
  );

  /* ── Actions ───────────────────────────────────────────────────────── */

  const supportBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn-icon group',
      'aria-label': t('a11y.openSupport'),
      'aria-haspopup': 'dialog',
      onClick: () => bus.emit(UI_EVENTS.openSupport),
    },
    h(
      'span',
      { class: 'text-ink-500 transition-colors duration-150 group-hover:text-crimson-500' },
      icon('heart', { size: 18 }),
    ),
  );

  const settingsBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn-icon',
      'aria-label': t('a11y.openSettings'),
      'aria-haspopup': 'dialog',
      onClick: () => bus.emit(UI_EVENTS.openSettings),
    },
    icon('settings', { size: 18 }),
  );

  const fetchLabel = h('span', { class: 'hidden sm:inline', text: t('nav.fetch.label') });
  const fetchLabelShort = h('span', { class: 'sm:hidden', text: t('nav.fetch.short') });
  const fetchIcon = icon('fetch', { size: 16 });

  const fetchBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-primary',
      onClick: () => bus.emit(UI_EVENTS.fetchRepos),
    },
    fetchIcon,
    fetchLabel,
    fetchLabelShort,
  );

  const actions = h(
    'div',
    { class: 'flex items-center gap-1.5 sm:gap-2' },
    languageToggle.el,
    h('span', { class: 'mx-0.5 hidden h-6 w-px bg-paper-300 sm:block', 'aria-hidden': 'true' }),
    supportBtn,
    settingsBtn,
    fetchBtn,
  );

  /* ── Shell ─────────────────────────────────────────────────────────── */

  const inner = h(
    'div',
    {
      class:
        'mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8',
    },
    brand,
    actions,
  );

  const el = h(
    'nav',
    {
      class:
        'border-b border-paper-300/80 bg-paper-50/85 backdrop-blur-md transition-shadow duration-200',
      'aria-label': t('a11y.mainNavigation'),
      'data-i18n-aria-label': 'a11y.mainNavigation',
    },
    // Brass hairline that catches the light under the header
    h('span', { class: 'gilt-rule block', 'aria-hidden': 'true' }),
    inner,
  );

  // Lift the header once the page scrolls.
  let elevated = false;
  const onScroll = () => {
    const next = window.scrollY > 4;
    if (next === elevated) return;
    elevated = next;
    el.classList.toggle('shadow-card', next);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── Sync ──────────────────────────────────────────────────────────── */

  function syncChrome() {
    brand.setAttribute('aria-label', `${APP_NAME} — ${t('meta.tagline')}`);
    supportBtn.setAttribute('aria-label', t('a11y.openSupport'));
    supportBtn.setAttribute('data-tooltip', t('nav.support.tooltip'));
    settingsBtn.setAttribute('aria-label', t('a11y.openSettings'));
    settingsBtn.setAttribute('data-tooltip', t('nav.settings.tooltip'));
    fetchBtn.setAttribute('data-tooltip', t('nav.fetch.tooltip'));
    setText(fetchLabel, t('nav.fetch.label'));
    setText(fetchLabelShort, t('nav.fetch.short'));
  }

  function syncFetchState() {
    const loading = session.state.status === 'loading';
    fetchBtn.disabled = loading;
    fetchBtn.setAttribute('aria-busy', String(loading));
    fetchBtn.classList.toggle('btn-accent', !loading && session.state.repos.length > 0);
    fetchBtn.classList.toggle('btn-primary', loading || session.state.repos.length === 0);
    fetchIcon.classList.toggle('animate-spin', loading);
    setText(fetchLabel, loading ? t('nav.fetch.loading') : t('nav.fetch.label'));
    setText(fetchLabelShort, loading ? '…' : t('nav.fetch.short'));
  }

  const disposers = [
    i18n.onChange(syncChrome),
    session.subscribe(['status', 'repos'], syncFetchState),
    () => window.removeEventListener('scroll', onScroll),
  ];

  syncChrome();
  syncFetchState();

  return {
    el,
    sync() {
      syncChrome();
      syncFetchState();
      languageToggle.sync();
    },
    destroy() {
      for (const dispose of disposers) dispose();
      languageToggle.destroy();
    },
  };
}

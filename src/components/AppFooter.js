/**
 * Application footer: provenance, the discreet info links, the privacy
 * statement and live storage usage.
 *
 * The link row is deliberately quiet — small type, no boxes, no icons except
 * the support heart. It is where you look when you need the disclaimer or the
 * contact address, and it should stay out of the way the rest of the time.
 *
 * @module components/AppFooter
 */

import { h, setText } from '../core/dom.js';
import { UI_EVENTS } from '../core/events.js';
import { APP_NAME, APP_VERSION, BRAND_MARK, BRAND_MARK_RATIO, LINKS } from '../config/app.js';
import { formatBytes } from '../utils/format.js';
import { icon } from './ui/Icon.js';

/** The info documents reachable from the footer, in order. */
const FOOTER_LINKS = Object.freeze([
  { kind: 'help', labelKey: 'info.help.footerLink' },
  { kind: 'disclaimer', labelKey: 'info.disclaimer.footerLink' },
  { kind: 'terms', labelKey: 'info.terms.footerLink' },
  { kind: 'contact', labelKey: 'info.contact.footerLink' },
]);

/**
 * @param {object} ctx
 * @param {import('../core/store.js').Store} ctx.settings
 * @param {import('../core/i18n.js').I18n} ctx.i18n
 * @param {(key: string, params?: object) => string} ctx.t
 * @param {import('../core/events.js').ReturnType} ctx.bus
 */
export function AppFooter(ctx) {
  const { settings, i18n, t, bus } = ctx;

  /* ── Info links ────────────────────────────────────────────────────── */

  /**
   * @param {string} labelKey
   * @param {() => void} onClick
   */
  function footerLink(labelKey, onClick) {
    return h(
      'li',
      null,
      h(
        'button',
        {
          type: 'button',
          class:
            'rounded text-xs font-medium text-ink-500 underline decoration-paper-400 underline-offset-2 transition-colors hover:text-brass-600 hover:decoration-brass-400',
          onClick,
        },
        h('span', { text: t(labelKey), 'data-i18n': labelKey }),
      ),
    );
  }

  const supportLabel = h('span', { text: t('footer.support'), 'data-i18n': 'footer.support' });
  const supportButton = h(
    'li',
    null,
    h(
      'button',
      {
        type: 'button',
        class:
          'inline-flex items-center gap-1 rounded text-xs font-semibold text-brass-600 underline decoration-brass-300 underline-offset-2 transition-colors hover:text-brass-700 hover:decoration-brass-500',
        onClick: () => bus.emit(UI_EVENTS.openSupport),
      },
      icon('heart', { size: 12, class: 'shrink-0' }),
      supportLabel,
    ),
  );

  const linkRow = h(
    'ul',
    { class: 'flex flex-wrap items-center gap-x-3 gap-y-1.5' },
    ...FOOTER_LINKS.map((link) => footerLink(link.labelKey, () => bus.emit(UI_EVENTS.openInfo, { kind: link.kind }))),
    supportButton,
  );

  /* ── Provenance ────────────────────────────────────────────────────── */

  const privacy = h('p', {
    class: 'flex items-center gap-1.5 text-xs font-medium text-ink-500',
    'data-i18n': 'footer.privacy',
    text: t('footer.privacy'),
  });

  const builtLine = h('p', { class: 'text-xs text-ink-400' });
  const storageLine = h('p', { class: 'flex items-center gap-1.5 text-2xs text-ink-400' });

  const sourceLink = h(
    'a',
    {
      class: 'inline-flex items-center gap-1 text-xs font-semibold text-ink-500 underline underline-offset-2 hover:text-brass-600',
      href: LINKS.repository,
      target: '_blank',
      rel: 'noopener noreferrer',
    },
    icon('github', { size: 13 }),
    h('span', { text: t('footer.source'), 'data-i18n': 'footer.source' }),
  );

  const el = h(
    'footer',
    { class: 'mt-10 border-t border-paper-300/80 bg-paper-50/70 py-6' },
    h(
      'div',
      { class: 'mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 sm:px-6 lg:px-8' },
      h(
        'div',
        { class: 'flex flex-wrap items-center justify-between gap-3' },
        h(
          'div',
          { class: 'flex items-center gap-2' },
          // The same mark as the navbar, at footer scale.
          h('img', {
            src: BRAND_MARK,
            alt: '',
            'aria-hidden': 'true',
            class: 'h-7 w-auto',
            width: String(Math.round(28 * BRAND_MARK_RATIO)),
            height: '28',
          }),
          h('span', { class: 'font-serif text-sm font-semibold text-ink-800', text: APP_NAME }),
          h('span', { class: 'text-2xs text-ink-400', text: t('footer.version', { version: APP_VERSION }) }),
        ),
        sourceLink,
      ),
      h('div', { class: 'gilt-rule' }),
      linkRow,
      h(
        'div',
        { class: 'flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between' },
        h('div', { class: 'space-y-1' }, privacy, builtLine),
        storageLine,
      ),
    ),
  );

  /* ── Sync ──────────────────────────────────────────────────────────── */

  function sync() {
    builtLine.replaceChildren(
      h('span', { text: t('footer.built', { author: settings.state.authorName || 'AndrexTheDev' }) }),
      h('span', { class: 'text-ink-300', 'aria-hidden': 'true', text: ' · ' }),
      h('span', { text: t('footer.license'), 'data-i18n': 'footer.license' }),
    );

    const info = settings.storageInfo();
    storageLine.replaceChildren(
      icon('database', { size: 11 }),
      h('span', { text: t('footer.storage', { size: formatBytes(info.bytes, i18n.locale) }) }),
    );

    setText(privacy, t('footer.privacy'));
    setText(sourceLink.querySelector('span'), t('footer.source'));
    setText(supportLabel, t('footer.support'));
  }

  const disposers = [
    i18n.onChange(sync),
    settings.subscribe(['authorName', 'customBookTitle', 'repoOverrides', 'language'], sync),
  ];

  sync();

  return {
    el,
    sync,
    destroy() {
      for (const dispose of disposers) dispose();
    },
  };
}

/**
 * Application footer: provenance, privacy statement and storage usage.
 *
 * @module components/AppFooter
 */

import { h, setText } from '../core/dom.js';
import { APP_NAME, APP_VERSION, LINKS } from '../config/app.js';
import { formatBytes } from '../utils/format.js';
import { icon } from './ui/Icon.js';

/**
 * @param {object} ctx
 * @param {import('../core/store.js').Store} ctx.settings
 * @param {import('../core/i18n.js').I18n} ctx.i18n
 * @param {(key: string, params?: object) => string} ctx.t
 */
export function AppFooter(ctx) {
  const { settings, i18n, t } = ctx;

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
          h('span', { class: 'text-brass-500' }, icon('logo', { size: 16 })),
          h('span', { class: 'font-serif text-sm font-semibold text-ink-800', text: APP_NAME }),
          h('span', { class: 'text-2xs text-ink-400', text: t('footer.version', { version: APP_VERSION }) }),
        ),
        sourceLink,
      ),
      h('div', { class: 'gilt-rule' }),
      h(
        'div',
        { class: 'flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between' },
        h('div', { class: 'space-y-1' }, privacy, builtLine),
        storageLine,
      ),
    ),
  );

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

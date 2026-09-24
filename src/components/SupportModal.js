/**
 * Support / crypto donation modal.
 *
 * GitBooklet is free, but the project still costs money to keep alive. This
 * dialog collects the ways to give something back: crypto addresses with
 * one-click copy, plus the free options (star, sponsor, report).
 *
 * Addresses come from `src/config/support.js` — the shipped values are
 * placeholders and the UI says so out loud instead of silently collecting
 * donations into a dead address.
 *
 * @module components/SupportModal
 */

import { h } from '../core/dom.js';
import { UI_EVENTS } from '../core/events.js';
import { CRYPTO_TARGETS, SUPPORT_LINKS } from '../config/support.js';
import { LINKS } from '../config/app.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { createOverlay } from './ui/Overlay.js';
import { noteBox } from './ui/Field.js';
import { icon } from './ui/Icon.js';

const PLACEHOLDER_HINTS = ['example', 'replaceme', '0x0000000000000000000000000000000000000000'];
const isPlaceholder = (address) => PLACEHOLDER_HINTS.some((hint) => address.toLowerCase().includes(hint.toLowerCase()));

/**
 * @param {object} ctx
 * @param {import('../core/i18n.js').I18n} ctx.i18n
 * @param {(key: string, params?: object) => string} ctx.t
 * @param {import('../core/events.js').ReturnType} ctx.bus
 * @param {import('./ui/Toast.js').Toaster} ctx.toaster
 */
export function SupportModal(ctx) {
  const { i18n, t, bus, toaster } = ctx;

  function buildCryptoCard(target) {
    const placeholder = isPlaceholder(target.address);
    const copyLabel = h('span', { text: t('support.crypto.copy') });

    const copyButton = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-outline shrink-0',
        disabled: placeholder,
        onClick: async () => {
          const ok = await copyToClipboard(target.address);
          toaster?.push(
            ok
              ? { tone: 'success', message: t('support.crypto.copied') }
              : { tone: 'error', message: t('errors.clipboard') },
          );
          if (!ok) return;
          copyLabel.textContent = t('common.copied');
          setTimeout(() => {
            copyLabel.textContent = i18n.t('support.crypto.copy');
          }, 1600);
        },
      },
      icon('copy', { size: 14 }),
      copyLabel,
    );

    const explorer = target.explorer
      ? h(
          'a',
          {
            class: 'inline-flex items-center gap-1 text-xs font-semibold text-ink-500 underline underline-offset-2 hover:text-brass-600',
            href: target.explorer.replace('{address}', encodeURIComponent(target.address)),
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          h('span', { text: t('support.crypto.explorer'), 'data-i18n': 'support.crypto.explorer' }),
          icon('external', { size: 12 }),
        )
      : null;

    return h(
      'li',
      { class: 'panel-inset p-3' },
      h(
        'div',
        { class: 'flex items-center justify-between gap-2' },
        h(
          'div',
          { class: 'flex min-w-0 items-center gap-2' },
          h('span', { class: `badge badge--${target.tone ?? 'neutral'}`, text: target.network ?? target.label }),
          h('span', { class: 'truncate text-sm font-semibold text-ink-800', text: target.label }),
        ),
        copyButton,
      ),
      h(
        'p',
        {
          class: 'mt-2 break-all rounded-md bg-paper-200/70 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-ink-700',
          text: target.address,
        },
      ),
      h(
        'div',
        { class: 'mt-2 flex items-center justify-between gap-2' },
        placeholder
          ? h('span', { class: 'text-2xs font-semibold uppercase tracking-wide text-ember-500', text: t('support.crypto.placeholder') })
          : explorer ?? h('span'),
      ),
    );
  }

  function buildLinkRow(link) {
    const meta = {
      star: { icon: 'star', labelKey: 'support.links.star', hintKey: 'support.links.starHint', href: SUPPORT_LINKS[0]?.href },
      sponsor: { icon: 'heart', labelKey: 'support.links.sponsor', hintKey: 'support.links.sponsorHint', href: link.href },
      issue: { icon: 'bug', labelKey: 'support.links.issue', hintKey: 'support.links.issueHint', href: link.href },
    }[link.id] ?? { icon: 'external', labelKey: link.id, hintKey: null, href: link.href };

    return h(
      'li',
      null,
      h(
        'a',
        {
          class:
            'group flex items-center gap-3 rounded-lg border border-paper-300 bg-paper-50 p-3 transition-colors hover:border-brass-300 hover:bg-brass-50',
          href: meta.href ?? LINKS.repository,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        h(
          'span',
          { class: 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper-200 text-ink-600 transition-colors group-hover:bg-brass-200 group-hover:text-brass-700' },
          icon(meta.icon, { size: 17 }),
        ),
        h(
          'span',
          { class: 'min-w-0 flex-1' },
          h('span', {
            class: 'block text-sm font-semibold text-ink-900',
            text: t(meta.labelKey),
            'data-i18n': meta.labelKey,
          }),
          meta.hintKey
            ? h('span', { class: 'mt-0.5 block text-xs leading-relaxed text-ink-500', text: t(meta.hintKey), 'data-i18n': meta.hintKey })
            : null,
        ),
        icon('collapse', { size: 16, class: 'shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5' }),
      ),
    );
  }

  const overlay = createOverlay({
    variant: 'modal',
    title: t('support.title'),
    subtitle: t('support.subtitle'),
    closeLabel: t('common.close'),
    iconName: 'heart',
    render(body) {
      body.classList.add('space-y-5');

      body.append(
        h('p', { class: 'text-sm leading-relaxed text-ink-600', text: t('support.intro'), 'data-i18n': 'support.intro' }),

        h(
          'section',
          { class: 'space-y-2.5' },
          h('h3', {
            class: 'text-2xs font-bold uppercase tracking-[0.14em] text-ink-500',
            text: t('support.crypto.title'),
            'data-i18n': 'support.crypto.title',
          }),
          h('p', { class: 'hint', text: t('support.crypto.hint'), 'data-i18n': 'support.crypto.hint' }),
          h('ul', { class: 'space-y-2.5' }, CRYPTO_TARGETS.map(buildCryptoCard)),
        ),

        h(
          'section',
          { class: 'space-y-2.5' },
          h('h3', {
            class: 'text-2xs font-bold uppercase tracking-[0.14em] text-ink-500',
            text: t('support.links.title'),
            'data-i18n': 'support.links.title',
          }),
          h('ul', { class: 'space-y-2' }, SUPPORT_LINKS.map(buildLinkRow)),
        ),

        noteBox({ t, tone: 'success', iconName: 'sparkles', textKey: 'support.free.note' }),
      );
    },
    onClose: () => bus.emit(UI_EVENTS.closeSupport),
  });

  const disposers = [
    i18n.onChange(() => {
      overlay.setTitle(t('support.title'));
      overlay.setSubtitle(t('support.subtitle'));
      overlay.setCloseLabel(t('common.close'));
    }),
    bus.on(UI_EVENTS.openSupport, () => overlay.open()),
    bus.on(UI_EVENTS.closeSupport, () => overlay.close()),
  ];

  return {
    el: overlay.el,
    open: () => overlay.open(),
    close: () => overlay.close(),
    destroy() {
      for (const dispose of disposers) dispose();
      overlay.destroy();
    },
  };
}

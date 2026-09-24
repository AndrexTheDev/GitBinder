/**
 * Support / crypto donation modal.
 *
 * GitBinder is free, but the project still costs money to keep alive. This
 * dialog collects the ways to give something back: three wallet addresses,
 * each with a scannable QR code and one-click copy, plus the free options
 * (star, sponsor, report).
 *
 * Three details that matter more than they look:
 *
 *   • **The address is never transformed.** The Ethereum address is
 *     EIP-55 checksummed — its mixed case *is* the checksum, and some wallets
 *     reject an all-lowercase copy. Nothing here lowercases, trims-for-display
 *     or "tidies up" an address; what is configured is what is shown, copied
 *     and encoded.
 *   • **The QR encodes the bare address**, not a `bitcoin:` style payment URI.
 *     A URI scans nicer in some wallets and fails in others; the bare address
 *     always works and always matches the text on screen next to it.
 *   • **Copy feedback lives on the button**, not only in a toast. A toast in
 *     the corner is easy to miss; the button flipping to "Copied!" with a check
 *     mark tells you the thing you actually pressed worked. The toast is kept
 *     as well, for screen-reader users who get the live-region announcement.
 *
 * Addresses come from `src/config/support.js`.
 *
 * @module components/SupportModal
 */

import { h } from '../core/dom.js';
import { UI_EVENTS } from '../core/events.js';
import { CRYPTO_TARGETS, SUPPORT_LINKS, isPlaceholderAddress } from '../config/support.js';
import { LINKS } from '../config/app.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { qrCodeElement } from '../utils/qrcode.js';
import { createOverlay } from './ui/Overlay.js';
import { createTabs } from './ui/Tabs.js';
import { noteBox } from './ui/Field.js';
import { icon } from './ui/Icon.js';

/** How long the copy button stays in its "Copied!" state. */
const COPIED_FEEDBACK_MS = 1800;

/**
 * @param {object} ctx
 * @param {import('../core/i18n.js').I18n} ctx.i18n
 * @param {(key: string, params?: object) => string} ctx.t
 * @param {import('../core/events.js').ReturnType} ctx.bus
 * @param {import('./ui/Toast.js').Toaster} ctx.toaster
 */
export function SupportModal(ctx) {
  const { i18n, t, bus, toaster } = ctx;

  /**
   * A copy button that reports success on itself.
   *
   * @param {string} value
   * @param {{ disabled?: boolean, size?: 'sm'|'md' }} [options]
   */
  function createCopyButton(value, { disabled = false } = {}) {
    const label = h('span', { text: t('support.crypto.copy') });
    const mark = icon('copy', { size: 14 });
    /** @type {number|null} */
    let timer = null;

    const button = h(
      'button',
      {
        type: 'button',
        class: 'btn btn-outline shrink-0',
        disabled: disabled || undefined,
        onClick: async () => {
          const ok = await copyToClipboard(value);

          toaster?.push(
            ok
              ? { tone: 'success', message: t('support.crypto.copied') }
              : { tone: 'error', message: t('errors.clipboard') },
          );
          if (!ok) return;

          button.replaceChildren(icon('check', { size: 14, class: 'text-forest-500' }), label);
          label.textContent = t('common.copied');
          button.classList.add('btn-outline--done');

          if (timer !== null) clearTimeout(timer);
          timer = setTimeout(revert, COPIED_FEEDBACK_MS);
        },
      },
      mark,
      label,
    );

    function revert() {
      timer = null;
      button.replaceChildren(mark, label);
      label.textContent = t('support.crypto.copy');
      button.classList.remove('btn-outline--done');
    }

    return {
      el: button,
      /** Re-translate and reset after a language switch. */
      sync() {
        revert();
        button.disabled = disabled;
      },
      destroy() {
        if (timer !== null) clearTimeout(timer);
      },
    };
  }

  /* ── Crypto panel: one wallet at a time ────────────────────────────── */

  const panelId = 'support-crypto-panel';
  let activeId = CRYPTO_TARGETS[0]?.id ?? null;
  /** @type {{ el: HTMLElement, sync: () => void, destroy: () => void }|null} */
  let copyControl = null;

  /** @type {HTMLElement|null} */
  let panelEl = null;

  const qrSlot = h('div', { class: 'crypto__qr' });
  const addressEl = h('p', { class: 'crypto__address' });
  const networkEl = h('p', { class: 'crypto__network' });
  const noteEl = h('p', { class: 'crypto__note' });
  const explorerSlot = h('div', { class: 'crypto__explorer' });
  const copySlot = h('div', { class: 'crypto__copy' });

  function renderPanel(target) {
    if (!target) return;

    // A tabpanel is labelled by the tab that selects it, so the association
    // has to follow the selection rather than being baked in at build time.
    panelEl?.setAttribute('aria-labelledby', `support-crypto-tab-${target.id}`);

    const placeholder = isPlaceholderAddress(target);

    // The QR is the expensive part (~6 kB of SVG path data), so it is built
    // only for the wallet the visitor actually opened.
    qrSlot.replaceChildren(
      placeholder
        ? h(
            'div',
            { class: 'crypto__qr-empty' },
            icon('alert', { size: 22 }),
            h('span', { text: t('support.crypto.placeholder') }),
          )
        : qrCodeElement(target.address, {
            size: 168,
            label: t('support.crypto.qrLabel', { coin: target.label }),
          }),
    );

    addressEl.textContent = target.address;
    networkEl.replaceChildren(
      h('span', { class: `badge badge--${target.tone ?? 'neutral'}`, text: target.ticker }),
      h('span', { text: target.network }),
    );

    noteEl.textContent = target.note ?? '';
    noteEl.hidden = !target.note;

    explorerSlot.replaceChildren(
      target.explorer
        ? h(
            'a',
            {
              class:
                'inline-flex items-center gap-1 text-xs font-semibold text-ink-500 underline underline-offset-2 hover:text-brass-600',
              href: target.explorer.replace('{address}', encodeURIComponent(target.address)),
              target: '_blank',
              rel: 'noopener noreferrer',
            },
            h('span', { text: t('support.crypto.explorer'), 'data-i18n': 'support.crypto.explorer' }),
            icon('external', { size: 12 }),
          )
        : h('span'),
    );

    copyControl?.destroy();
    copyControl = createCopyButton(target.address, { disabled: placeholder });
    copySlot.replaceChildren(copyControl.el);
  }

  /** @type {ReturnType<typeof createTabs>|null} */
  let tabs = null;

  function buildCryptoSection(body) {
    // `aria-labelledby` is set by renderPanel, which owns the active tab.
    const panel = h(
      'div',
      { class: 'panel-inset p-4', id: panelId, role: 'tabpanel', tabindex: '0' },
      h(
        'div',
        { class: 'flex flex-col gap-4 sm:flex-row sm:items-start' },
        qrSlot,
        h(
          'div',
          { class: 'min-w-0 flex-1 space-y-2.5' },
          networkEl,
          addressEl,
          copySlot,
          explorerSlot,
          noteEl,
        ),
      ),
    );

    panelEl = panel;

    tabs = createTabs({
      id: 'support-crypto',
      panelId,
      label: t('support.crypto.tablist'),
      active: activeId,
      tabs: CRYPTO_TARGETS.map((target) => ({
        id: target.id,
        label: target.ticker,
        badge: target.label,
      })),
      onChange: (id) => {
        activeId = id;
        renderPanel(CRYPTO_TARGETS.find((target) => target.id === id));
      },
    });

    body.append(
      h(
        'section',
        { class: 'space-y-2.5' },
        h('h3', {
          class: 'text-2xs font-bold uppercase tracking-[0.14em] text-ink-500',
          text: t('support.crypto.title'),
          'data-i18n': 'support.crypto.title',
        }),
        h('p', { class: 'hint', text: t('support.crypto.hint'), 'data-i18n': 'support.crypto.hint' }),
        tabs.el,
        panel,
      ),
    );
  }

  /* ── Free ways to help ─────────────────────────────────────────────── */

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

  /* ── Overlay ───────────────────────────────────────────────────────── */

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
      );

      buildCryptoSection(body);

      body.append(
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

      // Fill the panel for whichever tab is selected on open.
      renderPanel(CRYPTO_TARGETS.find((target) => target.id === (tabs?.active ?? activeId)));
    },
    onClose: () => bus.emit(UI_EVENTS.closeSupport),
  });

  const disposers = [
    i18n.onChange(() => {
      overlay.setTitle(t('support.title'));
      overlay.setSubtitle(t('support.subtitle'));
      overlay.setCloseLabel(t('common.close'));
      copyControl?.sync();
      // The QR label and the note are translated, so rebuild the open panel.
      if (overlay.isOpen()) renderPanel(CRYPTO_TARGETS.find((target) => target.id === activeId));
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
      copyControl?.destroy();
      tabs?.destroy();
      overlay.destroy();
    },
  };
}

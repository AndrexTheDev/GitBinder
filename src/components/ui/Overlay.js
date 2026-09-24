/**
 * Overlay primitive shared by the settings drawer, the support modal and any
 * confirm dialog.
 *
 * Handles the accessibility contract that is easy to get wrong:
 *   • focus is moved into the panel and trapped there while open
 *   • focus returns to the element that opened it
 *   • ESC closes, clicking the scrim closes
 *   • background scrolling is locked (with scrollbar compensation)
 *   • `aria-modal`, `role="dialog"` and a labelled-by wiring
 *   • overlays stack: only the topmost reacts to ESC
 *
 * @module components/ui/Overlay
 */

import { clear, FOCUSABLE, h, on, qs } from '../../core/dom.js';
import { icon as defaultIconFactory } from './Icon.js';

/** @type {Array<{ close: () => void }>} */
const stack = [];
let scrollLockCleanup = null;

function lockScroll() {
  if (scrollLockCleanup || typeof document === 'undefined') return;
  const { body, documentElement } = document;
  const previousOverflow = body.style.overflow;
  const previousPaddingRight = body.style.paddingRight;
  const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

  body.style.overflow = 'hidden';
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

  scrollLockCleanup = () => {
    body.style.overflow = previousOverflow;
    body.style.paddingRight = previousPaddingRight;
    scrollLockCleanup = null;
  };
}

function unlockScroll() {
  if (stack.length === 0) scrollLockCleanup?.();
}

// One global keydown handler serves the whole stack.
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || stack.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    stack.at(-1).close();
  });
}

/**
 * @param {object} options
 * @param {'drawer'|'modal'} [options.variant='modal']
 * @param {string}  options.title           translated heading text
 * @param {string}  [options.subtitle]
 * @param {string}  [options.closeLabel='Close']
 * @param {(body: HTMLElement, api: OverlayApi) => void} options.render  fills the panel body
 * @param {() => void} [options.onClose]
 * @param {HTMLElement} [options.host]      container for the overlay (defaults to #overlay-root)
 * @param {(node: Array) => SVGSVGElement} [options.iconFactory]
 * @param {string}  [options.iconName]
 * @returns {OverlayApi}
 *
 * @typedef {{ el: HTMLElement, open: () => void, close: () => void, destroy: () => void,
 *             isOpen: () => boolean, setFooter: (node: any) => void, setTitle: (text: string) => void,
 *             body: HTMLElement }} OverlayApi
 */
export function createOverlay(options) {
  const {
    variant = 'modal',
    title = '',
    subtitle = '',
    closeLabel = 'Close',
    render,
    onClose,
    host = typeof document !== 'undefined' ? qs('#overlay-root') ?? document.body : null,
    iconName = null,
    // Callers pass only `iconName`; without a default here the header icon is
    // silently dropped (the icon markup is gated on `iconName && iconFactory`),
    // which is how every overlay in the app lost its badge.
    iconFactory = defaultIconFactory,
  } = options;

  let returnFocusTo = null;
  let open = false;
  /** @type {Array<() => void>} */
  const disposers = [];

  const titleEl = h('h2', {
    id: `overlay-title-${Math.random().toString(36).slice(2, 8)}`,
    class: 'font-serif text-lg font-semibold text-ink-900',
    text: title,
  });

  const subtitleEl = subtitle
    ? h('p', { class: 'mt-0.5 text-sm text-ink-500', text: subtitle })
    : null;

  const closeBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn-icon shrink-0',
      'aria-label': closeLabel,
      'data-tooltip': closeLabel,
      onClick: () => api.close(),
    },
    iconFactory?.('close', { size: 18 }) ?? '✕',
  );

  const header = h(
    'header',
    {
      class:
        'flex items-start justify-between gap-3 border-b border-paper-300 bg-paper-50/80 px-5 py-4 backdrop-blur',
    },
    h(
      'div',
      { class: 'flex min-w-0 items-start gap-3' },
      iconName && iconFactory
        ? h(
            'span',
            { class: 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-brass-200' },
            iconFactory(iconName, { size: 18 }),
          )
        : null,
      h('div', { class: 'min-w-0' }, titleEl, subtitleEl),
    ),
    closeBtn,
  );

  const body = h('div', { class: 'scroll-thin flex-1 overflow-y-auto px-5 py-4' });

  const footer = h('footer', {
    class: 'hidden items-center justify-end gap-2 border-t border-paper-300 bg-paper-50/80 px-5 py-3',
  });

  const panel = h(
    'div',
    {
      class: variant === 'drawer' ? 'drawer animate-slide-in-right' : 'modal animate-scale-in',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleEl.id,
      tabindex: '-1',
    },
    header,
    body,
    footer,
  );

  const scrim = h('div', {
    class: 'overlay-scrim animate-fade-in',
    onClick: () => api.close(),
    'aria-hidden': 'true',
  });

  // Wrapper only exists so scrim + panel can be attached/detached as one unit.
  // No `display: contents` here: that would out-specify the UA `[hidden]` rule
  // and leave the overlay visible while it is supposed to be closed.
  const el = h('div', { hidden: true }, scrim, panel);

  /* Focus management ---------------------------------------------------- */

  disposers.push(
    on(panel, 'keydown', (event) => {
      if (event.key !== 'Tab') return;

      const focusables = [...panel.querySelectorAll(FOCUSABLE)].filter(
        (node) => !node.hasAttribute('data-overlay-skip') && node.getClientRects().length > 0,
      );

      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }),
  );

  /* API ------------------------------------------------------------------ */

  const api = {
    el,
    body,

    isOpen: () => open,

    open() {
      if (open) return api;
      returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      clear(body);
      render?.(body, api);

      el.hidden = false;
      host?.append(el);
      lockScroll();
      stack.push(api);

      // Focus the panel first so the transition does not fight the caret.
      requestAnimationFrame(() => {
        const target = qs('[data-autofocus]', panel) ?? qs(FOCUSABLE, panel);
        (target ?? panel).focus({ preventScroll: true });
      });

      open = true;
      return api;
    },

    close() {
      if (!open) return api;
      open = false;
      const index = stack.indexOf(api);
      if (index >= 0) stack.splice(index, 1);
      unlockScroll();

      el.remove();
      returnFocusTo?.focus?.({ preventScroll: true });
      returnFocusTo = null;
      onClose?.();
      return api;
    },

    destroy() {
      api.close();
      for (const dispose of disposers.splice(0)) dispose();
      el.remove();
    },

    setTitle(text) {
      titleEl.textContent = text;
      return api;
    },

    setSubtitle(text) {
      if (subtitleEl) subtitleEl.textContent = text;
      return api;
    },

    setCloseLabel(text) {
      closeBtn.setAttribute('aria-label', text);
      closeBtn.setAttribute('data-tooltip', text);
      return api;
    },

    /** Show (and fill) the sticky footer, or hide it when `nodes` is empty. */
    setFooter(...nodes) {
      clear(footer);
      const content = nodes.flat().filter(Boolean);
      footer.classList.toggle('hidden', content.length === 0);
      footer.classList.toggle('flex', content.length > 0);
      if (content.length) footer.append(...content);
      return api;
    },
  };

  return api;
}

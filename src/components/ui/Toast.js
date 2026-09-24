/**
 * Toast notifications.
 *
 * A single host element (`#toast-root`) renders a stack of transient messages.
 * Announced through the `role="status"` region already present in index.html,
 * auto-dismissed, manually closable, and paused while the pointer hovers.
 *
 * @module components/ui/Toast
 */

import { h, on } from '../../core/dom.js';
import { icon } from './Icon.js';

const TONES = Object.freeze({
  info: { icon: 'info', className: 'toast--info', accent: 'text-azure-500' },
  success: { icon: 'success', className: 'toast--success', accent: 'text-forest-500' },
  warning: { icon: 'warning', className: 'toast--warning', accent: 'text-ember-500' },
  error: { icon: 'error', className: 'toast--error', accent: 'text-crimson-500' },
});

const DEFAULT_TIMEOUT = 4200;

/**
 * @param {object} [deps]
 * @param {HTMLElement} [deps.host]   defaults to `#toast-root`
 * @param {{ close?: string }} [deps.labels]
 */
export function createToaster(deps = {}) {
  const host = deps.host ?? document.querySelector('#toast-root') ?? document.body;
  const closeLabel = deps.labels?.close ?? 'Dismiss';

  host.classList.add(
    'pointer-events-none',
    'fixed',
    'bottom-0',
    'right-0',
    'z-[60]',
    'flex',
    'w-full',
    'max-w-sm',
    'flex-col',
    'gap-2',
    'p-4',
    'sm:p-5',
  );

  /** @type {Map<string, { el: HTMLElement, timer: number|null }>} */
  const active = new Map();

  function dismiss(id) {
    const entry = active.get(id);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    active.delete(id);

    entry.el.style.transition = 'opacity .16s ease, transform .16s ease';
    entry.el.style.opacity = '0';
    entry.el.style.transform = 'translateY(6px)';
    setTimeout(() => entry.el.remove(), 180);
  }

  function schedule(entry, timeout) {
    if (!Number.isFinite(timeout) || timeout <= 0) return;
    entry.timer = setTimeout(() => dismiss(entry.id), timeout);
  }

  /**
   * @param {object} toast
   * @param {string} toast.message                      body text
   * @param {string} [toast.title]                      optional bold heading
   * @param {'info'|'success'|'warning'|'error'} [toast.tone='info']
   * @param {number} [toast.timeout=4200]                ms, `0` keeps it sticky
   * @param {{ label: string, onClick: () => void }} [toast.action]
   * @returns {() => void} disposer
   */
  function push({ message, title, tone = 'info', timeout = DEFAULT_TIMEOUT, action } = {}) {
    const config = TONES[tone] ?? TONES.info;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const textBlock = h(
      'div',
      { class: 'min-w-0 flex-1' },
      title ? h('p', { class: 'text-sm font-semibold text-ink-900', text: title }) : null,
      h('p', { class: ['text-sm text-ink-600', title ? 'mt-0.5' : null], text: message }),
      action
        ? h(
            'button',
            {
              type: 'button',
              class: 'mt-2 text-sm font-semibold text-brass-600 underline underline-offset-2 hover:text-brass-700',
              onClick: () => {
                action.onClick?.();
                dismiss(id);
              },
              text: action.label,
            },
          )
        : null,
    );

    const el = h(
      'div',
      { class: ['toast pointer-events-auto', config.className], role: tone === 'error' ? 'alert' : 'status' },
      h('span', { class: ['mt-0.5 shrink-0', config.accent] }, icon(config.icon, { size: 17 })),
      textBlock,
      h(
        'button',
        {
          type: 'button',
          class: '-mr-1 -mt-1 shrink-0 rounded-md p-1 text-ink-400 hover:bg-paper-200 hover:text-ink-800',
          'aria-label': closeLabel,
          onClick: () => dismiss(id),
        },
        icon('close', { size: 15 }),
      ),
    );

    const entry = { id, el, timer: null };
    active.set(id, entry);

    // Pause auto-dismiss while the pointer is over the toast.
    disposers(el, entry);

    host.append(el);

    // Keep the stack readable: at most four toasts at a time.
    const ids = [...active.keys()];
    if (ids.length > 4) dismiss(ids[0]);

    schedule(entry, timeout);
    return () => dismiss(id);
  }

  function disposers(el, entry) {
    on(el, 'mouseenter', () => {
      if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = null;
      }
    });
    on(el, 'mouseleave', () => schedule(entry, 1800));
  }

  return {
    push,
    dismiss,
    clearAll: () => [...active.keys()].forEach(dismiss),
    info: (message, options) => push({ ...options, message, tone: 'info' }),
    success: (message, options) => push({ ...options, message, tone: 'success' }),
    warning: (message, options) => push({ ...options, message, tone: 'warning' }),
    error: (message, options) => push({ ...options, message, tone: 'error', timeout: 6500 }),
    get count() {
      return active.size;
    },
  };
}

/** @typedef {ReturnType<typeof createToaster>} Toaster */

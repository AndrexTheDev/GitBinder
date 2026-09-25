/**
 * Promise-based confirm dialog built on the shared overlay primitive.
 *
 * Native `window.confirm()` is blocking, unstyled and cannot be translated
 * consistently — the settings drawer needs "are you sure?" for two destructive
 * actions, so we ship our own.
 *
 * @module components/ui/Confirm
 */

import { h } from '../../core/dom.js';
import { createOverlay } from './Overlay.js';
import { icon } from './Icon.js';

/**
 * @param {object} options
 * @param {(key: string, params?: object) => string} options.t
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} [options.confirmLabel]
 * @param {string} [options.cancelLabel]
 * @param {'danger'|'warning'|'neutral'} [options.tone='danger']
 * @param {string} [options.iconName]
 * @returns {Promise<boolean>}
 */
export function confirmDialog(options) {
  const {
    t,
    title,
    message,
    confirmLabel,
    cancelLabel,
    tone = 'danger',
    iconName = tone === 'danger' ? 'trash' : 'warning',
  } = options;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const tones = {
      danger: 'bg-crimson-100 text-crimson-700',
      warning: 'bg-ember-100 text-ember-700',
      neutral: 'bg-paper-200 text-ink-600',
    };

    const overlay = createOverlay({
      variant: 'modal',
      title,
      closeLabel: cancelLabel ?? t('common.cancel'),
      iconName: null,
      onClose: () => finish(false),
      render(body, api) {
        body.append(
          h(
            'div',
            { class: 'flex gap-3' },
            h(
              'span',
              { class: ['flex h-10 w-10 shrink-0 items-center justify-center rounded-full', tones[tone] ?? tones.danger] },
              icon(iconName, { size: 18 }),
            ),
            h('p', { class: 'pt-1.5 text-sm leading-relaxed text-ink-600', text: message }),
          ),
        );

        api.setFooter(
          h(
            'button',
            { type: 'button', class: 'btn btn-ghost', 'data-autofocus': '', onClick: () => api.close() },
            cancelLabel ?? t('common.cancel'),
          ),
          h(
            'button',
            {
              type: 'button',
              class: tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary',
              onClick: () => {
                finish(true);
                api.close();
              },
            },
            confirmLabel ?? t('common.confirm'),
          ),
        );
      },
    });

    overlay.open();
  });
}

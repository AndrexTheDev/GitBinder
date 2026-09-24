/**
 * Language toggle (EN ⇄ DE).
 *
 * Writing `settings.language` is the *only* thing this component does. The
 * store notifies the i18n instance, which rewrites every `data-i18n` binding
 * in the document and tells subscribed components to re-render their dynamic
 * strings. One source of truth, instant switch, no page reload.
 *
 * @module components/LanguageToggle
 */

import { h } from '../core/dom.js';
import { LANGUAGES } from '../i18n/index.js';
import { UI_EVENTS } from '../core/events.js';
import { icon } from './ui/Icon.js';

/**
 * @param {object} ctx
 * @param {import('../core/store.js').Store} ctx.settings
 * @param {import('../core/i18n.js').I18n} ctx.i18n
 * @param {(key: string, params?: object) => string} ctx.t
 * @param {import('../core/events.js').ReturnType} [ctx.bus]
 * @param {{ compact?: boolean }} [options]
 */
export function LanguageToggle(ctx, options = {}) {
  const { settings, i18n, t, bus } = ctx;
  const { compact = false } = options;

  /** @type {Map<string, HTMLButtonElement>} */
  const buttons = new Map();

  const group = h(
    'div',
    {
      class: 'segmented',
      role: 'group',
      'aria-label': t('a11y.languageSwitch'),
      'data-i18n-aria-label': 'a11y.languageSwitch',
    },
    LANGUAGES.map((language) => {
      const button = h(
        'button',
        {
          type: 'button',
          class: 'segmented__option',
          'aria-pressed': 'false',
          'data-lang': language.code,
          'data-tooltip': language.nativeLabel,
          title: language.nativeLabel,
          onClick: () => select(language.code),
        },
        h('span', { 'aria-hidden': 'true', text: language.label }),
        h('span', { class: 'sr-only', text: language.nativeLabel }),
      );
      buttons.set(language.code, button);
      return button;
    }),
  );

  const el = compact
    ? group
    : h(
        'div',
        { class: 'flex items-center gap-1.5' },
        h('span', { class: 'hidden text-ink-400 sm:inline-flex' }, icon('language', { size: 16 })),
        group,
      );

  function select(code) {
    if (settings.state.language === code) return;
    settings.set('language', code);
    bus?.emit(UI_EVENTS.toast, {
      tone: 'info',
      message: i18n.t('toasts.language.changed', {
        language: LANGUAGES.find((language) => language.code === code)?.nativeLabel ?? code,
      }),
      timeout: 2600,
    });
  }

  function sync() {
    const active = settings.state.language;
    for (const [code, button] of buttons) {
      const meta = LANGUAGES.find((language) => language.code === code);
      button.setAttribute('aria-pressed', String(code === active));
      if (meta) {
        button.setAttribute('data-tooltip', meta.nativeLabel);
        button.setAttribute('title', meta.nativeLabel);
      }
    }
    group.setAttribute('aria-label', t('a11y.languageSwitch'));
  }

  const disposers = [settings.subscribe('language', sync), i18n.onChange(sync)];

  sync();

  return {
    el,
    sync,
    destroy() {
      for (const dispose of disposers) dispose();
    },
  };
}

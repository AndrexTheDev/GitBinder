/**
 * The screen a visitor with a content blocker sees instead of the app.
 *
 * Deliberately a *notice* and not a scolding: it says what was detected, why
 * the app is unavailable, and offers a button that re-runs the check so
 * somebody who has just switched their blocker off does not have to hunt for
 * a reload. If the re-check comes back clean the app boots normally.
 *
 * @module components/AdBlockNotice
 */

import { APP_NAME, LINKS } from '../config/app.js';
import { h } from '../core/dom.js';
import { icon } from './ui/Icon.js';

/**
 * @param {object} ctx
 * @param {Document} ctx.host
 * @param {(key: string, params?: object) => string} ctx.t
 * @param {() => Promise<{ blocked: boolean, signals: string[] }>} ctx.recheck
 * @param {() => void} ctx.onUnblocked
 */
export function AdBlockNotice(ctx) {
  const { host, t, recheck, onUnblocked } = ctx;

  const status = h('p', {
    class: 'adblock-notice__status',
    role: 'status',
    'aria-live': 'polite',
    text: t('adblock.hint'),
  });

  let checking = false;

  const retry = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-accent',
      onClick: async () => {
        if (checking) return;
        checking = true;
        retry.setAttribute('aria-busy', 'true');
        status.textContent = t('adblock.checking');

        let verdict = { blocked: true, signals: [] };
        try {
          verdict = await recheck();
        } catch {
          /* a failed check is not evidence of a blocker — stay put */
        }

        checking = false;
        retry.removeAttribute('aria-busy');

        if (verdict.blocked) {
          status.textContent = t('adblock.stillBlocked');
          return;
        }
        onUnblocked();
      },
    },
    icon('reset', { size: 15 }),
    h('span', { text: t('adblock.retry') }),
  );

  const el = h(
    'div',
    {
      class: 'adblock-notice',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'adblock-title',
      'aria-describedby': 'adblock-lead',
    },
    h(
      'div',
      { class: 'adblock-notice__card' },
      h('span', { class: 'adblock-notice__badge' }, icon('shield', { size: 26 })),
      h('h1', {
        id: 'adblock-title',
        class: 'adblock-notice__title',
        text: t('adblock.title', { app: APP_NAME }),
      }),
      h('p', { id: 'adblock-lead', class: 'adblock-notice__lead', text: t('adblock.lead') }),
      h('p', { class: 'adblock-notice__body', text: t('adblock.body') }),
      h(
        'ol',
        { class: 'adblock-notice__steps' },
        ...['step1', 'step2', 'step3'].map((key) =>
          h('li', { text: t(`adblock.${key}`) }),
        ),
      ),
      status,
      h(
        'div',
        { class: 'adblock-notice__actions' },
        retry,
        h(
          'a',
          {
            class: 'btn btn-outline',
            href: LINKS.repository ?? 'https://github.com/AndrexTheDev/GitBinder',
            rel: 'noopener noreferrer',
            target: '_blank',
          },
          icon('external', { size: 15 }),
          h('span', { text: t('adblock.learnMore') }),
        ),
      ),
      h('p', { class: 'adblock-notice__foot', text: t('adblock.foot') }),
    ),
  );

  host.append(el);

  return {
    el,
    destroy() {
      el.remove();
    },
  };
}

/**
 * Help, Disclaimer, Terms and Contact overlays.
 *
 * Four small dialogs reached from the footer. They share one shape — a titled
 * overlay whose body is a handful of prose sections — so they are generated
 * from a table rather than written out four times, and adding a fifth is a
 * matter of adding an entry.
 *
 * Content lives in the dictionaries (`info.*`), not here: the brief asks for
 * bilingual legal text, and translated prose has no business being embedded in
 * a component.
 *
 * The overlays are created lazily on first open, so mounting this component
 * costs nothing until somebody actually asks for one.
 *
 * @module components/InfoModals
 */

import { h } from '../core/dom.js';
import { UI_EVENTS } from '../core/events.js';
import { APP_NAME, DEVELOPER, LINKS } from '../config/app.js';
import { createOverlay } from './ui/Overlay.js';
import { noteBox } from './ui/Field.js';
import { icon } from './ui/Icon.js';

/** The three steps of the usage guide, in order. */
export const HELP_STEPS = Object.freeze(['connect', 'curate', 'print']);

/** Section keys per document, in the order they should read. */
export const INFO_SECTIONS = Object.freeze({
  disclaimer: ['clientSide', 'token', 'noWarranty', 'donations', 'thirdParty'],
  terms: ['scope', 'noAccount', 'yourData', 'noWarranty', 'openSource', 'changes'],
});

/**
 * @param {object} ctx
 * @param {import('../core/i18n.js').I18n} ctx.i18n
 * @param {(key: string, params?: object) => string} ctx.t
 * @param {import('../core/events.js').ReturnType} ctx.bus
 */
export function InfoModals(ctx) {
  const { i18n, t, bus } = ctx;

  /* ── Body builders ─────────────────────────────────────────────────── */

  /** A titled prose section. */
  function section(key) {
    return h(
      'section',
      { class: 'space-y-1' },
      h('h3', {
        class: 'text-sm font-semibold text-ink-900',
        text: t(`${key}.title`),
        'data-i18n': `${key}.title`,
      }),
      h('p', {
        class: 'text-sm leading-relaxed text-ink-600',
        text: t(`${key}.body`),
        'data-i18n': `${key}.body`,
      }),
    );
  }

  function buildHelp(body) {
    body.append(
      h(
        'ol',
        { class: 'space-y-3' },
        HELP_STEPS.map((step, index) =>
          h(
            'li',
            { class: 'flex gap-3' },
            h(
              'span',
              {
                class:
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-900 font-serif text-sm font-semibold text-brass-200',
                'aria-hidden': 'true',
              },
              String(index + 1),
            ),
            h(
              'div',
              { class: 'min-w-0 space-y-0.5' },
              h('h3', {
                class: 'text-sm font-semibold text-ink-900',
                text: t(`info.help.steps.${step}.title`),
                'data-i18n': `info.help.steps.${step}.title`,
              }),
              h('p', {
                class: 'text-sm leading-relaxed text-ink-600',
                text: t(`info.help.steps.${step}.body`),
                'data-i18n': `info.help.steps.${step}.body`,
              }),
            ),
          ),
        ),
      ),
      noteBox({ t, tone: 'info', iconName: 'info', textKey: 'info.help.tip' }),
    );
  }

  function buildProseDoc(kind, body) {
    const keys = INFO_SECTIONS[kind] ?? [];
    body.append(
      h('p', {
        class: 'text-sm leading-relaxed text-ink-600',
        text: t(`info.${kind}.intro`),
        'data-i18n': `info.${kind}.intro`,
      }),
      h('div', { class: 'space-y-3.5' }, keys.map((key) => section(`info.${kind}.sections.${key}`))),
    );
  }

  function buildContact(body) {
    const emailHref = `mailto:${DEVELOPER.email}`;

    body.append(
      h('p', {
        class: 'text-sm leading-relaxed text-ink-600',
        text: t('info.contact.intro', { app: APP_NAME, author: DEVELOPER.name }),
        'data-i18n': 'info.contact.intro',
      }),

      h(
        'div',
        { class: 'panel-inset flex items-center gap-3 p-3.5' },
        h(
          'span',
          { class: 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-brass-200' },
          icon('user', { size: 18 }),
        ),
        h(
          'div',
          { class: 'min-w-0' },
          h('p', { class: 'text-sm font-semibold text-ink-900', text: DEVELOPER.name }),
          h(
            'a',
            {
              class:
                'mt-0.5 block truncate font-mono text-xs text-ink-600 underline underline-offset-2 hover:text-brass-600',
              href: emailHref,
            },
            DEVELOPER.email,
          ),
        ),
      ),

      h(
        'ul',
        { class: 'space-y-2' },
        ...[
          { iconName: 'github', labelKey: 'info.contact.github', hintKey: 'info.contact.githubHint', href: DEVELOPER.url },
          { iconName: 'bug', labelKey: 'info.contact.issue', hintKey: 'info.contact.issueHint', href: LINKS.issues },
          { iconName: 'heart', labelKey: 'info.contact.support', hintKey: 'info.contact.supportHint', href: null },
        ].map((row) =>
          h(
            'li',
            null,
            h(
              row.href ? 'a' : 'button',
              {
                ...(row.href
                  ? { href: row.href, target: '_blank', rel: 'noopener noreferrer' }
                  : { type: 'button', onClick: () => bus.emit(UI_EVENTS.openSupport) }),
                class:
                  'group flex w-full items-center gap-3 rounded-lg border border-paper-300 bg-paper-50 p-3 text-left transition-colors hover:border-brass-300 hover:bg-brass-50',
              },
              h(
                'span',
                { class: 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper-200 text-ink-600 transition-colors group-hover:bg-brass-200 group-hover:text-brass-700' },
                icon(row.iconName, { size: 17 }),
              ),
              h(
                'span',
                { class: 'min-w-0 flex-1' },
                h('span', {
                  class: 'block text-sm font-semibold text-ink-900',
                  text: t(row.labelKey),
                  'data-i18n': row.labelKey,
                }),
                h('span', {
                  class: 'mt-0.5 block text-xs leading-relaxed text-ink-500',
                  text: t(row.hintKey),
                  'data-i18n': row.hintKey,
                }),
              ),
              icon('collapse', { size: 16, class: 'shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5' }),
            ),
          ),
        ),
      ),

      noteBox({
        t,
        tone: 'warning',
        iconName: 'alert',
        textKey: 'info.contact.noSupport',
      }),
    );
  }

  /* ── Overlay registry ──────────────────────────────────────────────── */

  /** @type {Map<string, ReturnType<typeof createOverlay>>} */
  const overlays = new Map();

  /** @type {Record<string, { iconName: string, build: (body: HTMLElement) => void }>} */
  const DOCS = {
    help: { iconName: 'help', build: buildHelp },
    disclaimer: { iconName: 'disclaimer', build: (body) => buildProseDoc('disclaimer', body) },
    terms: { iconName: 'terms', build: (body) => buildProseDoc('terms', body) },
    contact: { iconName: 'contact', build: buildContact },
  };

  function overlayFor(kind) {
    const existing = overlays.get(kind);
    if (existing) return existing;

    const doc = DOCS[kind];
    if (!doc) return null;

    const overlay = createOverlay({
      variant: 'modal',
      title: t(`info.${kind}.title`),
      subtitle: t(`info.${kind}.subtitle`),
      closeLabel: t('common.close'),
      iconName: doc.iconName,
      render(body) {
        body.classList.add('space-y-4');
        doc.build(body);
      },
    });

    overlays.set(kind, overlay);
    return overlay;
  }

  function open(kind) {
    overlayFor(kind)?.open();
  }

  function close(kind) {
    overlays.get(kind)?.close();
  }

  const disposers = [
    bus.on(UI_EVENTS.openInfo, (payload) => open(payload?.kind)),
    i18n.onChange(() => {
      for (const [kind, overlay] of overlays) {
        overlay.setTitle(t(`info.${kind}.title`));
        overlay.setSubtitle(t(`info.${kind}.subtitle`));
        overlay.setCloseLabel(t('common.close'));
      }
    }),
  ];

  return {
    el: null,
    open,
    close,
    openHelp: () => open('help'),
    openDisclaimer: () => open('disclaimer'),
    openTerms: () => open('terms'),
    openContact: () => open('contact'),
    destroy() {
      for (const dispose of disposers) dispose();
      for (const overlay of overlays.values()) overlay.destroy();
      overlays.clear();
    },
  };
}

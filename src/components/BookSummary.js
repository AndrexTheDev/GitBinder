/**
 * Book summary sidebar.
 *
 * A live, miniature version of the document the PDF composer will produce:
 * cover metadata, table of contents, and the counters that decide whether the
 * "compose book" action is enabled.
 *
 * @module components/BookSummary
 */

import { h, setText } from '../core/dom.js';
import { UI_EVENTS } from '../core/events.js';
import { REPO_STATUSES } from '../config/app.js';
import { resolveBookAuthor, resolveBookTitle } from '../book/compose.js';
import { selectChapters, selectStats, selectViews } from '../state/selectors.js';
import { formatCompact } from '../utils/format.js';
import { icon } from './ui/Icon.js';
import { noteBox } from './ui/Field.js';

const MAX_TOC_ENTRIES = 8;

/**
 * @param {object} ctx
 * @param {import('../core/store.js').Store} ctx.settings
 * @param {import('../core/store.js').Store} ctx.session
 * @param {import('../core/i18n.js').I18n} ctx.i18n
 * @param {(key: string, params?: object) => string} ctx.t
 * @param {import('../core/events.js').ReturnType} ctx.bus
 */
export function BookSummary(ctx) {
  const { settings, session, i18n, t, bus } = ctx;

  /* ── Cover ─────────────────────────────────────────────────────────── */

  const coverTitle = h('h3', { class: 'font-serif text-lg font-semibold leading-snug text-ink-900' });
  const coverAuthor = h('p', { class: 'mt-1 flex items-center gap-1.5 text-sm text-ink-600' });
  const coverEmail = h('p', { class: 'mt-0.5 flex items-center gap-1.5 text-xs text-ink-500' });
  const coverEdition = h('p', { class: 'mt-3 text-2xs uppercase tracking-[0.14em] text-ink-400' });

  const cover = h(
    'div',
    {
      class:
        'relative overflow-hidden rounded-lg border border-paper-300 bg-gradient-to-b from-paper-50 to-paper-200 px-5 py-6 text-center shadow-card',
    },
    h('span', { class: 'absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brass-300 via-brass-500 to-brass-300', 'aria-hidden': 'true' }),
    h('span', { class: 'mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-brass-200' }, icon('crown', { size: 18 })),
    coverTitle,
    h('span', { class: 'mx-auto my-3 block h-px w-16 bg-brass-300', 'aria-hidden': 'true' }),
    coverAuthor,
    coverEmail,
    coverEdition,
  );

  /* ── Stats ─────────────────────────────────────────────────────────── */

  function statTile(iconName, labelKey) {
    const value = h('dd', { class: 'font-serif text-lg font-semibold tabular-nums text-ink-900' });
    const label = h('dt', {
      class: 'text-2xs font-semibold uppercase tracking-[0.1em] text-ink-400',
      text: t(labelKey),
      'data-i18n': labelKey,
    });
    return { el: h('div', { class: 'panel-inset px-3 py-2.5 text-center' }, value, label), value };
  }

  const tiles = {
    chapters: statTile('book', 'summary.stats.chapters'),
    hidden: statTile('eyeOff', 'summary.stats.hidden'),
    languages: statTile('code', 'summary.stats.languages'),
    stars: statTile('star', 'summary.stats.stars'),
  };

  const statsGrid = h(
    'dl',
    { class: 'grid grid-cols-2 gap-2' },
    tiles.chapters.el,
    tiles.hidden.el,
    tiles.languages.el,
    tiles.stars.el,
  );

  /** "3 Live · 7 In Development · …" — how the chapters break down by status. */
  const statusLegend = h('ul', { class: 'flex flex-wrap gap-1.5' });

  /* ── Table of contents ─────────────────────────────────────────────── */

  const tocList = h('ol', { class: 'space-y-1' });

  const tocHeading = h('h3', {
    class: 'text-2xs font-bold uppercase tracking-[0.14em] text-ink-500',
    text: t('summary.chapters.title'),
    'data-i18n': 'summary.chapters.title',
  });

  /* ── Actions ───────────────────────────────────────────────────────── */

  const buildLabel = h('span', { text: t('summary.actions.build') });
  const buildButton = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-accent w-full',
      onClick: () => bus.emit(UI_EVENTS.buildPdf),
    },
    icon('printer', { size: 16 }),
    buildLabel,
  );

  const printButton = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-outline w-full',
      onClick: () => bus.emit(UI_EVENTS.printBook),
    },
    icon('printer', { size: 15 }),
    h('span', { text: t('summary.actions.print'), 'data-i18n': 'summary.actions.print' }),
  );

  const editButton = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-ghost w-full',
      onClick: () => bus.emit(UI_EVENTS.openSettings),
    },
    icon('settings', { size: 15 }),
    h('span', { text: t('summary.actions.editMeta'), 'data-i18n': 'summary.actions.editMeta' }),
  );

  const hintBox = noteBox({ t, tone: 'info', iconName: 'info', textKey: 'summary.build.ready' });

  /* ── Shell ─────────────────────────────────────────────────────────── */

  const titleEl = h('h2', {
    id: 'summary-title',
    class: 'card-title',
    text: t('summary.title'),
    'data-i18n': 'summary.title',
  });

  const subtitleEl = h('p', {
    class: 'mt-0.5 text-xs text-ink-500',
    text: t('summary.subtitle'),
    'data-i18n': 'summary.subtitle',
  });

  const el = h(
    'section',
    { class: 'card overflow-hidden' },
    h(
      'div',
      { class: 'card-header' },
      h(
        'div',
        { class: 'min-w-0' },
        h('div', { class: 'flex items-center gap-2' }, h('span', { class: 'text-brass-600' }, icon('feather', { size: 16 })), titleEl),
        subtitleEl,
      ),
    ),
    h(
      'div',
      { class: 'space-y-4 p-4' },
      cover,
      statsGrid,
      statusLegend,
      h('div', { class: 'space-y-2' }, tocHeading, tocList),
      h('div', { class: 'space-y-2' }, buildButton, printButton, editButton),
      hintBox,
      h('p', { class: 'text-2xs leading-relaxed text-ink-400', text: t('summary.tip'), 'data-i18n': 'summary.tip' }),
    ),
  );

  /* ── Sync ──────────────────────────────────────────────────────────── */

  function sync() {
    const state = settings.state;
    const views = selectViews(session.state, state);
    const chapters = selectChapters(views);
    const stats = selectStats(views);

    setText(coverTitle, resolveBookTitle(state, t));

    coverAuthor.replaceChildren(
      icon('user', { size: 13, class: 'shrink-0 text-ink-400' }),
      h('span', { class: 'truncate', text: resolveBookAuthor(state, t) }),
    );

    coverEmail.replaceChildren(
      icon('mail', { size: 12, class: 'shrink-0 text-ink-400' }),
      h('span', { class: 'truncate', text: state.authorEmail || t('summary.email.fallback') }),
    );

    setText(coverEdition, t('summary.edition', { year: new Date().getFullYear() }));

    setText(tiles.chapters.value, i18n.formatNumber(chapters.length));
    setText(tiles.hidden.value, i18n.formatNumber(stats.hidden));
    setText(tiles.languages.value, i18n.formatNumber(stats.languages));
    setText(tiles.stars.value, formatCompact(stats.stars, i18n.locale));

    // Only statuses that actually occur, in book order.
    statusLegend.replaceChildren(
      ...REPO_STATUSES.filter((entry) => (stats.byStatus[entry.id] ?? 0) > 0).map((entry) =>
        h(
          'li',
          { class: `badge badge--${entry.tone}` },
          h('span', { text: i18n.formatNumber(stats.byStatus[entry.id]) }),
          h('span', { text: t(`status.${entry.id}`), 'data-i18n': `status.${entry.id}` }),
        ),
      ),
    );

    // Table of contents
    if (chapters.length === 0) {
      tocList.replaceChildren(
        h('li', {
          class: 'rounded-md bg-paper-100 px-3 py-4 text-center text-xs text-ink-400',
          text: t('summary.chapters.empty'),
          'data-i18n': 'summary.chapters.empty',
        }),
      );
    } else {
      const shown = chapters.slice(0, MAX_TOC_ENTRIES);
      tocList.replaceChildren(
        ...shown.map((chapter) =>
          h(
            'li',
            { class: 'flex items-baseline gap-2 text-xs' },
            h('span', { class: 'w-5 shrink-0 text-right font-mono text-[10px] text-ink-300', text: String(chapter.chapter) }),
            h('span', { class: 'min-w-0 flex-1 truncate text-ink-700', text: chapter.name, title: chapter.shortDescription || '' }),
            h('span', {
              class: `badge badge--${chapter.tone} shrink-0`,
              text: t(`status.${chapter.status}`),
            }),
          ),
        ),
        chapters.length > shown.length
          ? h('li', {
              class: 'pt-0.5 pl-7 text-2xs font-medium text-ink-400',
              text: t('summary.chapters.more', { count: chapters.length - shown.length }),
            })
          : null,
      );
    }

    const hasChapters = chapters.length > 0;
    // Never disabled: a disabled button cannot explain itself. The click is
    // answered with a toast telling the visitor what to do instead.
    buildButton.setAttribute(
      'title',
      hasChapters ? t('summary.actions.build') : t('summary.build.noChapters'),
    );

    setText(buildLabel, t('summary.actions.build'));
    setText(titleEl, t('summary.title'));
    setText(subtitleEl, t('summary.subtitle'));
  }

  const disposers = [
    i18n.onChange(sync),
    session.subscribe(['repos', 'status'], sync),
    settings.subscribe(['customBookTitle', 'authorName', 'authorEmail', 'repoOverrides'], sync),
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

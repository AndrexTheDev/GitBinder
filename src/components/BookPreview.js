/**
 * Book studio: the live preview and the print trigger.
 *
 * Two pieces of UI, one source of truth:
 *
 *   • **The sticky action bar** (`#book-bar-root`) is always with the visitor —
 *     it toggles the preview and fires the print dialog.
 *   • **The preview** (`#book-root`) renders the *real* book DOM through the
 *     real print stylesheet at true A4 size. What is on screen is what the PDF
 *     will contain; nothing is simulated.
 *
 * Recomposition is rAF-coalesced and skipped entirely while the preview is
 * collapsed, so typing in a description textarea does not rebuild a 60-page
 * document on every keystroke. `print()` always composes synchronously first —
 * the printer must never snapshot a stale or empty book.
 *
 * @module components/BookPreview
 */

import { h, setAttr, setText } from '../core/dom.js';
import { UI_EVENTS } from '../core/events.js';
import { createPrintController } from '../services/print.js';
import { composeBook } from '../book/compose.js';
import { paginateBook } from '../book/paginate.js';
import { renderBook } from '../book/template.js';
import { selectChapters, selectViews } from '../state/selectors.js';
import { icon } from './ui/Icon.js';

/**
 * @param {object} ctx
 * @param {import('../core/store.js').Store} ctx.settings
 * @param {import('../core/store.js').Store} ctx.session
 * @param {import('../core/i18n.js').I18n} ctx.i18n
 * @param {(key: string, params?: object) => string} ctx.t
 * @param {import('../core/events.js').ReturnType} ctx.bus
 * @param {import('./ui/Toast.js').Toaster} ctx.toaster
 * @param {Document} [ctx.host]
 */
export function BookPreview(ctx) {
  const { settings, session, i18n, t, bus, toaster } = ctx;
  const doc = ctx.host ?? document;

  const printController = createPrintController({
    canPrint: () => currentChapters().length > 0,
    onRefuse: () => toaster.push({ tone: 'warning', message: t('book.print.empty') }),
  });

  /* ── Preview shell ────────────────────────────────────────────────── */

  const pageCount = h('strong', { class: 'tabular-nums text-paper-50' });
  const chapterCount = h('strong', { class: 'tabular-nums text-paper-50' });

  const hideButton = h(
    'button',
    { type: 'button', class: 'btn btn-ghost text-paper-100 hover:bg-white/10', onClick: () => setPreview(false) },
    icon('collapse', { size: 15 }),
    h('span', { text: t('book.bar.hide'), 'data-i18n': 'book.bar.hide' }),
  );

  const toolbar = h(
    'div',
    { class: 'book-shell__toolbar' },
    h(
      'div',
      { class: 'flex items-center gap-2' },
      h('span', { class: 'text-brass-300' }, icon('book', { size: 16 })),
      h('p', { class: 'text-sm font-semibold', text: t('book.bar.title'), 'data-i18n': 'book.bar.title' }),
    ),
    h(
      'p',
      { class: 'text-xs text-paper-300/80' },
      pageCount,
      h('span', { text: ' · ' }),
      chapterCount,
    ),
    hideButton,
  );

  /** The book itself — replaced wholesale on every recomposition. */
  const bookHost = h('div', { class: 'book-scroll-host' });

  const scrollArea = h('div', { class: 'book-shell__scroll' }, bookHost);

  const el = h(
    'section',
    { class: 'book-shell', 'aria-labelledby': 'book-studio-title' },
    h('h2', { id: 'book-studio-title', class: 'sr-only', text: t('book.bar.title'), 'data-i18n': 'book.bar.title' }),
    toolbar,
    scrollArea,
  );

  /* ── Sticky action bar ────────────────────────────────────────────── */

  const barMeta = h('p', { class: 'text-2xs text-ink-500' });

  const toggleIcon = icon('eye', { size: 16 });
  const toggleLabel = h('span', { text: t('book.bar.preview'), 'data-i18n': 'book.bar.preview' });
  const toggleButton = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-outline',
      'aria-pressed': 'false',
      onClick: () => setPreview(!isOpen()),
    },
    toggleIcon,
    toggleLabel,
  );

  const generateLabel = h('span', { text: t('book.bar.generate'), 'data-i18n': 'book.bar.generate' });
  const generateButton = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-accent',
      onClick: () => bus.emit(UI_EVENTS.printBook),
    },
    icon('printer', { size: 16 }),
    generateLabel,
  );

  const barEl = h(
    'div',
    { class: 'book-bar no-print', role: 'region', 'aria-label': t('book.bar.title') },
    h(
      'div',
      { class: 'book-bar__inner' },
      h(
        'div',
        { class: 'flex min-w-0 items-center gap-2.5' },
        h('span', { class: 'hidden shrink-0 text-brass-500 sm:block' }, icon('feather', { size: 18 })),
        h(
          'div',
          { class: 'min-w-0' },
          h('p', { class: 'truncate text-sm font-semibold text-ink-900', text: t('book.bar.title'), 'data-i18n': 'book.bar.title' }),
          barMeta,
        ),
      ),
      h('div', { class: 'flex shrink-0 items-center gap-2' }, toggleButton, generateButton),
    ),
  );

  /* ── Composition ──────────────────────────────────────────────────── */

  /** @type {ReturnType<typeof composeBook>|null} */
  let book = null;
  /** @type {number|null} */
  let frame = null;
  /**
   * Bumped by every composition. A queued frame whose token is stale means the
   * book was already rebuilt synchronously (a toggle, a print) — rebuilding it
   * again would be pure waste.
   */
  let composeToken = 0;
  /**
   * Page and chapter totals for the action bar. Kept separate from `book`
   * because the bar is visible while the preview is collapsed: the numbers come
   * from the pagination maths alone (sub-millisecond for a hundred repos), so
   * the visitor always sees a real page count without paying for a render.
   */
  let counts = { pages: 0, chapters: 0 };

  function currentChapters() {
    return selectChapters(selectViews(session.state, settings.state, { now: Date.now() }));
  }

  /**
   * Build the book model and swap it into the preview.
   * Safe to call at any time; cheap enough to run synchronously before print.
   */
  function compose() {
    composeToken += 1;
    if (frame !== null) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      frame = null;
    }

    const chapters = currentChapters();
    book = composeBook({
      chapters,
      settings: settings.state,
      i18n,
      t,
      now: new Date(),
    });

    const next = renderBook(book, { t });
    next.setAttribute('lang', settings.state.language ?? i18n.locale);
    bookHost.replaceChildren(next);

    counts = { chapters: book.meta.stats.projects, pages: book.totalPages };
    syncChrome();
    return book;
  }

  /**
   * Recompute the counters without touching the DOM. Pagination is pure
   * arithmetic, so this stays cheap even for a hundred repositories.
   */
  function measure() {
    const chapters = currentChapters();
    counts = { chapters: chapters.length, pages: paginateBook(chapters).totalPages };
    return counts;
  }

  /**
   * Rebuild on the next frame, coalescing bursts (every keystroke in a
   * description textarea lands here) and skipping entirely while the preview
   * is collapsed — a 60-page document must not be rebuilt for nothing.
   */
  function scheduleCompose() {
    if (frame !== null) return;
    const token = composeToken;
    if (typeof requestAnimationFrame !== 'function') return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (token === composeToken && isOpen()) compose();
    });
  }

  function isOpen() {
    return settings.state.book?.preview === true;
  }

  function setPreview(open) {
    if (isOpen() === open) {
      if (open) scrollToPreview();
      return;
    }
    settings.set('book', { ...settings.state.book, preview: open });
    if (open) {
      compose();
      scrollToPreview();
    }
  }

  function scrollToPreview() {
    const target = el ?? bookHost;
    if (typeof target?.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /** Compose now (even if the preview is closed) and open the print dialog. */
  function print() {
    const chapters = currentChapters();
    if (chapters.length === 0) {
      toaster.push({ tone: 'warning', message: t('book.print.empty') });
      return false;
    }

    const opened = printController.print({
      title: settings.state.customBookTitle,
      before: () => compose(),
    });

    if (opened) {
      toaster.push({ tone: 'info', message: t('book.print.ready'), timeout: 6000 });
    }
    return opened;
  }

  /* ── Chrome sync ──────────────────────────────────────────────────── */

  function syncChrome() {
    const totalPages = counts.pages;
    const chapters = counts.chapters;

    setText(pageCount, t('book.bar.pages', { count: totalPages }));
    setText(chapterCount, t('book.bar.chapters', { count: chapters }));
    setText(barMeta, `${t('book.bar.pages', { count: totalPages })} · ${t('book.bar.chapters', { count: chapters })}`);

    const open = isOpen();
    setAttr(el, 'hidden', open ? null : '');
    setAttr(toggleButton, 'aria-pressed', open ? 'true' : 'false');
    toggleButton.replaceChildren(icon(open ? 'eyeOff' : 'eye', { size: 16 }), toggleLabel);
    setText(toggleLabel, t('book.bar.preview'));
    setText(generateLabel, t('book.bar.generate'));
  }

  function sync() {
    measure();
    syncChrome();
    scheduleCompose();
  }

  /* ── Wiring ───────────────────────────────────────────────────────── */

  doc.body?.classList.add('has-book-bar');

  const disposers = [
    i18n.onChange(() => {
      syncChrome();
      if (isOpen()) compose();
    }),
    session.subscribe(['repos', 'status'], sync),
    settings.subscribe(['customBookTitle', 'authorName', 'authorEmail', 'authorBio', 'repoOverrides', 'language', 'book'], sync),
    bus.on(UI_EVENTS.printBook, () => print()),
    bus.on(UI_EVENTS.buildPdf, () => {
      const chapters = currentChapters();
      if (chapters.length === 0) {
        toaster.push({ tone: 'warning', message: t('book.print.empty') });
        return;
      }
      setPreview(true);
      toaster.push({ tone: 'success', message: t('book.bar.built', { pages: book?.totalPages ?? 0 }) });
    }),
    bus.on(UI_EVENTS.toggleBookPreview, (payload) => setPreview(payload?.open ?? !isOpen())),
  ];

  measure();
  syncChrome();

  return {
    el,
    barEl,
    get book() {
      return book;
    },
    compose,
    print,
    setPreview,
    isOpen,
    sync,
    destroy() {
      for (const dispose of disposers) dispose();
      if (frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      frame = null;
      printController.dispose();
      doc.body?.classList.remove('has-book-bar');
    },
  };
}

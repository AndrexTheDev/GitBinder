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
import { EXPORT_FORMATS, buildTextExport } from '../book/export.js';
import { downloadFile } from '../utils/file.js';
import { paginateBook } from '../book/paginate.js';
import { renderBook } from '../book/template.js';
import { selectChapters, selectViews } from '../state/selectors.js';
import { humanizeRepoName } from '../utils/format.js';
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

  /* ── Chapter picker ───────────────────────────────────────────────────
     Ticking projects directly where the book is made, rather than sending the
     visitor back up to the library to find the right card. Same store path as
     the library's own checkbox, so the two views can never disagree. */

  const pickerCount = h('span', { class: 'tabular-nums' });
  const pickerList = h('div', {
    class: 'book-picker__list',
    role: 'group',
    'aria-label': t('book.picker.title'),
  });

  const pickerPanel = h(
    'div',
    { class: 'book-picker', hidden: true },
    h(
      'div',
      { class: 'book-picker__head' },
      h('p', {
        class: 'text-xs font-semibold text-ink-900',
        text: t('book.picker.title'),
        'data-i18n': 'book.picker.title',
      }),
      h(
        'div',
        { class: 'ml-auto flex items-center gap-1' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn-icon',
            title: t('book.picker.all'),
            'aria-label': t('book.picker.all'),
            onClick: () => setAllChapters(true),
          },
          icon('selectAll', { size: 14 }),
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn-icon',
            title: t('book.picker.none'),
            'aria-label': t('book.picker.none'),
            onClick: () => setAllChapters(false),
          },
          icon('selectNone', { size: 14 }),
        ),
      ),
    ),
    pickerList,
  );

  const pickerButton = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-ghost book-picker__toggle',
      'aria-haspopup': 'true',
      'aria-expanded': 'false',
      onClick: () => (pickerPanel.hidden ? openPicker() : closePicker()),
    },
    icon('listChecks', { size: 15 }),
    h('span', { text: t('book.picker.button'), 'data-i18n': 'book.picker.button' }),
    pickerCount,
    icon('chevronDown', { size: 13, class: 'opacity-70' }),
  );

  const pickerWrap = h('div', { class: 'book-picker-wrap' }, pickerButton, pickerPanel);

  function openPicker() {
    renderPicker();
    pickerPanel.hidden = false;
    pickerButton.setAttribute('aria-expanded', 'true');
    doc.addEventListener('pointerdown', onPickerOutsidePress, true);
    doc.addEventListener('keydown', onPickerKeydown, true);
  }

  function closePicker({ restoreFocus = false } = {}) {
    if (pickerPanel.hidden) return;
    pickerPanel.hidden = true;
    pickerButton.setAttribute('aria-expanded', 'false');
    doc.removeEventListener('pointerdown', onPickerOutsidePress, true);
    doc.removeEventListener('keydown', onPickerKeydown, true);
    if (restoreFocus) pickerButton.focus?.();
  }

  function onPickerOutsidePress(event) {
    if (!pickerWrap.contains(event.target)) closePicker();
  }

  function onPickerKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    closePicker({ restoreFocus: true });
  }

  /** One checkbox per fetched repository, in the library's order. */
  function renderPicker() {
    const views = selectViews(session.state, settings.state, { now: Date.now() });
    pickerList.replaceChildren(
      ...views.map((repo) => {
        const id = `book-pick-${repo.slug.replace(/[^a-z0-9]+/gi, '-')}`;
        const box = h('input', {
          type: 'checkbox',
          class: 'checkbox',
          id,
          checked: repo.visible,
          'aria-label': t('library.row.includeLabel', { name: repo.name }),
          onChange: (event) => setChapterVisible(repo.slug, event.target.checked),
        });
        return h(
          'label',
          { class: 'book-picker__row', for: id, dataset: { slug: repo.slug } },
          box,
          h('span', { class: 'book-picker__name', text: humanizeRepoName(repo.name) }),
          // Deliberately not a `.book-chip`: those are sized for paper and
          // read their colours from the `.book` scope, neither of which
          // applies here in the toolbar.
          h('span', {
            class: `book-picker__status book-picker__status--${repo.tone}`,
            text: t(`status.${repo.status}`),
          }),
        );
      }),
    );
    if (views.length === 0) {
      pickerList.append(
        h('p', { class: 'book-picker__empty', text: t('book.picker.empty') }),
      );
    }
    syncPickerCount();
  }

  function syncPickerCount() {
    const views = selectViews(session.state, settings.state, { now: Date.now() });
    const visible = views.filter((repo) => repo.visible).length;
    setText(pickerCount, `${visible}/${views.length}`);
  }

  /** Mirrors the library's patch shape so both write the same override. */
  function setChapterVisible(slug, visible) {
    const current = settings.state.repoOverrides[slug] ?? {};
    settings.set(['repoOverrides', slug], {
      ...current,
      visible,
      updatedAt: new Date().toISOString(),
    });
    syncPickerCount();
  }

  function setAllChapters(visible) {
    const views = selectViews(session.state, settings.state, { now: Date.now() });
    if (views.length === 0) return;
    settings.batch(() => {
      for (const repo of views) {
        const current = settings.state.repoOverrides[repo.slug] ?? {};
        settings.state.repoOverrides[repo.slug] = {
          ...current,
          visible,
          updatedAt: new Date().toISOString(),
        };
      }
    });
    renderPicker();
  }

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
    h('div', { class: 'ml-auto flex items-center gap-2' }, pickerWrap, hideButton),
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

  /* ── Text export menu ─────────────────────────────────────────────────
     Markdown, plain text and CSV. A menu rather than three buttons: the
     action bar has to stay usable on a phone, and the formats are a
     secondary action next to "Generate PDF". */

  const exportLabel = h('span', {
    class: 'hidden sm:inline',
    text: t('export.title'),
    'data-i18n': 'export.title',
  });

  const exportMenu = h('div', {
    class: 'book-export__menu',
    role: 'menu',
    'aria-label': t('export.title'),
    // `hidden` is a DOM property here, not an attribute: `hidden: ''` would
    // assign `el.hidden = ''`, which coerces to `false` and leaves the menu
    // wide open on load.
    hidden: true,
  });

  for (const format of EXPORT_FORMATS) {
    exportMenu.append(
      h(
        'button',
        {
          type: 'button',
          class: 'book-export__item',
          role: 'menuitem',
          dataset: { format: format.id },
          onClick: () => {
            closeExportMenu();
            exportAs(format.id);
          },
        },
        icon(format.id === 'csv' ? 'table' : 'fileText', { size: 14 }),
        h('span', { text: t(`export.${format.id}`) }),
        h('span', { class: 'book-export__ext', text: `.${format.extension}` }),
      ),
    );
  }

  const exportButton = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-outline',
      'aria-haspopup': 'true',
      'aria-expanded': 'false',
      title: t('export.title'),
      onClick: () => (exportMenu.hidden ? openExportMenu() : closeExportMenu()),
    },
    icon('download', { size: 16 }),
    exportLabel,
    icon('chevronDown', { size: 14, class: 'book-export__caret' }),
  );

  const exportWrap = h(
    'div',
    { class: 'book-export' },
    exportButton,
    exportMenu,
  );

  function openExportMenu() {
    exportMenu.hidden = false;
    exportButton.setAttribute('aria-expanded', 'true');
    doc.addEventListener('pointerdown', onOutsidePress, true);
    doc.addEventListener('keydown', onMenuKeydown, true);
    exportMenu.querySelector('[role=menuitem]')?.focus?.();
  }

  function closeExportMenu({ restoreFocus = false } = {}) {
    if (exportMenu.hidden) return;
    exportMenu.hidden = true;
    exportButton.setAttribute('aria-expanded', 'false');
    doc.removeEventListener('pointerdown', onOutsidePress, true);
    doc.removeEventListener('keydown', onMenuKeydown, true);
    if (restoreFocus) exportButton.focus?.();
  }

  function onOutsidePress(event) {
    if (!exportWrap.contains(event.target)) closeExportMenu();
  }

  function onMenuKeydown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeExportMenu({ restoreFocus: true });
    }
  }

  /**
   * Download the book as text. Composes first if needed — the visitor may
   * never have opened the preview, and exporting an empty book would be a
   * bug rather than a feature.
   */
  function exportAs(format) {
    const chapters = currentChapters();
    if (chapters.length === 0) {
      toaster.push({ tone: 'warning', message: t('export.empty') });
      return false;
    }

    const result = buildTextExport(format, {
      settings: settings.state,
      chapters,
      t,
      locale: i18n.locale,
    });
    downloadFile(result.filename, result.content, result.mime);

    const label = t(`export.${format}`);
    toaster.push({ tone: 'success', message: t('export.done', { format: label }) });
    return true;
  }

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
      h('div', { class: 'flex shrink-0 items-center gap-2' }, exportWrap, toggleButton, generateButton),
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

    // The menu is rebuilt lazily from i18n, so refresh its labels in place
    // rather than tearing the buttons down mid-interaction.
    setText(exportLabel, t('export.title'));
    exportButton.setAttribute('title', t('export.title'));
    for (const item of exportMenu.querySelectorAll('[role=menuitem]')) {
      const id = item.dataset.format;
      setText(item.querySelector('span'), t(`export.${id}`));
    }

    // The picker mirrors library state, so it has to follow it — including a
    // language change, which relabels the status chips and the aria labels.
    setText(pickerButton.querySelector('span'), t('book.picker.button'));
    if (!pickerPanel.hidden) renderPicker();
    else syncPickerCount();
  }

  function sync() {
    measure();
    syncChrome();
    scheduleCompose();
  }

  /* ── Wiring ───────────────────────────────────────────────────────── */

  doc.body?.classList.add('has-book-bar');

  const disposers = [
    () => {
      closeExportMenu();
      closePicker();
    },
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

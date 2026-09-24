/**
 * Classic Book — DOM template.
 *
 * Renders the plain model produced by `compose.js` into a stack of
 * `<section class="book-page">` elements, one per physical sheet:
 *
 *   page 1            cover
 *   pages 2 … n       table of contents, grouped by project status
 *   pages n+1 … end    the project catalogue, 1–2 projects per page
 *
 * Each section is exactly one page tall (`height: <content height>` +
 * `break-after: page`), and the running header/footer are absolutely positioned
 * *inside* that section, hanging into the sheet margin. That is a deliberate
 * choice over `position: fixed` (which Chromium repeats on every sheet, but
 * cannot be suppressed on the cover) or `@page` margin boxes with
 * `content: string(…)` (only Prince/WeasyPrint support them): because we own
 * the pagination, we can simply omit the runners on the cover and print the
 * page number as text we already know.
 *
 * @module book/template
 */

import { h } from '../core/dom.js';
import { safeUrl } from '../utils/format.js';

/** Ornamental divider — three brass lozenges, the sort of thing a title page has. */
function ornament() {
  return h(
    'div',
    { class: 'book-ornament', 'aria-hidden': 'true' },
    h('span', { class: 'book-ornament__line' }),
    h('span', { class: 'book-ornament__dot' }),
    h('span', { class: 'book-ornament__line' }),
  );
}

/**
 * Running header + footer for a page. Omitted entirely on the cover.
 * @param {{ meta: object, number: number }} options
 */
function runners({ meta, number }) {
  return [
    h(
      'header',
      { class: 'book-run book-run--head' },
      h('span', { class: 'book-run__title', text: meta.title }),
    ),
    h(
      'footer',
      { class: 'book-run book-run--foot' },
      h('span', { class: 'book-run__left', text: meta.authorLine }),
      h('span', { class: 'book-run__center', text: String(number) }),
      h(
        'span',
        { class: 'book-run__right' },
        // Spelled out in full, the way the brief asks for it:
        // "Generated with GitBooklet (https://gitbinder.pages.dev)".
        h('span', { class: 'book-run__attr', text: `${meta.attributionLabel} (` }),
        h('a', { class: 'book-run__link', href: safeUrl(meta.attributionUrl, '#'), text: meta.attributionUrl }),
        h('span', { class: 'book-run__parens', text: ')' }),
      ),
    ),
  ];
}

/**
 * One physical sheet.
 * @param {{ number: number, meta: object, className?: string, children: any[], bare?: boolean }} options
 */
function page({ number, meta, className = '', children = [], bare = false }) {
  return h(
    'section',
    {
      class: ['book-page', className],
      dataset: { page: String(number) },
      'aria-label': meta.pageLabel.replace('{page}', String(number)),
    },
    bare ? null : runners({ meta, number }),
    h('div', { class: 'book-page__body' }, ...children),
  );
}

/* -------------------------------------------------------------------------- *
 * Cover
 * -------------------------------------------------------------------------- */

function coverPage(book) {
  const { meta, cover } = book;
  const contact = meta.contact
    ? h('a', { class: 'book-cover__contact', href: safeUrl(`mailto:${meta.contact}`, '#'), text: meta.contact })
    : null;

  return page({
    number: cover.number,
    meta,
    className: 'book-page--cover',
    bare: true,
    children: [
      h(
        'div',
        { class: 'book-cover' },
        h('p', { class: 'book-cover__brand', text: meta.appName }),
        h(
          'div',
          { class: 'book-cover__frame' },
          h('h1', { class: 'book-cover__title', text: meta.title }),
          h('p', { class: 'book-cover__subtitle', text: meta.subtitle }),
          ornament(),
          h('p', { class: 'book-cover__byline', text: meta.byline }),
          h('p', { class: 'book-cover__author', text: meta.author }),
          contact,
          h('p', { class: 'book-cover__bio', text: meta.bio }),
        ),
        h(
          'div',
          { class: 'book-cover__colophon' },
          h('p', { class: 'book-cover__stats', text: meta.statsLine }),
          h('p', { class: 'book-cover__date', text: meta.generatedAtLabel }),
          h(
            'p',
            { class: 'book-cover__attribution' },
            h('span', { text: meta.attributionLabel }),
            h('a', { href: safeUrl(meta.attributionUrl, '#'), text: meta.attributionHost }),
          ),
        ),
      ),
    ],
  });
}

/* -------------------------------------------------------------------------- *
 * Table of contents
 * -------------------------------------------------------------------------- */

function tocEntryRow(entry, t) {
  return h(
    'li',
    { class: 'book-toc__entry', dataset: { slug: entry.slug } },
    h('span', { class: 'book-toc__index', text: String(entry.index).padStart(2, '0') }),
    h('span', { class: 'book-toc__title', text: entry.title }),
    entry.language
      ? h('span', { class: 'book-toc__lang', text: entry.language })
      : h('span', { class: 'book-toc__lang book-toc__lang--empty', text: '—' }),
    h('span', { class: 'book-toc__leader', 'aria-hidden': 'true' }),
    h('span', {
      class: 'book-toc__page',
      text: String(entry.page),
      'data-toc-page': String(entry.page),
    }),
    h('span', { class: 'sr-only', text: t('book.toc.pageLabel', { page: entry.page }) }),
  );
}

function tocGroup(group, t) {
  return h(
    'div',
    { class: 'book-toc__group' },
    h(
      'h3',
      { class: 'book-toc__group-head' },
      h('span', { class: `book-chip book-chip--${group.tone}`, text: group.continued ? group.labelContinued : group.label }),
      h('span', { class: 'book-toc__count', text: String(group.entries.length) }),
    ),
    h('ul', { class: 'book-toc__list' }, group.entries.map((entry) => tocEntryRow(entry, t))),
  );
}

function tocPages(book, t) {
  const { toc } = book;

  return toc.pages.map((tocPage) =>
    page({
      number: tocPage.number,
      meta: book.meta,
      className: 'book-page--toc',
      children: [
        h('h2', {
          class: tocPage.isFirst ? 'book-h2' : 'book-h2 book-h2--cont',
          text: tocPage.isFirst ? toc.title : toc.continuedTitle,
        }),
        book.isEmpty && tocPage.isFirst ? h('p', { class: 'book-empty', text: toc.empty }) : null,
        ...tocPage.groups.map((group) => tocGroup(group, t)),
      ],
    }),
  );
}

/* -------------------------------------------------------------------------- *
 * Project catalogue
 * -------------------------------------------------------------------------- */

function metaCell({ label, value }) {
  return h(
    'div',
    { class: 'book-meta__cell' },
    h('dt', { class: 'book-meta__label', text: label }),
    h('dd', { class: 'book-meta__value', text: value }),
  );
}

function entryArticle(entry, t) {
  return h(
    'article',
    {
      class: ['book-entry', entry.isFullPage ? 'book-entry--full' : 'book-entry--shared'],
      dataset: { slug: entry.slug, status: entry.status },
    },
    h(
      'header',
      { class: 'book-entry__head' },
      h('p', { class: 'book-entry__kicker', text: t('book.entry.chapter', { index: entry.indexLabel }) }),
      h('h2', { class: 'book-entry__title', text: entry.title }),
      h(
        'p',
        { class: 'book-entry__badges' },
        h('span', { class: `book-chip book-chip--${entry.tone}`, text: entry.statusLabel }),
        entry.language ? h('span', { class: 'book-chip book-chip--lang', text: entry.language }) : null,
        entry.isFork ? h('span', { class: 'book-chip book-chip--quiet', text: t('book.entry.forkNote') }) : null,
        entry.isArchived
          ? h('span', { class: 'book-chip book-chip--quiet', text: t('book.entry.archivedNote') })
          : null,
      ),
    ),

    h(
      'dl',
      { class: 'book-meta' },
      metaCell({ label: t('book.entry.stars'), value: entry.starsLabel }),
      metaCell({ label: t('book.entry.forks'), value: entry.forksLabel }),
      metaCell({ label: t('book.entry.updated'), value: entry.updatedAtLabel }),
      entry.license ? metaCell({ label: t('book.entry.license'), value: entry.license }) : null,
    ),

    h('p', { class: 'book-entry__desc', text: entry.description }),

    entry.topics.length
      ? h(
          'p',
          { class: 'book-entry__topics' },
          ...entry.topics.map((topic) => h('span', { class: 'book-topic', text: `#${topic}` })),
        )
      : null,

    entry.links.length
      ? h(
          'ul',
          { class: 'book-links' },
          ...entry.links.map((link) =>
            h(
              'li',
              { class: 'book-links__item' },
              h(
                'a',
                {
                  class: `book-link book-link--${link.kind}`,
                  href: safeUrl(link.url, '#'),
                  rel: 'noopener noreferrer',
                  target: '_blank',
                },
                h('span', { class: 'book-link__label', text: link.label }),
                h('span', { class: 'book-link__url', text: link.url }),
              ),
            ),
          ),
        )
      : null,
  );
}

function catalogPages(book, t) {
  return book.pages.map((catalogPage) =>
    page({
      number: catalogPage.number,
      meta: book.meta,
      className: 'book-page--catalog',
      children: catalogPage.entries.map((entry) => entryArticle(entry, t)),
    }),
  );
}

/* -------------------------------------------------------------------------- *
 * Public API
 * -------------------------------------------------------------------------- */

/**
 * Render a composed book into a detached element.
 *
 * @param {ReturnType<import('./compose.js').composeBook>} book
 * @param {{ t: (key: string, params?: object) => string }} options
 * @returns {HTMLElement} `<div class="book">` holding every page section
 */
export function renderBook(book, { t } = {}) {
  const translate = t ?? ((key) => key);

  return h(
    'div',
    {
      class: 'book',
      id: 'book',
      dataset: { pages: String(book.totalPages), chapters: String(book.meta.stats.projects) },
    },
    coverPage(book),
    ...tocPages(book, translate),
    ...catalogPages(book, translate),
  );
}

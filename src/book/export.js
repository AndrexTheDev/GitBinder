/**
 * Text exports for the composed book.
 *
 * The PDF is the showpiece, but it is not the only thing somebody wants: a
 * Markdown version drops straight into a README or a wiki, plain text opens
 * anywhere including a terminal, and CSV is what people actually use when
 * they want to sort, filter or hand the list to someone else.
 *
 * Each format is a pure function over the same inputs `composeBook()` gets,
 * so an export always matches the book you are looking at on screen.
 *
 * Notes are exported in every format, and — like in the PDF — an empty note
 * still produces a writable gap rather than nothing, so the exported file is
 * usable as a working document rather than only as a snapshot.
 *
 * @module book/export
 */

import { APP_NAME } from '../config/app.js';
import { BOOK_LIMITS } from '../config/book.js';
import { humanizeRepoName, slugifyTitle } from '../utils/format.js';

/**
 * @typedef {object} ExportFormat
 * @property {'markdown'|'text'|'csv'} id
 * @property {string} extension
 * @property {string} mime
 */

/** @type {ExportFormat[]} */
export const EXPORT_FORMATS = Object.freeze([
  { id: 'markdown', extension: 'md', mime: 'text/markdown;charset=utf-8' },
  { id: 'text', extension: 'txt', mime: 'text/plain;charset=utf-8' },
  { id: 'csv', extension: 'csv', mime: 'text/csv;charset=utf-8' },
]);

/* -------------------------------------------------------------------------- *
 * Shared helpers
 * -------------------------------------------------------------------------- */

/**
 * The text written into a notes field when the visitor has not filled one in.
 * Blank ruled lines in the PDF, dotted lines in text — always *something*,
 * because the point of the field is to be filled in later.
 *
 * @param {string} marker  the character used to draw the line
 */
export function emptyNotePlaceholder(marker = '.', lines = BOOK_LIMITS.noteLines) {
  return Array.from({ length: lines }, () => marker.repeat(48)).join('\n');
}

/** @returns {string} the notes text, or a writable placeholder when empty */
function noteBody(notes, marker) {
  const raw = typeof notes === 'string' ? notes.trim() : '';
  return raw || emptyNotePlaceholder(marker);
}

/** Groups chapters by status, preserving the book's ordering. */
function groupByStatus(chapters, t) {
  /** @type {Map<string, object[]>} */
  const groups = new Map();
  for (const chapter of chapters) {
    const label = t(`status.${chapter.status}`);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(chapter);
  }
  return [...groups.entries()].map(([label, entries]) => ({ label, entries }));
}

function meta(settings, t) {
  return {
    title: (settings?.customBookTitle || '').trim() || t('book.cover.fallbackTitle'),
    author: (settings?.authorName || '').trim() || t('book.cover.fallbackAuthor'),
    contact: (settings?.authorContact || '').trim(),
    date: settings?.generatedAt ? new Date(settings.generatedAt) : new Date(),
  };
}

/* -------------------------------------------------------------------------- *
 * Markdown
 * -------------------------------------------------------------------------- */

/** @returns {string} a Markdown document */
export function toMarkdown({ settings, chapters, t, locale }) {
  const { title, author, contact, date } = meta(settings, t);
  const lines = [];

  lines.push(`# ${title}`, '');
  lines.push(`*${t('book.cover.subtitle')}*`, '');
  lines.push(`**${author}**${contact ? ` · ${contact}` : ''}`, '');
  lines.push(`*${t('book.cover.generatedOn', { date: formatDate(date, locale) })}*`, '');
  lines.push('---', '');

  lines.push(`## ${t('book.toc.title')}`, '');
  for (const group of groupByStatus(chapters, t)) {
    lines.push(`**${group.label}**`, '');
    for (const entry of group.entries) {
      lines.push(
        `- ${String(entry.chapter).padStart(2, '0')} — [${humanizeRepoName(entry.name)}](#${anchor(entry.slug)})`,
      );
    }
    lines.push('');
  }
  lines.push('---', '');

  chapters.forEach((entry, index) => {
    lines.push(`## ${index + 1}. ${humanizeRepoName(entry.name)}`, '');
    lines.push(`*${entry.slug}*`, '');

    const chips = [t(`status.${entry.status}`)];
    if (entry.language) chips.push(entry.language);
    if (entry.isFork) chips.push(t('book.entry.forkNote'));
    lines.push(chips.map((chip) => `\`${chip}\``).join(' · '), '');
    lines.push(
      `- **${t('book.entry.stars')}:** ${entry.stars ?? 0}`,
      `- **${t('book.entry.forks')}:** ${entry.forks ?? 0}`,
      `- **${t('book.entry.updated')}:** ${entry.updatedAt ? formatDate(entry.updatedAt, locale) : t('common.unknown')}`,
    );
    if (entry.license?.spdx_id || entry.license?.name) {
      lines.push(`- **${t('book.entry.license')}:** ${entry.license.spdx_id ?? entry.license.name}`);
    }
    lines.push('');

    const description = (entry.shortDescription || entry.description || '').trim();
    lines.push(description || `*${t('book.entry.noDescription')}*`, '');

    if (entry.topics?.length) {
      lines.push(entry.topics.map((topic) => `\`#${topic}\``).join(' '), '');
    }

    const links = linksFor(entry, t);
    if (links.length) {
      lines.push(`**${t('export.links')}:**`);
      for (const link of links) lines.push(`- [${link.label}](${link.url})`);
      lines.push('');
    }

    lines.push(`**${t('book.entry.notes')}:**`, '');
    // A blockquote keeps the visitor's words visually distinct from generated
    // copy, and survives being pasted into a wiki or a README unchanged.
    for (const line of noteBody(entry.notes, '.').split('\n')) lines.push(`> ${line}`);
    lines.push('', '---', '');
  });

  lines.push(`*${t('book.runner.attribution', { app: APP_NAME })}*`);
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/* -------------------------------------------------------------------------- *
 * Plain text
 * -------------------------------------------------------------------------- */

const RULE = '='.repeat(64);
const THIN = '-'.repeat(64);

/** @returns {string} a fixed-width plain-text document */
export function toPlainText({ settings, chapters, t, locale }) {
  const { title, author, contact, date } = meta(settings, t);
  const lines = [];

  lines.push(RULE, title.toUpperCase(), t('book.cover.subtitle'), RULE, '');
  lines.push(author + (contact ? `  ·  ${contact}` : ''));
  lines.push(t('book.cover.generatedOn', { date: formatDate(date, locale) }));
  lines.push('', THIN, t('book.toc.title').toUpperCase(), THIN, '');

  for (const group of groupByStatus(chapters, t)) {
    lines.push(group.label.toUpperCase());
    for (const entry of group.entries) {
      lines.push(`  ${String(entry.chapter).padStart(2, '0')}  ${humanizeRepoName(entry.name)}`);
    }
    lines.push('');
  }

  chapters.forEach((entry, index) => {
    lines.push(THIN);
    lines.push(`${String(index + 1).padStart(2, '0')}. ${humanizeRepoName(entry.name).toUpperCase()}`);
    lines.push(THIN, '');
    lines.push(pad(t('book.entry.status'), t(`status.${entry.status}`)));
    lines.push(pad(t('book.entry.language'), entry.language ?? t('common.unknown')));
    lines.push(pad(t('book.entry.stars'), String(entry.stars ?? 0)));
    lines.push(pad(t('book.entry.forks'), String(entry.forks ?? 0)));
    lines.push(
      pad(
        t('book.entry.updated'),
        entry.updatedAt ? formatDate(entry.updatedAt, locale) : t('common.unknown'),
      ),
    );
    if (entry.license?.spdx_id || entry.license?.name) {
      lines.push(pad(t('book.entry.license'), entry.license.spdx_id ?? entry.license.name));
    }
    lines.push('');
    lines.push(t('book.entry.description'));
    for (const line of wrap(
      (entry.shortDescription || entry.description || '').trim() || t('book.entry.noDescription'),
      72,
    )) {
      lines.push(`  ${line}`);
    }
    lines.push('');

    const links = linksFor(entry, t);
    if (links.length) {
      lines.push(t('export.links'));
      for (const link of links) lines.push(`  ${pad(link.label, link.url, 18)}`);
      lines.push('');
    }

    lines.push(t('book.entry.notes'));
    for (const line of noteBody(entry.notes, '.').split('\n')) lines.push(`  ${line}`);
    lines.push('');
  });

  lines.push(THIN);
  lines.push(t('book.runner.attribution', { app: APP_NAME }));
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/* -------------------------------------------------------------------------- *
 * CSV
 * -------------------------------------------------------------------------- */

/**
 * RFC 4180 field: wrap in quotes, double any embedded quote.
 * Newlines inside a quoted field are legal, which is what lets a multi-line
 * note stay one record.
 */
function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** @returns {string} an RFC 4180 CSV document */
export function toCsv({ settings, chapters, t, locale }) {
  const header = [
    t('export.csv.chapter'),
    t('export.csv.project'),
    t('export.csv.slug'),
    t('book.entry.status'),
    t('book.entry.language'),
    t('book.entry.stars'),
    t('book.entry.forks'),
    t('book.entry.updated'),
    t('export.csv.license'),
    t('export.csv.description'),
    t('export.csv.repository'),
    t('export.csv.homepage'),
    t('book.entry.notes'),
  ];

  const rows = chapters.map((entry, index) => [
    String(index + 1).padStart(2, '0'),
    humanizeRepoName(entry.name),
    entry.slug ?? '',
    t(`status.${entry.status}`),
    entry.language ?? '',
    String(entry.stars ?? 0),
    String(entry.forks ?? 0),
    entry.updatedAt ? entry.updatedAt.slice(0, 10) : '',
    entry.license?.spdx_id ?? entry.license?.name ?? '',
    (entry.shortDescription || entry.description || '').trim(),
    entry.url ?? '',
    entry.homepage ?? '',
    noteBody(entry.notes, '.'),
  ]);

  // A BOM so Excel on Windows reads the UTF-8 correctly — the single most
  // common complaint with exported CSV that contains non-ASCII text.
  const rowsText = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  return `﻿${rowsText}\r\n`;
}

/* -------------------------------------------------------------------------- *
 * Entry point
 * -------------------------------------------------------------------------- */

/**
 * @param {'markdown'|'text'|'csv'} format
 * @param {{ settings: object, chapters: object[], t: Function }} input
 * @returns {{ filename: string, content: string, mime: string }}
 */
export function buildTextExport(format, { settings, chapters, t, locale }) {
  const spec = EXPORT_FORMATS.find((entry) => entry.id === format) ?? EXPORT_FORMATS[0];
  const { title } = meta(settings, t);

  const content =
    spec.id === 'csv'
      ? toCsv({ settings, chapters, t, locale })
      : spec.id === 'markdown'
        ? toMarkdown({ settings, chapters, t, locale })
        : toPlainText({ settings, chapters, t, locale });

  return {
    filename: `${slugifyTitle(title) || 'book'}.${spec.extension}`,
    content,
    mime: spec.mime,
  };
}

/* -------------------------------------------------------------------------- *
 * Small utilities
 * -------------------------------------------------------------------------- */

function linksFor(entry, t) {
  const links = [];
  if (entry.url) links.push({ label: t('library.row.openOnGithub'), url: entry.url });
  if (entry.homepage) links.push({ label: t('library.row.homepage'), url: entry.homepage });
  return links;
}

function pad(label, value, width = 14) {
  return `  ${String(label).padEnd(width)}${value}`;
}

function wrap(text, width) {
  const words = String(text).split(/\s+/).filter(Boolean);
  /** @type {string[]} */
  const out = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= width) line += ` ${word}`;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

function formatDate(value, locale) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    // Falls back to the runtime locale when none is given, rather than
    // reaching for an i18n key — dates are formatted, not translated.
    return new Intl.DateTimeFormat(locale || undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function anchor(slug) {
  return String(slug ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9/-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

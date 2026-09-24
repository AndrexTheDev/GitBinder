/**
 * Presentation helpers: locale-aware formatting, escaping and small strings.
 *
 * @module utils/format
 */

/** Escape a value for safe interpolation into innerHTML. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape a value used inside a CSS `url()` or an SVG attribute. */
export function escapeAttribute(value) {
  return String(value ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Collapse whitespace and clamp a string to `max` characters, adding an ellipsis.
 * Useful for the "short description" column of the book index.
 */
export function truncate(value, max = 96) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/** Format a number with the active locale (1.234 vs 1,234). */
export function formatNumber(value, locale = 'en', options = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(locale, options).format(n);
}

/** Compact number for stat chips: 1.2k / 3,4 Mio. */
export function formatCompact(value, locale = 'en') {
  return formatNumber(value, locale, { notation: 'compact', maximumFractionDigits: 1 });
}

/** Format an ISO date / Date / timestamp as a medium-length local date. */
export function formatDate(value, locale = 'en') {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

/** Format an ISO date with time, for "last synchronised" stamps. */
export function formatDateTime(value, locale = 'en') {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** "3 days ago" / "vor 3 Tagen" using Intl.RelativeTimeFormat. */
export function formatRelativeTime(value, locale = 'en', now = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diffMs = date.getTime() - now;
  const units = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['week', 1000 * 60 * 60 * 24 * 7],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
  ];

  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms || unit === 'minute') {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return rtf.format(0, 'minute');
}

/** Byte size formatter for the storage indicator in the footer. */
export function formatBytes(bytes, locale = 'en') {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exp = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${formatNumber(n / 1024 ** exp, locale, { maximumFractionDigits: exp === 0 ? 0 : 1 })} ${units[exp]}`;
}

/** `owner/repo` from any GitHub-ish input (URL, slug or bare name). */
export function parseRepoSlug(input, fallbackOwner = '') {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  const urlMatch = raw.match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i);
  if (urlMatch) return `${urlMatch[1]}/${urlMatch[2].replace(/\.git$/, '')}`;
  if (raw.includes('/')) return raw.replace(/\.git$/, '');
  return fallbackOwner ? `${fallbackOwner}/${raw}` : null;
}

/**
 * Guard an untrusted URL before it reaches an `href`.
 *
 * Repository homepages are free-form strings typed by whoever owns the repo,
 * so anything that is not `http:`, `https:` or `mailto:` is dropped — otherwise
 * a `javascript:` homepage would run in the visitor's session the moment they
 * clicked it in the generated PDF.
 *
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string} a safe URL, or `fallback` when the input is not one
 */
export function safeUrl(value, fallback = '') {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw, typeof location !== 'undefined' ? location.href : 'https://gitbinder.dev/');
    if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') {
      return url.href;
    }
  } catch {
    /* not a URL at all */
  }
  return fallback;
}

/**
 * Normalise a URL the way the browser will, so the text printed on paper is
 * byte-identical to the `href` the PDF annotation points at.
 *
 * `new URL('https://a.example.com').href` is `https://a.example.com/` — a
 * mismatch of one character is invisible on screen but makes the printed URL a
 * lie, so the model stores the normalised form from the start.
 *
 * @param {unknown} value
 * @returns {string} the normalised URL, or the input when it is not a URL
 */
export function normalizeUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).href;
  } catch {
    return raw;
  }
}

/** GitHub username sanity check — used for inline validation feedback. */
export function isValidGithubUsername(value) {
  return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(String(value ?? '').trim());
}

/** Rough e-mail shape check (deliberately permissive). */
export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value ?? '').trim());
}

/** Capitalise the first letter — handy for generated chapter headings. */
export function sentenceCase(value) {
  const text = String(value ?? '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Turn a repo name into a chapter title: `my-cool_app` → `My Cool App`.
 *
 * Short all-lowercase segments are kept lower case, the way you would write a
 * proper title ("Building a Pdf Composer on Cloudflare"): every word is
 * capitalised except tiny connectors and acronyms-in-waiting.
 */
const TITLE_CASE_MINOR = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'via', 'with', 'und', 'der', 'die', 'das', 'von', 'zu']);

export function humanizeRepoName(name) {
  const words = String(name ?? '')
    .replace(/[-_.]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ');

  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && TITLE_CASE_MINOR.has(lower)) return lower;
      // Preserve an existing acronym (PDF, API, CLI) instead of mangling it.
      if (word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word)) return word;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

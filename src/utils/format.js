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

/**
 * Coerce a date-ish value, or `null` when there is no date in it.
 *
 * `null` is how this codebase spells "no value" — `normalizeRepo()` builds
 * `updatedAt: raw?.updated_at ?? null` — and `new Date(null)` is the epoch, so
 * without this check a repository whose date arrived missing would claim to
 * have been updated on 1 January 1970, and `formatRelativeTime()` would say
 * "57 years ago". `0` stays a real timestamp; only the empty values are empty.
 */
function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format an ISO date / Date / timestamp as a medium-length local date. */
export function formatDate(value, locale = 'en') {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

/** Format an ISO date with time, for "last synchronised" stamps. */
export function formatDateTime(value, locale = 'en') {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** "3 days ago" / "vor 3 Tagen" using Intl.RelativeTimeFormat. */
export function formatRelativeTime(value, locale = 'en', now = Date.now()) {
  const date = toDate(value);
  if (!date) return '—';

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
 * A value with no scheme at all is *not* resolved against the current page.
 * `new URL('example.com', location.href)` succeeds and quietly yields
 * `https://<this app>/example.com`, so a homepage typed the way GitHub users
 * usually type it — `example.com`, no scheme — would print that wrong URL in
 * the book and point its link annotation at this app's own domain instead of
 * the user's site. A bare hostname is therefore read as the `https:` address it
 * was meant to be, and anything that does not look like a host is refused.
 *
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string} a safe URL, or `fallback` when the input is not one
 */
export function safeUrl(value, fallback = '') {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;

  // Whitespace means prose, not an address: "coming soon" is a valid relative
  // reference to the WHATWG parser and must not become a link.
  if (/\s/.test(raw)) return fallback;

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw);
  const candidate = hasScheme ? raw : `https://${raw}`;

  // Only a dotted host counts as a typed address; `my-project` is a path
  // fragment or a typo, not a domain.
  if (!hasScheme && !/^[^\s/?#]+\.[^\s/?#]{2,}(?:[/?#]|$)/.test(raw)) return fallback;

  try {
    const url = new URL(candidate);
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

/** Letters NFKD leaves alone but ASCII has no equivalent for. */
const TRANSLITERATE = Object.freeze({
  ß: 'ss', æ: 'ae', œ: 'oe', ø: 'oe', đ: 'd', ð: 'd', þ: 'th',
  ł: 'l', ı: 'i', ŋ: 'n', ə: 'e', ĸ: 'k', ŧ: 't',
});

/**
 * German umlauts, mapped *before* NFKD runs.
 *
 * NFKD turns `ü` into `u` + a combining diaeresis, which the accent strip then
 * removes — so the letter silently degrades to a bare `u` and `"Über"` becomes
 * `uber`. German convention (DIN 5007-2) is `ue`, giving `ueber`. The
 * substitution has to happen first because after decomposition the information
 * is already gone.
 */
const GERMAN_UMLAUTS = Object.freeze({ ä: 'ae', ö: 'oe', ü: 'ue' });
const UMLAUT_PATTERN = /[äöü]/gi;

export function slugifyTitle(value, max = 60) {
  return String(value ?? '')
    .replace(UMLAUT_PATTERN, (char) => {
      const mapped = GERMAN_UMLAUTS[char.toLowerCase()];
      return char === char.toLowerCase() ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
    })
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents; the base letter survives
    .replace(/[\u00df\u00e6\u0153\u00f8\u0111\u00f0\u00fe\u0142\u0131\u014b\u018f\u0138\u0167]/gi, (char) => {
      const mapped = TRANSLITERATE[char.toLowerCase()];
      // Preserve a capital's position: "Über" → "Ueber", not "ueber".
      return char === char.toLowerCase() ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
    })
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

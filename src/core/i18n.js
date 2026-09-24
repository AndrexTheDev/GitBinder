/**
 * Internationalisation engine (EN ⇄ DE).
 *
 * Deliberately framework-free and synchronous:
 *
 *   • Dictionaries are plain nested objects, statically imported, so they are
 *     part of the bundle and available before first paint (no flicker, no
 *     network round trip, works offline).
 *   • `t('a.b.c', { count: 3 })` resolves dot paths, applies ICU-ish plural
 *     selection through `Intl.PluralRules` and interpolates `{placeholders}`.
 *   • `applyTo(root)` re-writes every `data-i18n*` binding in the DOM, which is
 *     what gives the language switch its *instant* string replacement.
 *   • Components additionally re-render through their own store subscriptions,
 *     so both declarative (HTML) and imperative (JS-built) strings stay in sync.
 *
 * Persistence is intentionally NOT handled here — `state.language` in the store
 * is the single source of truth. This keeps one writable place for the locale.
 *
 * @module core/i18n
 */

import { isPlainObject } from '../utils/object.js';
import { escapeHtml } from '../utils/format.js';

/** Attributes the DOM applier understands: `data-i18n-<target>="<key>"`. */
export const I18N_TARGETS = Object.freeze([
  'text',
  'html',
  'title',
  'placeholder',
  'aria-label',
  'alt',
  'value',
  'label',
  'data-tooltip',
]);

const INTERPOLATION = /\{\{\{\s*([\w.]+)\s*(?:\|\s*(\w+)\s*)?\}\}\}|\{\{\s*([\w.]+)\s*\}\}|\{\s*([\w.]+)\s*(?:\|\s*(\w+)\s*)?\}/g;

function lookup(dict, key) {
  if (!dict || !key) return undefined;
  if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
  let cursor = dict;
  for (const segment of String(key).split('.')) {
    if (!isPlainObject(cursor) || !(segment in cursor)) return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

function collectKeys(dict, prefix = '', out = []) {
  for (const [key, value] of Object.entries(dict ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) collectKeys(value, path, out);
    else out.push(path);
  }
  return out;
}

/**
 * @param {object} options
 * @param {Record<string, object>} options.locales   `{ en: {...}, de: {...} }`
 * @param {string}  [options.locale='en']            initial locale
 * @param {string}  [options.fallback='en']          used for missing keys
 * @param {{ code: string, label: string, nativeLabel?: string, flag?: string }[]} [options.languages]
 * @param {Document} [options.document]              injected for tests
 * @param {Navigator} [options.navigator]            injected for tests
 */
export function createI18n(options) {
  const {
    locales = {},
    locale: initialLocale = 'en',
    fallback = 'en',
    languages = Object.keys(locales).map((code) => ({ code, label: code.toUpperCase() })),
    document: doc = typeof document !== 'undefined' ? document : null,
    navigator: nav = typeof navigator !== 'undefined' ? navigator : null,
  } = options;

  const supported = Object.keys(locales);
  /** @type {Set<Function>} */
  const listeners = new Set();
  /** @type {Set<string>} */
  const warned = new Set();
  /** @type {Map<string, Intl.PluralRules>} */
  const pluralCache = new Map();

  let current = supported.includes(initialLocale) ? initialLocale : fallback;

  /* ---------------------------------------------------------------- */

  const normalize = (code) => {
    const raw = String(code ?? '').trim().toLowerCase();
    if (supported.includes(raw)) return raw;
    const base = raw.split('-')[0];
    return supported.includes(base) ? base : null;
  };

  /** Pick a locale from a list of BCP-47 tags (navigator.languages). */
  function detect(candidates = []) {
    const list = Array.isArray(candidates) ? candidates : [candidates];
    for (const candidate of list) {
      const match = normalize(candidate);
      if (match) return match;
    }
    return fallback;
  }

  /** Best guess from the environment, used for the state default. */
  function detectFromEnvironment() {
    if (!nav) return fallback;
    return detect([...(nav.languages ?? []), nav.language, nav.userLanguage].filter(Boolean));
  }

  function pluralRules(locale) {
    if (!pluralCache.has(locale)) {
      try {
        pluralCache.set(locale, new Intl.PluralRules(locale));
      } catch {
        pluralCache.set(locale, new Intl.PluralRules(fallback));
      }
    }
    return pluralCache.get(locale);
  }

  /** Choose the right plural form out of `{ one, other, zero, two, few, many }`. */
  function selectPlural(entry, count, locale) {
    if (!isPlainObject(entry)) return entry;
    const category = Number.isFinite(count) ? pluralRules(locale).select(count) : 'other';
    return (
      entry[category] ??
      entry.one ??
      entry.other ??
      Object.values(entry).find((v) => typeof v === 'string') ??
      undefined
    );
  }

  function formatValue(value, formatter, locale) {
    if (value == null) return '';
    try {
      switch (formatter) {
        case 'number':
          return new Intl.NumberFormat(locale).format(Number(value));
        case 'compact':
          return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value));
        case 'percent':
          return new Intl.NumberFormat(locale, { style: 'percent' }).format(Number(value));
        case 'date':
          return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
        case 'datetime':
          return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
        case 'upper':
          return String(value).toUpperCase();
        case 'lower':
          return String(value).toLowerCase();
        default:
          return String(value);
      }
    } catch {
      return String(value);
    }
  }

  /**
   * Placeholder syntax:
   *   `{name}`      → interpolated, escaped when `escape` is set
   *   `{{name}}`    → always escaped (safe for `data-i18n-html` bindings)
   *   `{{{name}}}`  → never escaped (trusted markup, e.g. a <strong> tag)
   *   `{count|number}`, `{date|date}`, `{ratio|percent}`, `{n|compact}`,
   *   `{name|upper}`, `{name|lower}`, `{at|datetime}`
   */
  function interpolate(template, params, locale, escape) {
    if (typeof template !== 'string' || !template.includes('{')) return template;
    if (!params || typeof params !== 'object') return template;

    return template.replace(INTERPOLATION, (match, rawKey, rawFmt, escKey, key, fmt) => {
      const token = rawKey ?? escKey ?? key;
      if (!token || !(token in params)) return match;
      const value = formatValue(params[token], rawFmt ?? fmt, locale);
      if (rawKey) return value; // triple braces: caller takes responsibility
      if (escKey) return escapeHtml(value); // double braces: always escaped
      return escape ? escapeHtml(value) : value;
    });
  }

  /**
   * Translate a key.
   *
   * @param {string|string[]} key    dot path (or a list of candidates)
   * @param {object} [params]        interpolation values; `count` enables plurals
   * @param {{ escape?: boolean, locale?: string }} [opts]
   * @returns {string}
   */
  function t(key, params = {}, opts = {}) {
    const locale = opts.locale ?? current;
    const escape = opts.escape === true;
    const keys = Array.isArray(key) ? key : [key];

    for (const candidate of keys) {
      let value = lookup(locales[locale], candidate);
      if (value === undefined && locale !== fallback) value = lookup(locales[fallback], candidate);
      if (value === undefined) continue;

      if (isPlainObject(value)) {
        value = selectPlural(value, params?.count, locale);
        if (value === undefined) continue;
      }
      return interpolate(String(value), params, locale, escape);
    }

    const missing = keys.join(' | ');
    if (!warned.has(missing)) {
      warned.add(missing);
      console.warn(`[i18n] missing translation "${missing}" for locale "${locale}"`);
    }
    return missing;
  }

  const has = (key) => lookup(locales[current], key) !== undefined || lookup(locales[fallback], key) !== undefined;

  /* ---------------------------------------------------------------- */

  /**
   * Re-apply every `data-i18n*` binding under `root`.
   * This is what makes the language switch instantaneous: no re-render of the
   * component tree is required for statically declared strings.
   */
  function applyTo(root = doc) {
    if (!root || typeof root.querySelectorAll !== 'function') return 0;

    const selector = I18N_TARGETS.map((target) =>
      target === 'text' ? '[data-i18n]' : `[data-i18n-${target}]`,
    ).join(',');

    const nodes = [...root.querySelectorAll(selector)];
    // The root element itself may carry bindings (e.g. <html data-i18n-title>).
    if (root.matches?.(selector)) nodes.unshift(root);

    for (const node of nodes) {
      const rawParams = node.getAttribute('data-i18n-params');
      let params = {};
      if (rawParams) {
        try {
          params = JSON.parse(rawParams);
        } catch {
          params = {};
        }
      }

      for (const target of I18N_TARGETS) {
        const attr = target === 'text' ? 'data-i18n' : `data-i18n-${target}`;
        const key = node.getAttribute(attr);
        if (!key) continue;
        const value = t(key, params, { escape: target === 'html' });

        if (target === 'text') {
          if (node.textContent !== value) node.textContent = value;
        } else if (target === 'html') {
          if (node.innerHTML !== value) node.innerHTML = value;
        } else if (target === 'value' && 'value' in node) {
          if (node.value !== value) node.value = value;
        } else {
          if (node.getAttribute(target) !== value) node.setAttribute(target, value);
        }
      }
    }
    return nodes.length;
  }

  /** Keep `<html lang>` and the document title in sync with the active locale. */
  function syncDocument() {
    if (!doc) return;
    doc.documentElement?.setAttribute('lang', current);
    const title = lookup(locales[current], 'meta.title') ?? lookup(locales[fallback], 'meta.title');
    if (typeof title === 'string' && doc.title !== title) doc.title = title;
  }

  function setLocale(next) {
    const normalized = normalize(next);
    if (!normalized) {
      console.warn(`[i18n] unsupported locale "${next}" — keeping "${current}"`);
      return current;
    }
    if (normalized === current) return current;
    current = normalized;
    syncDocument();
    applyTo(doc);
    for (const listener of [...listeners]) {
      try {
        listener(current);
      } catch (error) {
        console.error('[i18n] listener failed', error);
      }
    }
    return current;
  }

  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  const formatNumber = (value, opts) => new Intl.NumberFormat(current, opts).format(Number(value) || 0);
  const formatDate = (value, opts) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(current, { dateStyle: 'medium', ...opts }).format(date);
  };
  const formatList = (values, opts) => new Intl.ListFormat(current, { style: 'long', ...opts }).format(values);

  syncDocument();

  return {
    get locale() {
      return current;
    },
    get fallback() {
      return fallback;
    },
    get languages() {
      return languages;
    },
    get supported() {
      return [...supported];
    },
    t,
    has,
    setLocale,
    detect,
    detectFromEnvironment,
    onChange,
    applyTo,
    syncDocument,
    formatNumber,
    formatDate,
    formatList,
    keys: (locale = current) => collectKeys(locales[locale]),
  };
}

/** @typedef {ReturnType<typeof createI18n>} I18n */

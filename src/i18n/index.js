/**
 * i18n composition root.
 *
 * Dictionaries are statically imported so they ship inside the bundle: the
 * correct language is available before the first paint, with no network
 * request and full offline support (both matter for a tool that people run
 * from a conference Wi-Fi or a train).
 *
 * @module i18n
 */

import { createI18n } from '../core/i18n.js';
import en from './locales/en.js';
import de from './locales/de.js';
import { FALLBACK_LANGUAGE, LANGUAGES, SUPPORTED_LANGUAGES, languageName } from './languages.js';

/** @type {Record<string, object>} */
export const LOCALES = { en, de };

/**
 * Create a translator instance.
 *
 * @param {{ locale?: string, document?: Document, navigator?: Navigator }} [options]
 */
export function createTranslator(options = {}) {
  return createI18n({
    locales: LOCALES,
    languages: LANGUAGES,
    fallback: FALLBACK_LANGUAGE,
    locale: options.locale ?? FALLBACK_LANGUAGE,
    document: options.document,
    navigator: options.navigator,
  });
}

/**
 * Resolve the locale to use on a cold start:
 * persisted choice (handled by the store) → browser languages → fallback.
 *
 * @param {{ navigator?: Navigator }} [env]
 * @returns {string}
 */
export function detectInitialLanguage(env = {}) {
  const nav = env.navigator ?? (typeof navigator !== 'undefined' ? navigator : null);
  const candidates = [];
  if (nav) {
    if (Array.isArray(nav.languages)) candidates.push(...nav.languages);
    if (nav.language) candidates.push(nav.language);
  }
  for (const candidate of candidates) {
    const exact = String(candidate).toLowerCase();
    if (SUPPORTED_LANGUAGES.includes(exact)) return exact;
    const base = exact.split('-')[0];
    if (SUPPORTED_LANGUAGES.includes(base)) return base;
  }
  return FALLBACK_LANGUAGE;
}

// Re-exported for consumers: LANGUAGES, SUPPORTED_LANGUAGES, FALLBACK_LANGUAGE,
// DEFAULT_LANGUAGE, languageMeta(), languageName().
export * from './languages.js';

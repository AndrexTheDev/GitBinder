/**
 * Supported interface languages.
 *
 * Adding a language = drop a dictionary into `./locales`, register it in
 * `./index.js` and add one line here. Nothing else needs to change.
 *
 * @module i18n/languages
 */

/** @typedef {{ code: string, label: string, nativeLabel: string, englishLabel: string }} LanguageMeta */

/** @type {LanguageMeta[]} */
export const LANGUAGES = [
  { code: 'en', label: 'EN', nativeLabel: 'English', englishLabel: 'English' },
  { code: 'de', label: 'DE', nativeLabel: 'Deutsch', englishLabel: 'German' },
];

export const SUPPORTED_LANGUAGES = Object.freeze(LANGUAGES.map((language) => language.code));
export const FALLBACK_LANGUAGE = 'en';
export const DEFAULT_LANGUAGE = 'en';

/** @returns {LanguageMeta|undefined} */
export function languageMeta(code) {
  return LANGUAGES.find((language) => language.code === code);
}

/** Human readable name in its own language, e.g. `de` → `Deutsch`. */
export function languageName(code) {
  return languageMeta(code)?.nativeLabel ?? String(code ?? '').toUpperCase();
}

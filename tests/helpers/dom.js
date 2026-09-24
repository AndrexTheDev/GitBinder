/**
 * jsdom environment for smoke tests.
 *
 * Boots the *real* application against a real DOM so a crash in a component,
 * a bad `h()` call or a broken subscription shows up as a failing test instead
 * of a blank page in the browser.
 */

import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

/** The real index.html, so tests exercise the actual layout shell. */
export const INDEX_HTML = readFileSync(resolve(root, 'index.html'), 'utf8');

/**
 * @param {object} [options]
 * @param {string[]} [options.languages]       navigator.languages
 * @param {string}   [options.url]
 * @returns {{ dom: JSDOM, window: Window & typeof globalThis, document: Document,
 *             cleanup: () => void, restore: () => void }}
 */
export function createDomEnvironment(options = {}) {
  const { languages = ['en-US', 'en'], url = 'https://gitbinder.test/' } = options;

  const dom = new JSDOM(INDEX_HTML, { url, pretendToBeVisual: true });

  const { window } = dom;
  Object.defineProperty(window.navigator, 'languages', { value: languages, configurable: true });
  Object.defineProperty(window.navigator, 'language', { value: languages[0], configurable: true });

  // jsdom ships neither of these, and both are used by the vault.
  if (!window.crypto?.getRandomValues) {
    const nodeCrypto = globalThis.crypto;
    Object.defineProperty(window, 'crypto', { value: nodeCrypto, configurable: true });
  }

  /** @type {Array<[object, string, PropertyDescriptor|undefined]>} */
  const saved = [];
  const globals = [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'CustomEvent',
    'KeyboardEvent',
    'MouseEvent',
    'getComputedStyle',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'localStorage',
    'sessionStorage',
    'URL',
    'Blob',
    'File',
    'FileReader',
    'DOMParser',
  ];

  for (const key of globals) {
    saved.push([globalThis, key, Object.getOwnPropertyDescriptor(globalThis, key)]);
    const value = window[key];
    Object.defineProperty(globalThis, key, {
      value: typeof value === 'function' && !/^[A-Z]/.test(key) ? value.bind(window) : value,
      configurable: true,
      writable: true,
    });
  }

  function cleanup() {
    for (const [target, key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else delete target[key];
    }
    dom.window.close();
  }

  return { dom, window, document: window.document, cleanup };
}

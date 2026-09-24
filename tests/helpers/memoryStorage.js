/**
 * Node test environment shims.
 *
 * The store, the vault and the i18n DOM applier are all written so their host
 * environment can be injected — these shims are what makes them runnable under
 * `node --test` with zero browser dependencies.
 *
 * @module tests/helpers
 */

/** Storage-compatible in-memory implementation. */
export function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(String(key)) ? map.get(String(key)) : null),
    setItem: (key, value) => void map.set(String(key), String(value)),
    removeItem: (key) => void map.delete(String(key)),
    clear: () => map.clear(),
  };
}

/** Minimal `navigator` with the fields the language detector reads. */
export function createNavigator(languages = ['en-US', 'en']) {
  return { languages, language: languages[0], userLanguage: languages[0] };
}

/**
 * Minimal `document` supporting the handful of calls `i18n.applyTo()` makes.
 * Deliberately tiny: if the applier starts needing more, that is a design smell
 * and should show up as a failing test rather than silently growing.
 */
export function createDocumentStub(elements = []) {
  const nodes = elements.map((el) => ({
    ...el,
    attributes: { ...el.attributes },
    getAttribute(name) {
      return name in this.attributes ? this.attributes[name] : null;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    hasAttribute(name) {
      return name in this.attributes;
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
  }));

  return {
    documentElement: { setAttribute() {} },
    title: '',
    querySelectorAll(selector) {
      // `applyTo` builds one selector per target; match on any data-i18n* attr.
      void selector;
      return nodes.filter((node) => Object.keys(node.attributes).some((name) => name.startsWith('data-i18n')));
    },
    matches: () => false,
  };
}

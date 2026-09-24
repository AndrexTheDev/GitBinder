/**
 * Tiny synchronous event emitter.
 *
 * Used for *UI* signals only (open the settings drawer, push a toast).
 * Application data flows through the store, not through the bus — that keeps
 * the data path debuggable and the bus free of business logic.
 *
 * @module core/events
 */

/**
 * @template {Record<string, any>} [Events=Record<string, any>]
 * @returns {{
 *   on: <K extends keyof Events | string>(event: K, handler: (payload: any) => void) => () => void,
 *   once: (event: string, handler: (payload: any) => void) => () => void,
 *   off: (event: string, handler: (payload: any) => void) => void,
 *   emit: (event: string, payload?: any) => void,
 *   clear: (event?: string) => void,
 * }}
 */
export function createEmitter() {
  /** @type {Map<string, Set<Function>>} */
  const handlers = new Map();

  const bucket = (event) => {
    if (!handlers.has(event)) handlers.set(event, new Set());
    return handlers.get(event);
  };

  function on(event, handler) {
    if (typeof handler !== 'function') return () => {};
    bucket(event).add(handler);
    return () => off(event, handler);
  }

  function once(event, handler) {
    const off = on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  function off(event, handler) {
    handlers.get(event)?.delete(handler);
  }

  function emit(event, payload) {
    const current = handlers.get(event);
    if (!current || current.size === 0) return;
    // Copy first: a handler is allowed to unsubscribe itself while running.
    for (const handler of [...current]) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[bus] handler for "${event}" threw`, error);
      }
    }
  }

  function clear(event) {
    if (event) handlers.delete(event);
    else handlers.clear();
  }

  return { on, once, off, emit, clear };
}

/** Well-known UI signal names, kept in one place to avoid stringly-typed typos. */
export const UI_EVENTS = Object.freeze({
  openSettings: 'ui:settings:open',
  closeSettings: 'ui:settings:close',
  openSupport: 'ui:support:open',
  closeSupport: 'ui:support:close',
  /**
   * Open one of the informational overlays.
   * Payload: `{ kind: 'help'|'disclaimer'|'terms'|'contact' }`.
   */
  openInfo: 'ui:info:open',
  fetchRepos: 'ui:repos:fetch',
  /** Compose the book and open the print dialog. */
  printBook: 'ui:book:print',
  /** Show/hide the live book preview. Payload: `{ open?: boolean }`. */
  toggleBookPreview: 'ui:book:preview',
  buildPdf: 'ui:book:build',
  toast: 'ui:toast',
});

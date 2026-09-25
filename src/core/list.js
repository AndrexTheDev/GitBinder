/**
 * Keyed list reconciler.
 *
 * Re-rendering a whole list on every state change would blow away focus and
 * half-typed text in row inputs (the repository override editor is full of
 * them). Instead we keep one DOM node per item key and *update* it in place,
 * moving nodes only when the order changes.
 *
 * @module core/list
 */

/**
 * @template T
 * @param {object} options
 * @param {HTMLElement} options.container        host element for the rows
 * @param {(item: T, index: number) => string} options.key   stable identity
 * @param {(item: T, index: number) => { el: Node, update?: (item: T, index: number) => void, destroy?: () => void }} options.create
 * @param {(element: HTMLElement) => Node} [options.emptyNode] rendered when the list is empty
 * @returns {{ render(items: T[]): void, clear(): void, get size(): number }}
 */
export function createKeyedList({ container, key, create, emptyNode = null }) {
  /** @type {Map<string, { el: Node, update?: Function, destroy?: Function }>} */
  const rows = new Map();
  /** @type {Node|null} */
  let empty = null;

  function showEmpty(items) {
    if (items.length > 0) {
      if (empty?.parentNode) empty.remove();
      empty = null;
      return;
    }
    const node = typeof emptyNode === 'function' ? emptyNode(container) : emptyNode;
    if (!node) return;
    empty = node;
    container.replaceChildren(node);
  }

  function render(items) {
    const list = Array.isArray(items) ? items : [];
    const seen = new Set();

    // Anchor we insert before; walking the desired order keeps moves minimal.
    let cursor = container.firstChild;

    list.forEach((item, index) => {
      const id = String(key(item, index));
      seen.add(id);

      let row = rows.get(id);
      if (!row) {
        row = create(item, index);
        rows.set(id, row);
      } else if (typeof row.update === 'function') {
        row.update(item, index);
      }

      const node = row.el;

      if (node !== cursor) {
        container.insertBefore(node, cursor);
      } else {
        cursor = cursor.nextSibling;
      }
    });

    // Drop rows that disappeared.
    for (const [id, row] of [...rows]) {
      if (seen.has(id)) continue;
      row.destroy?.();
      row.el.remove();
      rows.delete(id);
    }

    // Remove any leftover nodes (e.g. a previously shown empty state).
    while (cursor) {
      const next = cursor.nextSibling;
      if (cursor !== empty) cursor.remove();
      cursor = next;
    }

    showEmpty(list);
  }

  function clear() {
    for (const row of rows.values()) {
      row.destroy?.();
      row.el.remove();
    }
    rows.clear();
    if (empty?.parentNode) empty.remove();
    empty = null;
    container.replaceChildren();
  }

  return {
    render,
    clear,
    get size() {
      return rows.size;
    },
  };
}

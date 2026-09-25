/**
 * Accessible tab strip.
 *
 * Renders only the *strip*; the panel is owned by the caller, which suits the
 * donation modal exactly: it shows one wallet at a time and builds its QR code
 * lazily, so there is no reason to render three panels and hide two.
 *
 * Implements the ARIA Authoring Practices tabs pattern:
 *
 *   • `role="tablist"` / `role="tab"` with `aria-selected` and `aria-controls`
 *   • roving tabindex — Tab moves past the whole strip, arrows move within it
 *   • automatic activation (focus follows selection), which is what the APG
 *     recommends when switching panels is cheap
 *   • Home / End jump to the ends, and the strip wraps at both edges
 *
 * @module components/ui/Tabs
 */

import { h } from '../../core/dom.js';
import { icon } from './Icon.js';

/**
 * @param {object} options
 * @param {string} options.id                 unique prefix for generated ids
 * @param {{ id: string, label: string, badge?: string, iconName?: string }[]} options.tabs
 * @param {string} [options.active]           id of the initially selected tab
 * @param {string} options.panelId            id of the element each tab controls
 * @param {string} [options.label]            accessible name for the tablist
 * @param {(id: string) => void} options.onChange
 */
export function createTabs({ id, tabs = [], active = null, panelId, label = '', onChange }) {
  const list = Array.isArray(tabs) ? tabs : [];
  let current = list.some((tab) => tab.id === active) ? active : list[0]?.id ?? null;

  /** @type {Map<string, HTMLButtonElement>} */
  const buttons = new Map();

  /**
   * @param {string} nextId
   * @param {{ focus?: boolean, silent?: boolean }} [options]
   */
  function select(nextId, { focus = false, silent = false } = {}) {
    if (!list.some((tab) => tab.id === nextId)) return;
    const changed = nextId !== current;
    current = nextId;

    for (const [tabId, button] of buttons) {
      const isActive = tabId === current;
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.tabIndex = isActive ? 0 : -1;
      button.classList.toggle('tabs__tab--active', isActive);
    }

    if (focus) buttons.get(nextId)?.focus();
    if (changed && !silent) onChange?.(nextId);
  }

  function step(delta) {
    const index = list.findIndex((tab) => tab.id === current);
    if (index < 0) return;
    const next = list[(index + delta + list.length) % list.length];
    select(next.id, { focus: true });
  }

  const el = h(
    'div',
    {
      class: 'tabs',
      role: 'tablist',
      'aria-label': label || null,
      on: {
        keydown: (event) => {
          switch (event.key) {
            case 'ArrowRight':
            case 'ArrowDown':
              event.preventDefault();
              step(1);
              break;
            case 'ArrowLeft':
            case 'ArrowUp':
              event.preventDefault();
              step(-1);
              break;
            case 'Home':
              event.preventDefault();
              select(list[0]?.id, { focus: true });
              break;
            case 'End':
              event.preventDefault();
              select(list.at(-1)?.id, { focus: true });
              break;
            default:
              break;
          }
        },
      },
    },
    list.map((tab) => {
      const button = h(
        'button',
        {
          type: 'button',
          class: 'tabs__tab',
          role: 'tab',
          id: `${id}-tab-${tab.id}`,
          'aria-controls': panelId,
          'aria-selected': 'false',
          tabIndex: -1,
          onClick: () => select(tab.id),
        },
        tab.iconName ? icon(tab.iconName, { size: 14 }) : null,
        h('span', { text: tab.label }),
        tab.badge ? h('span', { class: 'tabs__badge', text: tab.badge }) : null,
      );
      buttons.set(tab.id, button);
      return button;
    }),
  );

  select(current, { silent: true });

  return {
    el,
    get active() {
      return current;
    },
    select,
    destroy() {
      buttons.clear();
    },
  };
}

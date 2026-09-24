/**
 * Micro DOM layer.
 *
 * We deliberately ship no framework: GitBooklet is a single-purpose tool and a
 * ~40 kB bundle that starts instantly is part of the product. These helpers
 * give us declarative-enough rendering plus a keyed list reconciler, which is
 * the one thing hand-rolled UI code usually gets wrong (focus loss on re-render).
 *
 * @module core/dom
 */

/** Properties that must be assigned as DOM props rather than attributes. */
const DOM_PROPS = new Set([
  'value',
  'checked',
  'disabled',
  'selected',
  'readOnly',
  'indeterminate',
  'multiple',
  'hidden',
  'tabIndex',
]);

function applyClass(el, value) {
  if (value == null || value === false) return;
  if (typeof value === 'string') {
    el.className = value;
    return;
  }
  if (Array.isArray(value)) {
    el.className = value.filter(Boolean).join(' ');
    return;
  }
  if (value instanceof Set) {
    el.className = [...value].filter(Boolean).join(' ');
    return;
  }
  if (typeof value === 'object') {
    el.className = Object.entries(value)
      .filter(([, active]) => Boolean(active))
      .map(([name]) => name)
      .join(' ');
  }
}

function applyStyle(el, value) {
  if (value == null) return;
  if (typeof value === 'string') {
    el.setAttribute('style', value);
    return;
  }
  for (const [prop, propValue] of Object.entries(value)) {
    if (propValue == null || propValue === false) el.style.removeProperty(prop);
    else el.style.setProperty(prop, String(propValue));
  }
}

/**
 * Hyperscript-style element factory.
 *
 * ```js
 * h('button', { class: 'btn btn-primary', onClick: run, 'aria-label': label },
 *   icon(Icons.github), h('span', null, t('repos.fetch')))
 * ```
 *
 * `props` may be omitted entirely: `h('p', 'hello')`.
 *
 * @param {string} tag
 * @param {object|string|Node|Array|null} [props]
 * @param {...(string|number|Node|Array|null|undefined|false)} children
 * @returns {HTMLElement}
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);

  let rest = children;
  let attrs = props;
  if (props == null || typeof props !== 'object' || props instanceof Node || Array.isArray(props)) {
    attrs = null;
    rest = props === undefined ? children : [props, ...children];
  }

  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null || value === false) {
        if (DOM_PROPS.has(key)) el[key] = key === 'value' ? '' : false;
        else el.removeAttribute(key);
        continue;
      }

      if (key === 'class' || key === 'className') applyClass(el, value);
      else if (key === 'style') applyStyle(el, value);
      else if (key === 'dataset') Object.assign(el.dataset, value);
      else if (key === 'ref' && typeof value === 'function') value(el);
      else if (key === 'html') el.innerHTML = String(value);
      else if (key === 'text') el.textContent = String(value);
      else if (key === 'on' && typeof value === 'object') {
        for (const [type, handler] of Object.entries(value)) on(el, type, handler);
      } else if (key.startsWith('on') && typeof value === 'function') {
        on(el, key.slice(2).toLowerCase(), value);
      } else if (DOM_PROPS.has(key)) el[key] = value;
      else el.setAttribute(key, value === true ? '' : String(value));
    }
  }

  append(el, ...rest);
  return el;
}

/** Append children, flattening arrays and ignoring nullish/boolean values. */
export function append(parent, ...children) {
  for (const child of children) {
    if (child == null || child === false || child === true) continue;
    if (Array.isArray(child)) {
      append(parent, ...child);
    } else if (child instanceof Node) {
      parent.append(child);
    } else {
      parent.append(document.createTextNode(String(child)));
    }
  }
  return parent;
}

/** Build a DocumentFragment from children (handy for table rows). */
export function fragment(...children) {
  return append(document.createDocumentFragment(), ...children);
}

/** Remove every child node without touching the element itself. */
export function clear(el) {
  if (!el) return el;
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** Replace all children of `root` with `children`. */
export function mount(root, ...children) {
  if (!root) return root;
  clear(root);
  append(root, ...children);
  return root;
}

/**
 * Add an event listener, optionally delegated.
 * @returns {() => void} disposer
 */
export function on(target, type, selectorOrHandler, maybeHandler, options) {
  if (!target) return () => {};

  if (typeof selectorOrHandler === 'function') {
    target.addEventListener(type, selectorOrHandler, maybeHandler);
    return () => target.removeEventListener(type, selectorOrHandler, maybeHandler);
  }

  const selector = selectorOrHandler;
  const handler = maybeHandler;
  const delegated = (event) => {
    const match = event.target instanceof Element ? event.target.closest(selector) : null;
    if (match && target.contains(match)) handler(event, match);
  };
  target.addEventListener(type, delegated, options);
  return () => target.removeEventListener(type, delegated, options);
}

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

/**
 * Write a value into an input without stealing the caret.
 * Skips the write while the user is actively editing that exact field.
 */
export function setInputValue(input, value) {
  if (!input) return;
  const next = value == null ? '' : String(value);
  if (input.value === next) return;
  if (document.activeElement === input) return;
  input.value = next;
}

/** Assign a text value only when it actually changed (avoids layout thrash). */
export function setText(el, value) {
  if (!el) return;
  const next = value == null ? '' : String(value);
  if (el.textContent !== next) el.textContent = next;
}

/** Toggle an attribute only when needed. */
export function setAttr(el, name, value) {
  if (!el) return;
  const next = value == null || value === false ? null : value === true ? '' : String(value);
  if (next === null) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
    return;
  }
  if (el.getAttribute(name) !== next) el.setAttribute(name, next);
}

/** Move focus to the first focusable element inside a container. */
export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusFirst(container, { fallbackToContainer = true } = {}) {
  const target = qs(FOCUSABLE, container);
  if (target) {
    target.focus();
    return target;
  }
  if (fallbackToContainer) {
    if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
    container.focus();
    return container;
  }
  return null;
}

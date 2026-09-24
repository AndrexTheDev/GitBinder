/**
 * Form building blocks.
 *
 * Every label/hint/placeholder is emitted twice:
 *   1. as resolved text (so the very first paint is already translated), and
 *   2. as a `data-i18n-*` binding (so `i18n.applyTo()` can swap the string in
 *      place the instant the visitor flips EN ⇄ DE — no re-render, no lost
 *      focus, no lost caret position).
 *
 * @module components/ui/Field
 */

import { h } from '../../core/dom.js';
import { icon } from './Icon.js';

let uid = 0;
const nextId = (prefix = 'field') => `${prefix}-${(uid += 1)}`;

/**
 * @param {object} options
 * @param {(key: string, params?: object) => string} options.t
 * @param {string} [options.id]
 * @param {string} [options.label]            resolved text
 * @param {string} [options.labelKey]         i18n key (enables instant switching)
 * @param {string} [options.hint]
 * @param {string} [options.hintKey]
 * @param {string} [options.errorKey]
 * @param {boolean} [options.optional]
 * @param {string} [options.optionalLabel='optional']
 */
export function createFieldShell(options) {
  const { t, label, labelKey, hint, hintKey, optional = false, optionalLabel } = options;
  const id = options.id ?? nextId();

  const labelText = label ?? (labelKey ? t(labelKey) : '');
  const labelEl = h('span', {
    class: 'label',
    ...(labelKey ? { 'data-i18n': labelKey } : {}),
    text: labelText,
  });

  const optionalEl = optional
    ? h('span', { class: 'ml-auto text-2xs font-medium uppercase tracking-wide text-ink-400', text: optionalLabel ?? t('common.optional') })
    : null;

  const hintEl = hint || hintKey
    ? h('p', {
        class: 'hint',
        id: `${id}-hint`,
        ...(hintKey ? { 'data-i18n': hintKey } : {}),
        text: hint ?? t(hintKey),
      })
    : null;

  const errorEl = h('p', {
    class: 'hidden items-center gap-1 text-xs font-medium text-crimson-700',
    id: `${id}-error`,
    role: 'alert',
  });

  const controlSlot = h('div', { class: 'flex flex-col gap-1' });

  const el = h(
    'div',
    { class: 'field' },
    h('div', { class: 'flex items-baseline gap-2' }, labelEl, optionalEl),
    controlSlot,
    hintEl,
    errorEl,
  );

  return {
    el,
    id,
    labelEl,
    hintEl,
    errorEl,
    controlSlot,
    /** @param {string|null} message */
    setError(message) {
      if (!message) {
        errorEl.classList.add('hidden');
        errorEl.classList.remove('flex');
        errorEl.textContent = '';
        return;
      }
      errorEl.textContent = '';
      errorEl.append(icon('alert', { size: 13 }), h('span', { text: message }));
      errorEl.classList.remove('hidden');
      errorEl.classList.add('flex');
    },
  };
}

/**
 * Text-like input (`text`, `email`, `password`, `url`, `search`).
 *
 * @returns {{ el: HTMLElement, input: HTMLInputElement, setValue: (v:string)=>void,
 *             setError: (m:string|null)=>void, focus: () => void }}
 */
export function createTextField(options) {
  const {
    t,
    type = 'text',
    value = '',
    placeholder,
    placeholderKey,
    autocomplete,
    spellcheck = false,
    maxlength,
    inputmode,
    onInput,
    onChange,
    onBlur,
    onEnter,
    monospace = false,
    trailing = null,
  } = options;

  const shell = createFieldShell(options);

  const input = h('input', {
    id: shell.id,
    type,
    class: ['input', monospace ? 'font-mono text-[13px]' : null],
    value: value ?? '',
    placeholder: placeholder ?? (placeholderKey ? t(placeholderKey) : ''),
    ...(placeholderKey ? { 'data-i18n-placeholder': placeholderKey } : {}),
    autocomplete: autocomplete ?? (type === 'password' ? 'off' : 'on'),
    spellcheck: String(spellcheck),
    ...(maxlength ? { maxlength: String(maxlength) } : {}),
    ...(inputmode ? { inputmode } : {}),
    'aria-describedby': shell.hintEl ? `${shell.id}-hint` : null,
  });

  if (type === 'password') {
    // Never let the browser offer to store a token it cannot protect.
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('data-lpignore', 'true');
    input.setAttribute('data-form-type', 'other');
  }

  if (typeof onInput === 'function') input.addEventListener('input', () => onInput(input.value, input));
  if (typeof onChange === 'function') input.addEventListener('change', () => onChange(input.value, input));
  if (typeof onBlur === 'function') input.addEventListener('blur', () => onBlur(input.value, input));
  if (typeof onEnter === 'function') {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onEnter(input.value, input);
      }
    });
  }

  const control = trailing
    ? h('div', { class: 'input-affix' }, input, trailing)
    : input;

  shell.controlSlot.append(control);

  return {
    el: shell.el,
    input,
    shell,
    setValue(next) {
      const value = next == null ? '' : String(next);
      if (input.value !== value && document.activeElement !== input) input.value = value;
    },
    setError: shell.setError,
    focus: () => input.focus(),
  };
}

/**
 * Native `<select>` styled as part of the design system.
 * @param {{ options?: Array<{ value: string, labelKey?: string, label?: string }>, value?: string,
 *           onChange?: (value: string) => void }} options
 */
export function createSelectField(options) {
  const { t, value = '', onChange } = options;
  const selectOptions = options.selectOptions ?? options.options ?? [];
  const shell = createFieldShell(options);

  const select = h(
    'select',
    {
      id: shell.id,
      class: 'input',
      'aria-describedby': shell.hintEl ? `${shell.id}-hint` : null,
      onChange: (event) => onChange?.(event.target.value),
    },
    selectOptions.map((option) =>
      h('option', {
        value: option.value,
        selected: option.value === value,
        ...(option.labelKey ? { 'data-i18n': option.labelKey } : {}),
        text: option.label ?? (option.labelKey ? t(option.labelKey) : option.value),
      }),
    ),
  );

  shell.controlSlot.append(select);

  return {
    el: shell.el,
    select,
    setValue(next) {
      if (select.value !== next) select.value = next;
    },
    setError: shell.setError,
  };
}

/** Accessible checkbox row with a label and an optional description. */
export function createCheckbox({ t, checked = false, labelKey, label, hintKey, hint, onChange, id }) {
  const fieldId = id ?? nextId('check');

  const box = h('input', {
    id: fieldId,
    type: 'checkbox',
    class: 'checkbox mt-0.5',
    checked,
    onChange: (event) => onChange?.(event.target.checked),
  });

  const labelEl = h(
    'label',
    {
      for: fieldId,
      class: 'cursor-pointer text-sm font-medium text-ink-800',
      ...(labelKey ? { 'data-i18n': labelKey } : {}),
    },
    label ?? (labelKey ? t(labelKey) : ''),
  );

  const hintEl = hint || hintKey
    ? h('p', {
        class: 'mt-0.5 text-xs leading-relaxed text-ink-500',
        ...(hintKey ? { 'data-i18n': hintKey } : {}),
        text: hint ?? (hintKey ? t(hintKey) : ''),
      })
    : null;

  const el = h('div', { class: 'flex items-start gap-2.5' }, box, h('div', { class: 'min-w-0' }, labelEl, hintEl));

  return {
    el,
    input: box,
    setChecked(next) {
      if (box.checked !== Boolean(next)) box.checked = Boolean(next);
    },
  };
}

/** Section heading used inside the settings drawer. */
export function sectionHeading({ t, titleKey, title, descriptionKey, description, iconName }) {
  return h(
    'div',
    { class: 'mb-3 flex items-start gap-2.5' },
    iconName
      ? h('span', { class: 'mt-0.5 text-brass-600' }, icon(iconName, { size: 16 }))
      : null,
    h(
      'div',
      { class: 'min-w-0' },
      h('h3', {
        class: 'text-2xs font-bold uppercase tracking-[0.14em] text-ink-500',
        ...(titleKey ? { 'data-i18n': titleKey } : {}),
        text: title ?? (titleKey ? t(titleKey) : ''),
      }),
      description || descriptionKey
        ? h('p', {
            class: 'mt-0.5 text-xs leading-relaxed text-ink-500',
            ...(descriptionKey ? { 'data-i18n': descriptionKey } : {}),
            text: description ?? t(descriptionKey),
          })
        : null,
    ),
  );
}

/** Inline callout used for security notes and destructive-action warnings. */
export function noteBox({ t, tone = 'info', titleKey, title, textKey, text, iconName, children = [] }) {
  const tones = {
    info: 'border-azure-100 bg-azure-100/50 text-azure-700',
    warning: 'border-ember-100 bg-ember-100/50 text-ember-700',
    danger: 'border-crimson-100 bg-crimson-100/50 text-crimson-700',
    success: 'border-forest-100 bg-forest-100/50 text-forest-700',
    neutral: 'border-paper-300 bg-paper-100 text-ink-600',
  };
  const icons = { info: 'info', warning: 'warning', danger: 'alert', success: 'success', neutral: 'info' };

  return h(
    'div',
    { class: ['flex gap-2.5 rounded-lg border p-3 text-xs leading-relaxed', tones[tone] ?? tones.info] },
    h('span', { class: 'mt-px shrink-0' }, icon(iconName ?? icons[tone] ?? 'info', { size: 15 })),
    h(
      'div',
      { class: 'min-w-0' },
      title || titleKey
        ? h('p', {
            class: 'font-semibold',
            ...(titleKey ? { 'data-i18n': titleKey } : {}),
            text: title ?? t(titleKey),
          })
        : null,
      text || textKey
        ? h('p', {
            class: [title || titleKey ? 'mt-1' : null, 'opacity-90'],
            ...(textKey ? { 'data-i18n': textKey } : {}),
            text: text ?? t(textKey),
          })
        : null,
      ...children,
    ),
  );
}

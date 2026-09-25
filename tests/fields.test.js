/**
 * The form primitives — `src/components/ui/Field.js`.
 *
 * Every input in the app is built here, and these are the parts a screenshot
 * cannot review:
 *
 *   • whether a visible label is actually *associated* with its control (this
 *     shipped broken once: styled `<span>`s that read fine and associated
 *     nothing),
 *   • whether a focused field survives a re-render that sets a value (the
 *     settings drawer refreshes while a visitor types),
 *   • whether an error message reaches a screen reader and marks the control
 *     it belongs to,
 *   • whether the password field is hardened against the browser offering to
 *     remember a token it cannot protect.
 *
 * jsdom is enough for all of it: this is about attributes, events and the
 * associations between elements, not about pixels.
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createCheckbox,
  createFieldShell,
  createSelectField,
  createTextField,
  noteBox,
  sectionHeading,
} from '../src/components/ui/Field.js';
import { createDomEnvironment } from './helpers/dom.js';

/** The translator, stubbed: the keys are what the fields are handed. */
const t = (key) => `t:${key}`;

let environment;
let document;

before(() => {
  environment = createDomEnvironment();
  document = environment.document;
});

after(() => environment.cleanup());

beforeEach(() => {
  document.body.replaceChildren();
});

/** Attach an element to the document — focus only works on attached nodes. */
function mount(el) {
  document.body.append(el);
  return el;
}

/* -------------------------------------------------------------------------- *
 * The shell
 * -------------------------------------------------------------------------- */

describe('createFieldShell', () => {
  test('the visible label points at the control', () => {
    // The whole reason the shell exists. `label.control` is what a browser
    // uses to focus the input on click; if it is null, the "label" is a
    // decoration and the control has no accessible name.
    const shell = createFieldShell({ t, labelKey: 'settings.github.username', id: 'user' });
    const input = document.createElement('input');
    input.id = shell.id;
    shell.controlSlot.append(input);
    mount(shell.el);

    const label = shell.el.querySelector('label');
    assert.equal(shell.id, 'user');
    assert.equal(label.getAttribute('for'), 'user');
    assert.equal(label.control, input, 'the label is not associated with its control');
    assert.equal(label.textContent, 't:settings.github.username');
  });

  test('a label without a key uses the text it was given', () => {
    const shell = createFieldShell({ t, label: 'Custom' });
    assert.equal(shell.el.querySelector('label').textContent, 'Custom');
  });

  test('two fields never share an id', () => {
    // A duplicated id points one field's label into its neighbour — the label
    // then focuses the wrong input, and an error message marks the wrong
    // control. This happens the moment ids are hand-written instead of minted.
    const ids = new Set();
    for (let i = 0; i < 24; i += 1) ids.add(createFieldShell({ t, label: 'x' }).id);
    assert.equal(ids.size, 24, 'two shells were minted the same id');

    const checks = new Set();
    for (let i = 0; i < 24; i += 1) checks.add(document.createElement('input') && createCheckbox({ t, label: 'y' }).input.id);
    assert.equal(checks.size, 24, 'two checkboxes were minted the same id');
  });

  test('the label is text-only, because a language switch rewrites it', () => {
    // `data-i18n` makes `applyTo()` assign `textContent`, which deletes every
    // child. On a label that wraps a control that is data loss — here it is
    // safe *because* the element holds nothing but its own text, and this test
    // is what keeps it that way.
    const shell = createFieldShell({ t, labelKey: 'settings.book.title' });
    const label = shell.el.querySelector('label');
    assert.equal(label.children.length, 0);
    assert.equal(label.getAttribute('data-i18n'), 'settings.book.title');
  });

  test('a hint is announced, and its absence is not described', () => {
    // `aria-describedby` pointing at nothing is worse than no attribute: some
    // screen readers announce "described by" and stop.
    const withHint = createFieldShell({ t, label: 'A', hintKey: 'some.hint' });
    const withHintInput = document.createElement('input');
    withHintInput.setAttribute('aria-describedby', withHint.hintEl ? `${withHint.id}-hint` : '');
    withHint.controlSlot.append(withHintInput);
    mount(withHint.el);

    assert.equal(withHint.hintEl.id, `${withHint.id}-hint`);
    assert.equal(withHintInput.getAttribute('aria-describedby'), withHint.hintEl.id);
    assert.equal(document.getElementById(withHint.hintEl.id), withHint.hintEl);

    const withoutHint = createFieldShell({ t, label: 'B' });
    assert.equal(withoutHint.hintEl, null);
  });

  test('an optional field is marked as optional, a required one is not', () => {
    const optional = createFieldShell({ t, label: 'A', optional: true });
    const required = createFieldShell({ t, label: 'B' });

    assert.equal(optional.el.textContent.includes('t:common.optional'), true);
    assert.equal(required.el.textContent.includes('t:common.optional'), false);
  });

  test('an error marks the control, not just the message', () => {
    // `role="alert"` announces the text; `aria-invalid` is what tells a screen
    // reader that *this input* is the problem. Without it, somebody filling in
    // a form hears the complaint but not where it belongs.
    const shell = createFieldShell({ t, label: 'Token' });
    const input = document.createElement('input');
    shell.controlSlot.append(input);
    mount(shell.el);

    assert.equal(shell.errorEl.getAttribute('role'), 'alert');
    assert.equal(shell.errorEl.classList.contains('hidden'), true);
    assert.equal(input.hasAttribute('aria-invalid'), false);

    shell.setError('That token is not valid');

    assert.equal(shell.errorEl.textContent, 'That token is not valid');
    assert.equal(shell.errorEl.classList.contains('hidden'), false);
    assert.equal(input.getAttribute('aria-invalid'), 'true');

    shell.setError(null);

    assert.equal(shell.errorEl.textContent, '');
    assert.equal(shell.errorEl.classList.contains('hidden'), true);
    assert.equal(input.hasAttribute('aria-invalid'), false, 'the field stays marked as invalid');
  });

  test('an error with no control to mark is still shown', () => {
    const shell = createFieldShell({ t, label: 'Token' });
    assert.doesNotThrow(() => shell.setError('something went wrong'));
    assert.equal(shell.errorEl.textContent, 'something went wrong');
  });
});

/* -------------------------------------------------------------------------- *
 * The inputs
 * -------------------------------------------------------------------------- */

describe('createTextField', () => {
  test('the input carries the shell id, the hint and the placeholder key', () => {
    const field = createTextField({
      t,
      label: 'Username',
      hintKey: 'settings.github.username.hint',
      placeholderKey: 'settings.github.username.placeholder',
      value: 'octocat',
    });
    mount(field.el);

    assert.equal(field.input.id, field.shell.id);
    assert.equal(field.input.getAttribute('aria-describedby'), `${field.shell.id}-hint`);
    assert.equal(field.input.getAttribute('placeholder'), 't:settings.github.username.placeholder');
    assert.equal(field.input.getAttribute('data-i18n-placeholder'), 'settings.github.username.placeholder');
    assert.equal(field.input.value, 'octocat');
    assert.equal(field.el.querySelector('label').control, field.input);
  });

  test('setValue leaves a field the visitor is typing in alone', () => {
    // The drawer re-renders on every store change — a fetch finishing, a
    // status edit somewhere else in the page. Assigning to a focused input
    // would move the caret and swallow half-typed text.
    const field = createTextField({ t, label: 'Title', value: 'Typed by hand' });
    mount(field.el);

    field.input.focus();
    assert.equal(document.activeElement, field.input, 'the input cannot take focus');

    field.setValue('From the store');
    assert.equal(field.input.value, 'Typed by hand', 'the field was overwritten while focused');

    field.input.blur();
    field.setValue('From the store');
    assert.equal(field.input.value, 'From the store', 'setValue stopped working after a blur');
  });

  test('setValue treats null as empty rather than as "null"', () => {
    const field = createTextField({ t, label: 'Title', value: 'x' });
    field.setValue(null);
    assert.equal(field.input.value, '');
    field.setValue(42);
    assert.equal(field.input.value, '42');
  });

  test('Enter is reported and does not reach the form', () => {
    // Enter in the username field triggers the fetch; the default would submit
    // and reload a page that has no server to submit to.
    const seen = [];
    const field = createTextField({ t, label: 'Username', value: 'octocat', onEnter: (value) => seen.push(value) });
    mount(field.el);

    const event = new environment.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    field.input.dispatchEvent(event);

    assert.deepEqual(seen, ['octocat']);
    assert.equal(event.defaultPrevented, true, 'the default action was not prevented');

    field.input.dispatchEvent(new environment.window.KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    assert.deepEqual(seen, ['octocat'], 'a normal keystroke was reported as Enter');
  });

  test('a token field is hardened against password managers', () => {
    // A personal access token is not a password: the browser must not offer to
    // remember it, and several managers inject their own widgets into
    // `password` fields. None of them can protect a value that lives in
    // localStorage, so they are told to stay out.
    const field = createTextField({ t, label: 'Token', type: 'password' });
    assert.equal(field.input.getAttribute('autocomplete'), 'off');
    assert.equal(field.input.getAttribute('data-lpignore'), 'true');
    assert.equal(field.input.getAttribute('data-form-type'), 'other');
    assert.equal(field.input.type, 'password');
  });

  test('a plain field keeps autocomplete on', () => {
    // The opposite default matters for the same reason: autofilling a username
    // is helpful.
    const field = createTextField({ t, label: 'Username' });
    assert.equal(field.input.getAttribute('autocomplete'), 'on');
  });

  test('the optional attributes appear only when they were asked for', () => {
    const plain = createTextField({ t, label: 'A' });
    assert.equal(plain.input.hasAttribute('maxlength'), false);
    assert.equal(plain.input.hasAttribute('inputmode'), false);
    assert.equal(plain.input.getAttribute('spellcheck'), 'false');
    assert.equal(plain.el.querySelector('.input-affix'), null);

    const rich = createTextField({ t, label: 'B', maxlength: 39, inputmode: 'numeric', monospace: true, trailing: document.createElement('button') });
    assert.equal(rich.input.getAttribute('maxlength'), '39');
    assert.equal(rich.input.getAttribute('inputmode'), 'numeric');
    assert.equal(rich.input.classList.contains('font-mono'), true);
    // The affix wrapper is what lets a button sit inside the field's border.
    const affix = rich.el.querySelector('.input-affix');
    assert.ok(affix, 'trailing content was not wrapped');
    assert.equal(affix.contains(rich.input), true);
  });

  test('input, change and blur reach their handlers with the current value', () => {
    const events = [];
    const field = createTextField({
      t,
      label: 'Username',
      onInput: (value) => events.push(['input', value]),
      onChange: (value) => events.push(['change', value]),
      onBlur: (value) => events.push(['blur', value]),
    });
    mount(field.el);

    field.input.value = 'octo';
    field.input.dispatchEvent(new environment.window.Event('input', { bubbles: true }));
    field.input.dispatchEvent(new environment.window.Event('change', { bubbles: true }));
    field.input.dispatchEvent(new environment.window.Event('blur', { bubbles: true }));

    assert.deepEqual(events, [
      ['input', 'octo'],
      ['change', 'octo'],
      ['blur', 'octo'],
    ]);
  });
});

describe('createSelectField', () => {
  test('the options are rendered and the current one is selected', () => {
    const field = createSelectField({
      t,
      label: 'Sort',
      value: 'name',
      options: [
        { value: 'status', labelKey: 'library.sort.status' },
        { value: 'name', labelKey: 'library.sort.name' },
      ],
    });
    mount(field.el);

    const options = [...field.select.options];
    assert.deepEqual(options.map((option) => option.value), ['status', 'name']);
    assert.equal(options[0].textContent, 't:library.sort.status');
    assert.equal(options[0].getAttribute('data-i18n'), 'library.sort.status');
    assert.equal(field.select.value, 'name');
    assert.equal(field.el.querySelector('label').control, field.select);
  });

  test('choosing an option reports its value', () => {
    const seen = [];
    const field = createSelectField({
      t,
      label: 'Sort',
      value: 'status',
      options: [{ value: 'status' }, { value: 'name' }],
      onChange: (value) => seen.push(value),
    });
    mount(field.el);

    field.select.value = 'name';
    field.select.dispatchEvent(new environment.window.Event('change', { bubbles: true }));

    assert.deepEqual(seen, ['name']);
  });

  test('setValue selects, and an option without a key falls back to its value', () => {
    const field = createSelectField({ t, label: 'Language', options: [{ value: 'en' }, { value: 'de' }] });
    assert.equal(field.select.options[0].textContent, 'en');

    field.setValue('de');
    assert.equal(field.select.value, 'de');
  });
});

describe('createCheckbox', () => {
  test('the label is associated, and does not wrap the control', () => {
    // Wrapping is the tempting shortcut, and it is what made a language switch
    // delete the "Hide forks" checkbox: the label carried `data-i18n` and
    // `textContent = …` removed the input with it.
    const box = createCheckbox({ t, labelKey: 'library.hideForks', hintKey: 'library.hideForks.hint' });
    mount(box.el);

    const label = box.el.querySelector('label');
    assert.equal(label.getAttribute('for'), box.input.id);
    assert.equal(label.control, box.input);
    assert.equal(label.contains(box.input), false, 'the label wraps the control');
    assert.equal(label.children.length, 0, 'the label has children, so a language switch will eat them');
    assert.equal(box.input.checked, false);
  });

  test('ticking it reports a boolean', () => {
    const seen = [];
    const box = createCheckbox({ t, label: 'Forks', onChange: (checked) => seen.push(checked) });
    mount(box.el);

    box.input.checked = true;
    box.input.dispatchEvent(new environment.window.Event('change', { bubbles: true }));
    box.input.checked = false;
    box.input.dispatchEvent(new environment.window.Event('change', { bubbles: true }));

    assert.deepEqual(seen, [true, false]);
  });

  test('setChecked does not fight the visitor', () => {
    const box = createCheckbox({ t, label: 'Forks' });
    box.setChecked(true);
    assert.equal(box.input.checked, true);
    box.setChecked(1);
    assert.equal(box.input.checked, true);
    box.setChecked(false);
    assert.equal(box.input.checked, false);
  });
});

/* -------------------------------------------------------------------------- *
 * Static blocks
 * -------------------------------------------------------------------------- */

describe('sectionHeading and noteBox', () => {
  test('a heading is a heading, with an optional icon and description', () => {
    const heading = sectionHeading({
      t,
      titleKey: 'settings.section.github',
      descriptionKey: 'settings.section.github.description',
      iconName: 'github',
    });
    mount(heading);

    const title = heading.querySelector('h3');
    assert.equal(title.textContent, 't:settings.section.github');
    assert.equal(title.getAttribute('data-i18n'), 'settings.section.github');
    assert.equal(title.children.length, 0);
    assert.ok(heading.querySelector('svg'), 'the icon did not render');
    assert.equal(heading.querySelector('p').textContent, 't:settings.section.github.description');
  });

  test('a heading without an icon has no empty spacer', () => {
    const heading = sectionHeading({ t, title: 'Plain' });
    assert.equal(heading.querySelector('svg'), null);
    assert.equal(heading.querySelector('span'), null);
  });

  test('a note box changes its icon with its tone', () => {
    // The tone is what tells a visitor "this is a warning" before they read
    // the sentence; a danger note that renders with the info icon is a
    // credibility problem on a page that talks about tokens.
    const iconsFor = (tone) => noteBox({ t, tone, text: 'x' }).querySelector('svg').outerHTML;

    assert.equal(noteBox({ t, tone: 'danger', text: 'x' }).className.includes('crimson'), true);
    assert.equal(noteBox({ t, tone: 'warning', text: 'x' }).className.includes('ember'), true);
    assert.equal(noteBox({ t, tone: 'success', text: 'x' }).className.includes('forest'), true);
    assert.equal(noteBox({ t, tone: 'info', text: 'x' }).className.includes('azure'), true);

    assert.notEqual(iconsFor('danger'), iconsFor('warning'), 'two tones share an icon');
    assert.notEqual(iconsFor('danger'), iconsFor('info'));
    assert.equal(iconsFor('neutral'), iconsFor('info'), 'the fallback tone should reuse the info icon');
  });

  test('an unknown tone falls back instead of rendering an untoned box', () => {
    const box = noteBox({ t, tone: 'not-a-tone', text: 'x' });
    assert.equal(box.className.includes('azure'), true);
  });

  test('a note box takes its title and text from either source, and keeps its children', () => {
    const child = document.createElement('button');
    child.textContent = 'Retry';

    const box = noteBox({ t, titleKey: 'note.title', text: 'Read this', children: [child] });
    const texts = [...box.querySelectorAll('p')].map((p) => p.textContent);

    assert.deepEqual(texts, ['t:note.title', 'Read this']);
    assert.equal(box.contains(child), true, 'children were dropped');
  });
});

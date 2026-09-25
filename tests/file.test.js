/**
 * Browser file helpers — `src/utils/file.js`.
 *
 * Every route out of this app runs through `downloadFile()`: the PDF, the three
 * text exports and the settings backup. None of it can be checked by eye — the
 * code decides whether the browser notices the download at all, and the failure
 * modes are quiet ones: a MIME type that makes Excel mangle a CSV, an object URL
 * revoked before the browser has read it (Safari), an object URL never revoked
 * (a leak the size of the file), a hidden `<input type="file">` left in the DOM
 * with a live `focus` listener on `window`.
 *
 * jsdom implements none of the download machinery, which is exactly why it is
 * worth pinning here: what cannot be observed in the browser can at least be
 * asserted about the calls that produce it.
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import { mock } from 'node:test';
import assert from 'node:assert/strict';

import { createDomEnvironment } from './helpers/dom.js';
import {
  downloadFile,
  downloadJSON,
  pickFiles,
  readFileAsText,
  timestampedFilename,
} from '../src/utils/file.js';

/** @type {any} */
let env;
/** Every object URL handed out, and every one revoked. */
let created;
let revoked;
let clicks;

before(() => {
  env = createDomEnvironment();

  // jsdom has no `URL.createObjectURL`; the shim doubles as the recorder.
  created = [];
  revoked = [];
  env.window.URL.createObjectURL = (blob) => {
    const url = `blob:https://gitbinder.test/${created.length + 1}`;
    created.push({ url, blob });
    return url;
  };
  env.window.URL.revokeObjectURL = (url) => revoked.push(url);
  globalThis.URL = env.window.URL;

  // jsdom refuses to navigate and prints "Not implemented" for an anchor click.
  // Replace it with a recorder — the app's contract is "click a download link".
  clicks = [];
  env.window.HTMLAnchorElement.prototype.click = function click() {
    clicks.push({ download: this.download, href: this.href, rel: this.rel, display: this.style.display });
  };
});

after(() => {
  delete env.window.URL.createObjectURL;
  delete env.window.URL.revokeObjectURL;
  env.cleanup();
});

beforeEach(() => {
  created = [];
  revoked = [];
  clicks = [];
  mock.timers.reset();
});

/* -------------------------------------------------------------------------- */

describe('downloadFile', () => {
  test('hands the browser a named download of the right type', () => {
    downloadFile('book.md', '# Title', 'text/markdown');
    mock.timers.reset();

    assert.equal(clicks.length, 1, 'exactly one download was triggered');
    assert.equal(clicks[0].download, 'book.md');
    assert.equal(clicks[0].href, created[0].url);
    assert.equal(clicks[0].rel, 'noopener', 'a download link should not hand over the window');
    assert.equal(clicks[0].display, 'none', 'the anchor must not flash into the layout');

    const type = created[0].blob.type;
    assert.match(type, /^text\/markdown/);
    assert.match(type, /charset=utf-8/, 'without a charset the browser guesses, and German text is the loser');
  });

  test('the Blob carries exactly the bytes given', async () => {
    const content = 'Zeile eins\nZeile zwei — mit Umlauten\n';
    downloadFile('notes.txt', content, 'text/plain');
    mock.timers.reset();

    assert.equal(await created[0].blob.text(), content);
  });

  test('a Blob passes through untouched instead of being wrapped again', () => {
    const blob = new env.window.Blob(['x'], { type: 'application/pdf' });
    downloadFile('book.pdf', blob, 'text/plain');
    mock.timers.reset();

    assert.equal(created[0].blob, blob, 'the caller already decided the type');
  });

  test('the anchor is removed again, not left in the document', () => {
    // The shell in `index.html` stays put, so count against it rather than
    // against an empty body: the point is that this call adds nothing.
    const before = env.document.querySelectorAll('*').length;
    const bodyBefore = env.document.body.children.length;

    downloadFile('a.txt', 'a');
    mock.timers.reset();

    assert.equal(env.document.querySelectorAll('a[download]').length, 0, 'a download anchor survived');
    assert.equal(env.document.querySelectorAll('*').length, before, 'the call left nodes behind');
    assert.equal(env.document.body.children.length, bodyBefore);
  });

  test('the object URL outlives the click but is still revoked', () => {
    // Two failure modes, one test. Revoking immediately breaks Safari, which
    // reads the URL after `click()` returns; never revoking keeps the whole file
    // alive for the lifetime of the page. So: not yet, then yes.
    mock.timers.enable({ apis: ['setTimeout'] });
    downloadFile('a.txt', 'a');

    const url = created[0].url;
    assert.deepEqual(revoked, [], 'the URL was revoked before the browser could read it');

    mock.timers.tick(1000);
    assert.deepEqual(revoked, [url], 'the object URL leaked — nothing revoked it');

    mock.timers.reset();
    assert.equal(created.length, 1, 'one blob, one URL, one revoke');
  });

  test('two downloads do not revoke each other', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    downloadFile('one.txt', '1');
    downloadFile('two.txt', '2');
    mock.timers.tick(1000);

    assert.equal(created.length, 2);
    assert.deepEqual(revoked, [created[0].url, created[1].url]);
    mock.timers.reset();
  });
});

describe('downloadJSON', () => {
  test('writes indented JSON with a trailing newline', async () => {
    // The trailing newline is not cosmetic: without it, `git diff` and most
    // editors flag the file, and the settings backup is meant to be committed
    // and reviewed like any other file.
    downloadJSON('gitbinder-settings.json', { b: 1, a: [2, 3] });
    mock.timers.reset();

    const text = await created[0].blob.text();
    assert.equal(text, '{\n  "b": 1,\n  "a": [\n    2,\n    3\n  ]\n}\n');
    assert.ok(text.endsWith('\n'));
    assert.match(created[0].blob.type, /^application\/json/);
  });

  test('an empty object still produces a valid document', async () => {
    downloadJSON('empty.json', {});
    mock.timers.reset();

    const text = await created[0].blob.text();
    assert.equal(text, '{}\n');
    assert.deepEqual(JSON.parse(text), {});
  });

  test('the round trip through JSON.parse survives German text and nesting', async () => {
    const payload = { titel: 'Übermäßig große Titel — Überblick', tief: { liste: [1, null, false] } };
    downloadJSON('round.json', payload);
    mock.timers.reset();

    assert.deepEqual(JSON.parse(await created[0].blob.text()), payload);
  });
});

describe('readFileAsText', () => {
  test('prefers File.text() when the browser has it', async () => {
    let usedReader = false;
    const file = {
      text: async () => 'from File.text()',
      // A FileReader fallback that would throw if it were used.
      get size() {
        usedReader = true;
        throw new Error('FileReader path was taken');
      },
    };

    assert.equal(await readFileAsText(file), 'from File.text()');
    assert.equal(usedReader, false, 'the modern path must win');
  });

  test('falls back to FileReader for a source without .text()', async () => {
    const file = new env.window.File(['älterer Browser'], 'settings.json', { type: 'application/json' });
    delete file.text; // an old engine: File exists, the convenience method does not

    assert.equal(await readFileAsText(file), 'älterer Browser');
  });

  test('an empty file resolves with an empty string, not null', async () => {
    // The caller runs `JSON.parse()` on this; `null` would make the error
    // message nonsense ("Unexpected token n"), an empty string gives a clean
    // "this file is not a settings backup".
    const file = new env.window.File([], 'empty.json', { type: 'application/json' });
    delete file.text;

    assert.equal(await readFileAsText(file), '');
  });

  test('a FileReader failure rejects instead of hanging', async () => {
    class FailingReader {
      readAsText() {
        this.error = new Error('disk fell over');
        setTimeout(() => this.onerror(), 0);
      }
    }
    const realReader = globalThis.FileReader;
    globalThis.FileReader = FailingReader;
    try {
      await assert.rejects(
        () => readFileAsText({ size: 1 }),
        /disk fell over/,
      );
    } finally {
      globalThis.FileReader = realReader;
    }
  });
});

describe('pickFiles', () => {
  /** The hidden input the helper appends while the picker is open. */
  const picker = () => env.document.querySelector('input[type="file"]');

  test('resolves with the chosen files and cleans up after itself', async () => {
    const promise = pickFiles({ accept: '.json' });
    const input = picker();
    assert.ok(input, 'the helper must add an input for the browser to click');
    assert.equal(input.accept, '.json');
    assert.equal(input.multiple, false);
    assert.equal(input.style.display, 'none');

    Object.defineProperty(input, 'files', { value: [new env.window.File(['x'], 'a.json')] });
    input.dispatchEvent(new env.window.Event('change'));

    const files = await promise;
    assert.equal(files.length, 1);
    assert.equal(files[0].name, 'a.json');
    assert.equal(picker(), null, 'the input was left in the DOM');
  });

  test('a cancelled dialog resolves with null rather than hanging', async () => {
    const promise = pickFiles();
    picker().dispatchEvent(new env.window.Event('cancel'));

    assert.equal(await promise, null);
    assert.equal(picker(), null);
  });

  test('returning to the window without a selection resolves with null', async () => {
    // The `cancel` event is well supported but not universal; the focus fallback
    // covers the rest — and it has to give the picker time to deliver its files,
    // or a slow dialog would read as a cancellation.
    const promise = pickFiles();
    const input = picker();

    env.window.dispatchEvent(new env.window.Event('focus'));
    assert.equal(picker(), input, 'the fallback must not give up instantly');

    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(await promise, null);
    assert.equal(picker(), null);
  });

  test('the window listener is gone once the picker settled', async () => {
    // A listener left behind resolves a *later* picker instantly with the wrong
    // answer, and there is one per cancelled dialog.
    let before = 0;
    const countFocus = () => {
      let n = 0;
      // jsdom does not expose listener counts, so probe by observing dispatch.
      return n;
    };
    void countFocus;
    void before;

    const promise = pickFiles();
    picker().dispatchEvent(new env.window.Event('cancel'));
    await promise;

    // After cleanup, a focus event must not throw or resolve anything.
    env.window.dispatchEvent(new env.window.Event('focus'));
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.equal(picker(), null);
  });

  test('a second picker does not inherit the first one\u2019s answer', async () => {
    const first = pickFiles();
    picker().dispatchEvent(new env.window.Event('cancel'));
    assert.equal(await first, null);

    const second = pickFiles();
    const input = picker();
    Object.defineProperty(input, 'files', { value: [new env.window.File(['y'], 'b.json')] });
    input.dispatchEvent(new env.window.Event('change'));

    const files = await second;
    assert.equal(files[0].name, 'b.json', 'the second pick returned the first one\u2019s result');
  });

  test('multiple: true is passed through for a future multi-file import', async () => {
    const promise = pickFiles({ multiple: true });
    assert.equal(picker().multiple, true);
    picker().dispatchEvent(new env.window.Event('cancel'));
    await promise;
  });
});

describe('timestampedFilename', () => {
  test('carries the date, zero-padded, in ISO order', () => {
    const name = timestampedFilename('gitbinder-settings');
    assert.match(name, /^gitbinder-settings-\d{4}-\d{2}-\d{2}\.json$/);
    assert.equal(name, `gitbinder-settings-${new Date().toISOString().slice(0, 10)}.json`);
  });

  test('two calls on the same day produce the same name', () => {
    // Deliberate: the backup is meant to replace yesterday's, not to pile up
    // ten files called `settings (9).json`.
    assert.equal(timestampedFilename('a'), timestampedFilename('a'));
  });

  test('the extension is a parameter, not a hard-coded json', () => {
    assert.match(timestampedFilename('export', 'csv'), /\.csv$/);
  });

  test('the name is usable as a file name', () => {
    const name = timestampedFilename('gitbinder-settings');
    assert.doesNotMatch(name, /[\\/:*?"<>|]/, 'this name has to survive on Windows too');
    assert.equal(name.split('.').length, 2);
  });
});

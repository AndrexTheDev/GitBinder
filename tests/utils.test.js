/**
 * Utility + object helper tests.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { clone, deepMerge, getPath, isEqual, isPlainObject, omit, pick, pathMatchesPrefix } from '../src/utils/object.js';
import {
  escapeHtml,
  formatBytes,
  formatCompact,
  formatRelativeTime,
  humanizeRepoName,
  isValidEmail,
  isValidGithubUsername,
  parseRepoSlug,
  truncate,
} from '../src/utils/format.js';
import { normalizeRepo } from '../src/services/github.js';
import { debounce } from '../src/utils/timing.js';

describe('object helpers', () => {
  test('isPlainObject', () => {
    assert.equal(isPlainObject({}), true);
    assert.equal(isPlainObject([]), false);
    assert.equal(isPlainObject(null), false);
    assert.equal(isPlainObject(new Date()), false);
  });

  test('isEqual handles nested structures', () => {
    assert.equal(isEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), true);
    assert.equal(isEqual({ a: 1 }, { a: 1, b: 2 }), false);
    assert.equal(isEqual(new Date(5), new Date(5)), true);
    assert.equal(isEqual([1, 2], [1, 2, 3]), false);
  });

  test('deepMerge merges objects, replaces arrays', () => {
    const base = { a: { x: 1, y: 2 }, list: [1, 2], keep: true };
    const merged = deepMerge(base, { a: { y: 9, z: 3 }, list: [7] });
    assert.deepEqual(merged.a, { x: 1, y: 9, z: 3 });
    assert.deepEqual(merged.list, [7]);
    assert.equal(merged.keep, true);
  });

  test('deepMerge ignores undefined values', () => {
    assert.deepEqual(deepMerge({ a: 1 }, { a: undefined }), { a: 1 });
  });

  test('clone is deep', () => {
    const source = { nested: { list: [1, 2] } };
    const copy = clone(source);
    copy.nested.list.push(3);
    assert.equal(source.nested.list.length, 2);
  });

  test('getPath with dot and array paths', () => {
    const data = { a: { b: { c: 42 } } };
    assert.equal(getPath(data, 'a.b.c'), 42);
    assert.equal(getPath(data, ['a', 'b', 'c']), 42);
    assert.equal(getPath(data, 'a.x.y', 'fallback'), 'fallback');
  });

  test('pathMatchesPrefix is segment aware', () => {
    assert.equal(pathMatchesPrefix('repoOverrides.me/app', 'repoOverrides'), true);
    assert.equal(pathMatchesPrefix('repoOverridesMe', 'repoOverrides'), false);
    assert.equal(pathMatchesPrefix('a.b', '*'), true);
  });

  test('omit / pick', () => {
    assert.deepEqual(omit({ a: 1, b: 2, c: 3 }, ['b']), { a: 1, c: 3 });
    assert.deepEqual(pick({ a: 1, b: 2, c: 3 }, ['a', 'c']), { a: 1, c: 3 });
  });
});

describe('format helpers', () => {
  test('escapeHtml neutralises injection', () => {
    assert.equal(escapeHtml('<img src=x onerror=alert(1)>&"'), '&lt;img src=x onerror=alert(1)&gt;&amp;&quot;');
  });

  test('truncate keeps a clean ellipsis', () => {
    assert.equal(truncate('a'.repeat(50), 10).length, 10);
    assert.equal(truncate('  spaced   out  '), 'spaced out');
  });

  test('github username validation follows GitHub rules', () => {
    assert.equal(isValidGithubUsername('AndrexTheDev'), true);
    assert.equal(isValidGithubUsername('-leading'), false);
    assert.equal(isValidGithubUsername('has--double'), false);
    assert.equal(isValidGithubUsername('a'.repeat(40)), false);
    assert.equal(isValidGithubUsername('valid-name1'), true);
  });

  test('email validation', () => {
    assert.equal(isValidEmail('hippie.highho@gmail.com'), true);
    assert.equal(isValidEmail('nope'), false);
    assert.equal(isValidEmail('a@b'), false);
  });

  test('parseRepoSlug accepts URLs, slugs and bare names', () => {
    assert.equal(parseRepoSlug('https://github.com/AndrexTheDev/GitBinder'), 'AndrexTheDev/GitBinder');
    assert.equal(parseRepoSlug('https://github.com/AndrexTheDev/GitBinder.git'), 'AndrexTheDev/GitBinder');
    assert.equal(parseRepoSlug('git@github.com:AndrexTheDev/GitBinder.git'), 'AndrexTheDev/GitBinder');
    assert.equal(parseRepoSlug('owner/repo'), 'owner/repo');
    assert.equal(parseRepoSlug('repo', 'owner'), 'owner/repo');
  });

  test('humanizeRepoName produces chapter titles', () => {
    assert.equal(humanizeRepoName('my-cool_app'), 'My Cool App');
    assert.equal(humanizeRepoName('camelCaseThing'), 'Camel Case Thing');
  });

  test('locale-aware formatting', () => {
    assert.equal(formatCompact(1500, 'en'), '1.5K');
    // German CLDR does not abbreviate thousands, only millions and above.
    assert.equal(formatCompact(1_500_000, 'en'), '1.5M');
    assert.equal(formatCompact(1_500_000, 'de'), '1,5\u00a0Mio.');
    assert.equal(formatBytes(2048, 'en'), '2 KB');
  });

  test('humanizeRepoName keeps acronyms intact', () => {
    assert.equal(humanizeRepoName('pdf-composer'), 'Pdf Composer');
    assert.equal(humanizeRepoName('the-great-escape'), 'The Great Escape');
  });

  test('relative time', () => {
    const now = Date.UTC(2024, 0, 10);
    const threeDaysAgo = new Date(now - 3 * 86400000);
    assert.match(formatRelativeTime(threeDaysAgo, 'en', now), /3 days ago/);
    assert.match(formatRelativeTime(threeDaysAgo, 'de', now), /3 Tagen/);
  });
});

describe('github service — normalizeRepo', () => {
  test('maps the fields the book needs', () => {
    const repo = normalizeRepo({
      id: 1,
      full_name: 'AndrexTheDev/GitBinder',
      name: 'GitBinder',
      owner: { login: 'AndrexTheDev' },
      html_url: 'https://github.com/AndrexTheDev/GitBinder',
      description: 'A book of your repos',
      language: 'JavaScript',
      stargazers_count: 10,
      forks_count: 2,
      open_issues_count: 3,
      fork: false,
      private: false,
      archived: true,
      default_branch: 'main',
      homepage: '',
      topics: ['pdf', 'github', 'extra'],
      license: { spdx_id: 'MIT', name: 'MIT License' },
      size: 512,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
      pushed_at: '2024-06-02T00:00:00Z',
    });

    assert.equal(repo.slug, 'AndrexTheDev/GitBinder');
    assert.equal(repo.owner, 'AndrexTheDev');
    assert.equal(repo.archived, true);
    assert.equal(repo.license, 'MIT');
    assert.equal(repo.homepage, null);
    assert.deepEqual(repo.topics, ['pdf', 'github', 'extra']);
    assert.equal(repo.sizeKb, 512);
  });

  test('survives a minimal payload', () => {
    const repo = normalizeRepo({ full_name: 'a/b' });
    assert.equal(repo.slug, 'a/b');
    assert.equal(repo.stars, 0);
    assert.equal(repo.license, null);
    assert.deepEqual(repo.topics, []);
  });
});

describe('debounce', () => {
  test('collapses rapid calls into one', async () => {
    let calls = 0;
    const fn = debounce(() => {
      calls += 1;
    }, 20);

    fn();
    fn();
    fn();
    assert.equal(calls, 0);

    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(calls, 1);
  });

  test('cancel() prevents the pending call', async () => {
    let calls = 0;
    const fn = debounce(() => {
      calls += 1;
    }, 10);
    fn();
    fn.cancel();
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(calls, 0);
  });

  test('flush() runs immediately', () => {
    let calls = 0;
    const fn = debounce(() => {
      calls += 1;
    }, 1000);
    fn();
    fn.flush();
    assert.equal(calls, 1);
  });
});

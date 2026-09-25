/**
 * Security invariants.
 *
 * Each of these is a property that holds today, would fail silently if it
 * stopped holding, and is cheap to re-check. They are the kind of thing that
 * regresses during an unrelated refactor — a token "helpfully" added to a query
 * string, a link built without `noopener` — so the point is to make the
 * regression loud rather than to discover it in production.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import { buildReposUrl, fetchUserRepos } from '../src/services/github.js';
import { safeUrl } from '../src/utils/format.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles() {
  const out = [join(ROOT, 'index.html')];
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.[jt]s$/.test(path)) out.push(path);
    }
  })(join(ROOT, 'src'));
  return out;
}

/* -------------------------------------------------------------------------- *
 * The access token
 * -------------------------------------------------------------------------- */

const TOKEN = 'ghp_DoNotLeakMe1234567890';

test('the token never reaches a request URL', async () => {
  // A token in a query string leaks in ways a header does not: into the
  // `Referer` of anything the response links to, into every proxy and server
  // log on the way, and into browser history. GitHub accepts `?access_token=`
  // on some endpoints, so this is a mistake that *works* — which is what makes
  // it worth a test.
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url: String(url), init });
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [],
    };
  };

  await fetchUserRepos({ username: 'octocat', token: TOKEN, fetchImpl });

  assert.ok(requests.length > 0, 'no request was made');
  for (const { url } of requests) {
    assert.equal(url.includes(TOKEN), false, `the token leaked into ${url}`);
    assert.equal(/access_token=|token=|authorization=/i.test(url), false, `credential in ${url}`);
  }
});

test('the token is sent as an Authorization header', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url: String(url), init });
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => [] };
  };

  await fetchUserRepos({ username: 'octocat', token: TOKEN, fetchImpl });

  for (const { init } of requests) {
    assert.equal(init?.headers?.Authorization, `Bearer ${TOKEN}`);
  }
});

test('no request carries credentials when no token was given', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url: String(url), init });
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => [] };
  };

  await fetchUserRepos({ username: 'octocat', fetchImpl });

  for (const { init } of requests) {
    assert.equal(init?.headers?.Authorization, undefined, 'an anonymous request was authenticated');
  }
});

test('buildReposUrl keeps the token out of the URL', () => {
  const { url, source } = buildReposUrl({ username: 'octocat', token: TOKEN });

  assert.equal(url.includes(TOKEN), false);
  // The token does change the request — it switches to the authenticated
  // endpoint — so it is not simply ignored either.
  assert.equal(source, 'user');
  assert.match(url, /\/user\/repos\?/);
  assert.equal(url.includes('affiliation=owner'), true);
});

/* -------------------------------------------------------------------------- *
 * URLs that come from other people
 * -------------------------------------------------------------------------- */

test('safeUrl refuses anything but http, https and mailto', () => {
  // Repository homepages arrive from the GitHub API, so the value in an `href`
  // can be chosen by whoever owns the repository — including for a book that
  // somebody generates from someone else's account.
  const dangerous = [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    '  javascript:alert(1)  ',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://example.com/uuid',
  ];
  for (const value of dangerous) {
    assert.equal(safeUrl(value, '#'), '#', `${value} was accepted`);
  }

  const allowed = ['https://example.com/a', 'http://example.com', 'mailto:hi@example.com'];
  for (const value of allowed) {
    assert.notEqual(safeUrl(value, '#'), '#', `${value} was refused`);
  }

  assert.equal(safeUrl('', '#'), '#');
  assert.equal(safeUrl(null, '#'), '#');
  assert.equal(safeUrl('not a url at all', '#'), '#');
});

test('a bare hostname becomes that host, not a path on this one', () => {
  // The mistake this guards is a quiet one. `new URL('example.com', base)`
  // does not throw — it resolves the value as a relative reference, so a
  // homepage typed the way GitHub users usually type it, without a scheme,
  // became `https://<this app>/example.com`. The book then printed that wrong
  // address and its link annotation pointed at this app instead of the user's
  // site, while the code that dropped unusable homepages looked like it was
  // working.
  assert.equal(safeUrl('example.com', '#'), 'https://example.com/');
  assert.equal(safeUrl('www.example.com', '#'), 'https://www.example.com/');
  assert.equal(safeUrl('meine-seite.de/projekt', '#'), 'https://meine-seite.de/projekt');
  assert.equal(safeUrl('example.com?x=1', '#'), 'https://example.com/?x=1');

  // Whatever the page happens to be, none of it leaks into the result.
  for (const value of ['example.com', 'www.example.com', 'meine-seite.de/projekt']) {
    assert.equal(/gitbinder|pages\.dev|localhost|127\.0\.0\.1/.test(safeUrl(value, '#')), false, value);
  }
});

test('prose is not turned into a link', () => {
  // "coming soon" and "my project" are realistic contents of a homepage field.
  // Both parse as relative references, so both used to become links.
  assert.equal(safeUrl('coming soon', '#'), '#');
  assert.equal(safeUrl('my project', '#'), '#');
  assert.equal(safeUrl('my-project', '#'), '#');
  assert.equal(safeUrl('WIP', '#'), '#');
});

/* -------------------------------------------------------------------------- *
 * Links out
 * -------------------------------------------------------------------------- */

test('every external link is opened without a handle back', () => {
  // `target="_blank"` without `rel="noopener"` hands the opened page a live
  // `window.opener` reference, which it can use to navigate this tab. Both
  // orderings are in the codebase, so the scan looks either way from the
  // `target` within the same — always small, because it is an attribute
  // object — window.
  const WINDOW = 240;
  const findings = [];

  for (const file of sourceFiles()) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/target['"]?\s*[:=]\s*['"]_blank['"]/g)) {
      const around = source.slice(Math.max(0, match.index - WINDOW), match.index + WINDOW);
      const rel = around.match(/rel['"]?\s*[:=]\s*['"]([^'"]+)['"]/);
      if (!rel || !/\bnoopener\b/.test(rel[1])) {
        const line = source.slice(0, match.index).split('\n').length;
        findings.push(`${relative(ROOT, file)}:${line}`);
      }
    }
  }

  assert.deepEqual(findings, [], `target="_blank" without rel="noopener" at ${findings.join(', ')}`);
});

/* -------------------------------------------------------------------------- *
 * What the book prints
 * -------------------------------------------------------------------------- */

test('a scheme-less homepage reaches the book as the right address', async () => {
  // The end of the path the two tests above protect: this is the value that is
  // typeset into the PDF and attached as its link annotation.
  const { buildEntryLinks } = await import('../src/book/compose.js');
  const { createTranslator } = await import('../src/i18n/index.js');
  const t = createTranslator({ locale: 'en' }).t;

  const links = buildEntryLinks(
    { url: 'https://github.com/octocat/demo', homepage: 'example.com' },
    t,
  );
  const home = links.find((link) => link.kind === 'home');

  assert.ok(home, 'the homepage was dropped instead of used');
  assert.equal(home.url, 'https://example.com/');
  assert.equal(/gitbinder|pages\.dev/.test(home.url), false, 'the link points at this app');
});

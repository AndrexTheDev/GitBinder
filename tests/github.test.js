/**
 * GitHub fetcher: endpoint selection, pagination, error mapping.
 *
 * `fetch` is injected, so no network is touched and every branch — including
 * the ones that only happen when GitHub is having a bad day — is reachable.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  GithubError,
  buildReposUrl,
  fetchUserRepos,
  lastPageFromLink,
  normalizeRepo,
  parseLinkHeader,
  verifyToken,
} from '../src/services/github.js';
import { GITHUB } from '../src/config/app.js';

const ISO = '2024-05-01T00:00:00Z';

/** Build a fake `fetch` that serves `pages` of repositories. */
function fakeGithub({ pages = 2, perPage = 2, linkHeader = true, failWith = null } = {}) {
  const requested = [];

  async function impl(url, options = {}) {
    requested.push({ url: String(url), options });
    const page = Number(new URL(String(url)).searchParams.get('page') ?? '1');

    if (failWith) {
      return {
        ok: false,
        status: failWith.status,
        headers: new Map(failWith.headers ?? []),
        json: async () => failWith.body ?? {},
      };
    }

    const headers = new Map([
      ['x-ratelimit-limit', '5000'],
      ['x-ratelimit-remaining', String(5000 - requested.length)],
      ['x-ratelimit-reset', '1717200000'],
    ]);
    if (linkHeader) {
      headers.set(
        'link',
        `<${GITHUB.apiBase}/user/repos?page=2>; rel="next", <${GITHUB.apiBase}/user/repos?page=${pages}>; rel="last"`,
      );
    }

    if (page > pages) return { ok: true, status: 200, headers, json: async () => [] };

    const body = Array.from({ length: perPage }, (_, i) => ({
      id: page * 100 + i,
      full_name: `octo/repo-${page}-${i}`,
      name: `repo-${page}-${i}`,
      owner: { login: 'octo' },
      html_url: `https://github.com/octo/repo-${page}-${i}`,
      description: `Repo ${page}-${i}`,
      language: 'TypeScript',
      stargazers_count: i,
      forks_count: 0,
      open_issues_count: 0,
      fork: false,
      private: false,
      archived: false,
      default_branch: 'main',
      homepage: '',
      topics: [],
      license: null,
      size: 10,
      created_at: ISO,
      updated_at: ISO,
      pushed_at: ISO,
    }));

    return { ok: true, status: 200, headers, json: async () => body };
  }

  impl.requested = requested;
  return impl;
}

describe('buildReposUrl', () => {
  test('without a token it asks for a specific user\'s public repos', () => {
    const { url, source } = buildReposUrl({ username: 'octo', page: 2, perPage: 50 });
    assert.equal(source, 'users');
    assert.match(url, /\/users\/octo\/repos\?/);
    const params = new URL(url).searchParams;
    assert.equal(params.get('type'), 'owner');
    assert.equal(params.get('per_page'), '50');
    assert.equal(params.get('page'), '2');
    assert.equal(params.get('sort'), 'updated');
  });

  test('with a token it asks for the authenticated user\'s repos, private included', () => {
    const { url, source } = buildReposUrl({ username: 'octo', token: 'ghp_x', page: 1 });
    assert.equal(source, 'user');
    assert.match(url, /\/user\/repos\?/);
    const params = new URL(url).searchParams;
    assert.equal(params.get('visibility'), 'all');
    assert.equal(params.get('affiliation'), 'owner');
  });

  test('the username is URL-encoded', () => {
    const { url } = buildReposUrl({ username: 'we ird/name' });
    assert.ok(!url.includes('we ird'), 'spaces must be encoded');
    assert.match(url, /users\/we%20ird%2Fname\/repos/);
  });
});

describe('parseLinkHeader', () => {
  test('extracts rel targets', () => {
    const links = parseLinkHeader(
      '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=7>; rel="last"',
    );
    assert.equal(links.next, 'https://api.github.com/x?page=2');
    assert.equal(links.last, 'https://api.github.com/x?page=7');
  });

  test('an absent header yields an empty object', () => {
    assert.deepEqual(parseLinkHeader(null), {});
    assert.deepEqual(parseLinkHeader(''), {});
  });

  test('lastPageFromLink reads the page number', () => {
    assert.equal(lastPageFromLink({ last: 'https://api.github.com/x?page=7' }), 7);
    assert.equal(lastPageFromLink({}), null);
    assert.equal(lastPageFromLink({ last: 'https://api.github.com/x' }), null);
  });
});

describe('fetchUserRepos', () => {
  test('walks every page and merges the results', async () => {
    const impl = fakeGithub({ pages: 2, perPage: 2 });
    const result = await fetchUserRepos({ username: 'octo', perPage: 2, fetchImpl: impl });

    assert.equal(result.repos.length, 4);
    assert.equal(result.pages, 2);
    assert.equal(result.source, 'users');
    assert.equal(result.truncated, false);
    assert.equal(result.rateLimit.limit, 5000);
    assert.deepEqual(result.repos.map((repo) => repo.slug), [
      'octo/repo-1-0',
      'octo/repo-1-1',
      'octo/repo-2-0',
      'octo/repo-2-1',
    ]);
  });

  test('stops on a short page even when no Link header is sent', async () => {
    const impl = fakeGithub({ pages: 1, perPage: 1, linkHeader: false });
    const result = await fetchUserRepos({ username: 'octo', perPage: 1, fetchImpl: impl });
    assert.equal(result.pages, 2, 'it cannot know page 2 is empty until it asks');
    assert.equal(result.repos.length, 1);
    assert.equal(result.truncated, false);
  });

  test('uses /user/repos when a token is supplied', async () => {
    const impl = fakeGithub({ pages: 1, perPage: 1 });
    const result = await fetchUserRepos({ username: 'octo', token: 'ghp_secret', fetchImpl: impl });

    assert.equal(result.source, 'user');
    assert.match(impl.requested[0].url, /\/user\/repos\?/);
    assert.equal(impl.requested[0].options.headers.Authorization, 'Bearer ghp_secret');
  });

  test('sends no Authorization header without a token', async () => {
    const impl = fakeGithub({ pages: 1, perPage: 1 });
    await fetchUserRepos({ username: 'octo', fetchImpl: impl });
    assert.equal('Authorization' in impl.requested[0].options.headers, false);
  });

  test('requires a username when there is no token', async () => {
    await assert.rejects(
      () => fetchUserRepos({ username: '', fetchImpl: fakeGithub() }),
      (error) => error instanceof GithubError && error.kind === 'notFound',
    );
  });

  test('reports truncation when the safety cap is hit', async () => {
    const impl = fakeGithub({ pages: 20, perPage: 2, linkHeader: true });
    const result = await fetchUserRepos({ username: 'octo', perPage: 2, maxPages: 3, fetchImpl: impl });
    assert.equal(result.pages, 3);
    assert.equal(result.truncated, true);
  });

  test('reports progress per page', async () => {
    const impl = fakeGithub({ pages: 3, perPage: 2 });
    /** @type {any[]} */
    const progress = [];
    await fetchUserRepos({
      username: 'octo',
      perPage: 2,
      fetchImpl: impl,
      onPage: (state) => progress.push(state),
    });

    assert.equal(progress.length, 3);
    assert.equal(progress[0].page, 1);
    assert.equal(progress[0].total, 2);
    assert.equal(progress[0].totalPages, 3, 'the Link header gives us the total up front');
    assert.equal(progress.at(-1).total, 6);
  });

  test('an abort is reported as aborted, not as a failure', async () => {
    const abort = new AbortError();
    await assert.rejects(
      () => fetchUserRepos({ username: 'octo', fetchImpl: async () => { throw abort; } }),
      (error) => error instanceof GithubError && error.kind === 'aborted',
    );
  });

  test('a network error is reported as network', async () => {
    await assert.rejects(
      () => fetchUserRepos({ username: 'octo', fetchImpl: async () => { throw new TypeError('boom'); } }),
      (error) => error instanceof GithubError && error.kind === 'network',
    );
  });
});

describe('fetchUserRepos — error mapping', () => {
  test('404 → notFound', async () => {
    await assert.rejects(
      () => fetchUserRepos({ username: 'ghost', fetchImpl: fakeGithub({ failWith: { status: 404 } }) }),
      (error) => error instanceof GithubError && error.kind === 'notFound' && error.status === 404,
    );
  });

  test('401 → unauthorized', async () => {
    await assert.rejects(
      () => fetchUserRepos({ username: 'octo', token: 'bad', fetchImpl: fakeGithub({ failWith: { status: 401 } }) }),
      (error) => error instanceof GithubError && error.kind === 'unauthorized',
    );
  });

  test('403 with a spent quota → rateLimit', async () => {
    await assert.rejects(
      () =>
        fetchUserRepos({
          username: 'octo',
          fetchImpl: fakeGithub({
            failWith: {
              status: 403,
              headers: [
                ['x-ratelimit-limit', '60'],
                ['x-ratelimit-remaining', '0'],
                ['x-ratelimit-reset', '1717200000'],
              ],
            },
          }),
        }),
      (error) => error instanceof GithubError && error.kind === 'rateLimit' && error.resetAt !== null,
    );
  });

  test('403 with quota left → forbidden (a missing scope, usually)', async () => {
    await assert.rejects(
      () =>
        fetchUserRepos({
          username: 'octo',
          fetchImpl: fakeGithub({
            failWith: {
              status: 403,
              headers: [['x-ratelimit-limit', '60'], ['x-ratelimit-remaining', '55']],
            },
          }),
        }),
      (error) => error instanceof GithubError && error.kind === 'forbidden',
    );
  });

  test('500 → server', async () => {
    await assert.rejects(
      () => fetchUserRepos({ username: 'octo', fetchImpl: fakeGithub({ failWith: { status: 502 } }) }),
      (error) => error instanceof GithubError && error.kind === 'server' && error.status === 502,
    );
  });

  test('a non-array body is treated as a server error', async () => {
    await assert.rejects(
      () =>
        fetchUserRepos({
          username: 'octo',
          fetchImpl: async () => ({ ok: true, status: 200, headers: new Map(), json: async () => ({ message: 'nope' }) }),
        }),
      (error) => error instanceof GithubError && error.kind === 'server',
    );
  });
});

describe('normalizeRepo metadata', () => {
  test('maps every field the spec asks for', () => {
    const repo = normalizeRepo({
      id: 42,
      name: 'gitbinder',
      full_name: 'octo/gitbinder',
      description: 'A book of your repos',
      html_url: 'https://github.com/octo/gitbinder',
      homepage: 'https://gitbinder.dev',
      language: 'JavaScript',
      stargazers_count: 128,
      forks_count: 7,
      updated_at: ISO,
      archived: true,
      fork: true,
      topics: ['pdf', 'github', 'portfolio'],
    });

    assert.equal(repo.id, 42);
    assert.equal(repo.name, 'gitbinder');
    assert.equal(repo.slug, 'octo/gitbinder');
    assert.equal(repo.description, 'A book of your repos');
    assert.equal(repo.url, 'https://github.com/octo/gitbinder');
    assert.equal(repo.homepage, 'https://gitbinder.dev');
    assert.equal(repo.language, 'JavaScript');
    assert.equal(repo.stars, 128);
    assert.equal(repo.forks, 7);
    assert.equal(repo.updatedAt, ISO);
    assert.equal(repo.archived, true);
    assert.equal(repo.isFork, true);
    assert.deepEqual(repo.topics, ['pdf', 'github', 'portfolio']);
  });

  test('an empty homepage becomes null, not an empty string', () => {
    assert.equal(normalizeRepo({ full_name: 'a/b', homepage: '' }).homepage, null);
    assert.equal(normalizeRepo({ full_name: 'a/b' }).homepage, null);
  });
});

class AbortError extends Error {
  constructor() {
    super('The operation was aborted');
    this.name = 'AbortError';
  }
}

/* -------------------------------------------------------------------------- *
 * Token verification — the "Sign in" check in the settings drawer
 * -------------------------------------------------------------------------- */

/**
 * Build a fake `fetch` that answers `/user` once, recording what it was asked.
 *
 * @param {{ status?: number, body?: any, headers?: [string, string][], badJson?: boolean,
 *           fail?: Error }} [options]
 */
function fakeUserEndpoint(options = {}) {
  const requested = [];

  async function impl(url, init = {}) {
    requested.push({ url: String(url), init });
    if (options.fail) throw options.fail;

    const headers = new Map(options.headers ?? []);
    return {
      ok: (options.status ?? 200) < 400,
      status: options.status ?? 200,
      headers,
      json: async () => {
        if (options.badJson) throw new SyntaxError('Unexpected token < in JSON');
        return options.body ?? {};
      },
    };
  }

  impl.requested = requested;
  return impl;
}

describe('verifyToken', () => {
  const TOKEN = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';

  test('a valid token reports who it belongs to', async () => {
    const fetchImpl = fakeUserEndpoint({
      body: { login: 'AndrexTheDev', name: 'Andre', plan: { name: 'free' } },
      headers: [['x-oauth-scopes', 'repo, read:user']],
    });

    const result = await verifyToken(TOKEN, { fetchImpl });

    assert.deepEqual(result, {
      login: 'AndrexTheDev',
      name: 'Andre',
      plan: 'free',
      scopes: ['repo', 'read:user'],
    });
  });

  test('the token travels in the Authorization header, never in the URL', async () => {
    // A token in a query string ends up in referrers, in logs and in the
    // browser's history. This is the request that decides whether the visitor
    // is signed in, so it is the one place that has to be exact.
    const fetchImpl = fakeUserEndpoint({ body: { login: 'octocat' } });
    await verifyToken(TOKEN, { fetchImpl });

    const [{ url, init }] = fetchImpl.requested;
    assert.equal(url, `${GITHUB.apiBase}/user`);
    assert.equal(url.includes(TOKEN), false, 'the token is in the URL');
    assert.equal(init.headers.Authorization, `Bearer ${TOKEN}`);

    // And it appears exactly once in the whole request, in that header: a
    // second copy would mean some other field is carrying it too.
    const serialised = JSON.stringify(init);
    assert.equal(
      serialised.split(TOKEN).length - 1,
      1,
      `the token appears ${serialised.split(TOKEN).length - 1} times in the request`,
    );
    assert.ok(serialised.includes(`"Authorization":"Bearer ${TOKEN}"`));
  });

  test('an empty token is refused without asking GitHub', async () => {
    // Pressing "verify" on an empty field must not send `Authorization: Bearer`
    // with nothing after it, and must not show a spinner while it does.
    for (const value of ['', '   ', '\n', null, undefined]) {
      const fetchImpl = fakeUserEndpoint();
      await assert.rejects(
        () => verifyToken(value, { fetchImpl }),
        (error) => error instanceof GithubError && error.kind === 'unauthorized',
        `${JSON.stringify(value)} was not refused`,
      );
      assert.equal(fetchImpl.requested.length, 0, 'an empty token still hit the network');
    }
  });

  test('the scopes are trimmed, and an absent header means no scopes', async () => {
    // `x-oauth-scopes` is a comma-separated list with spaces after the commas.
    const withSpaces = await verifyToken(TOKEN, {
      fetchImpl: fakeUserEndpoint({
        body: { login: 'octocat' },
        headers: [['x-oauth-scopes', ' repo ,  user:email ,']],
      }),
    });
    assert.deepEqual(withSpaces.scopes, ['repo', 'user:email']);

    const withoutHeader = await verifyToken(TOKEN, {
      fetchImpl: fakeUserEndpoint({ body: { login: 'octocat' } }),
    });
    assert.deepEqual(withoutHeader.scopes, []);
  });

  test('a profile without a name or a plan reports null, not undefined', async () => {
    // The drawer prints these; `undefined` would surface as the string
    // "undefined" in the greeting.
    const result = await verifyToken(TOKEN, {
      fetchImpl: fakeUserEndpoint({ body: { login: 'octocat' } }),
    });

    assert.equal(result.name, null);
    assert.equal(result.plan, null);
  });

  test('a body that is not JSON is not a reason to declare the token invalid', async () => {
    // A proxy, a captive portal or a maintenance page: the token may well be
    // fine, and the visitor is told who they are (nobody) rather than being
    // told their token is wrong.
    const result = await verifyToken(TOKEN, {
      fetchImpl: fakeUserEndpoint({ status: 200, badJson: true }),
    });

    assert.equal(result.login, '');
    assert.deepEqual(result.scopes, []);
  });

  test('the error mapping is the same one the fetch path uses', async () => {
    const cases = [
      [{ status: 401 }, 'unauthorized'],
      [
        {
          status: 403,
          headers: [
            ['x-ratelimit-limit', '60'],
            ['x-ratelimit-remaining', '0'],
            ['x-ratelimit-reset', '1717200000'],
          ],
        },
        'rateLimit',
      ],
      [{ status: 403, headers: [['x-ratelimit-limit', '60'], ['x-ratelimit-remaining', '42']] }, 'forbidden'],
      [{ status: 500 }, 'server'],
    ];

    for (const [options, kind] of cases) {
      await assert.rejects(
        () => verifyToken(TOKEN, { fetchImpl: fakeUserEndpoint(options) }),
        (error) => error instanceof GithubError && error.kind === kind,
        `status ${options.status} was not reported as ${kind}`,
      );
    }
  });

  test('a cancelled verification says cancelled', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';

    await assert.rejects(
      () => verifyToken(TOKEN, { fetchImpl: fakeUserEndpoint({ fail: abort }) }),
      (error) => error instanceof GithubError && error.kind === 'aborted',
    );
  });

  test('a network failure is reported as network', async () => {
    await assert.rejects(
      () => verifyToken(TOKEN, { fetchImpl: fakeUserEndpoint({ fail: new TypeError('Failed to fetch') }) }),
      (error) => error instanceof GithubError && error.kind === 'network',
    );
  });

  test('the caller\u2019s AbortSignal reaches fetch', async () => {
    // The drawer cancels the previous check when a new one starts; without the
    // signal, a late answer would overwrite a newer one.
    const controller = new AbortController();
    const fetchImpl = fakeUserEndpoint({ body: { login: 'octocat' } });
    await verifyToken(TOKEN, { fetchImpl, signal: controller.signal });

    assert.equal(fetchImpl.requested[0].init.signal, controller.signal);
  });

  test('a token with surrounding whitespace is accepted, trimmed', async () => {
    // Pasting into the field is how tokens arrive, and a trailing newline is
    // the single most common paste artefact.
    const fetchImpl = fakeUserEndpoint({ body: { login: 'octocat' } });
    await verifyToken(`  ${TOKEN}\n`, { fetchImpl });

    assert.equal(fetchImpl.requested[0].init.headers.Authorization, `Bearer ${TOKEN}`);
  });
});

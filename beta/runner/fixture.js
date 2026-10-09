/**
 * Deterministic GitHub fixture for the beta run.
 *
 * Screenshots must be reproducible: a matrix captured today has to look the
 * same next month, and CI runners share IP ranges that GitHub rate-limits
 * within minutes. So the beta never talks to the real API — every request to
 * `api.github.com` is answered from this file.
 *
 * Two rules keep the fixture honest:
 *
 *   1. **Same shape as the wire.** Payloads use GitHub's raw field names
 *      (`full_name`, `stargazers_count`, `pushed_at`, …) so the app's real
 *      `normalizeRepo()` / `detectStatus()` path is exercised, not a pre-chewed
 *      stand-in.
 *   2. **Dates are relative.** `services/status.js` classifies by "days since
 *      the last push", so hardcoded ISO strings would silently drift: a repo
 *      that is "In Development" today becomes "Paused" in a month and the
 *      screenshots stop matching the module they are meant to show. Every date
 *      is computed from *now* at fixture-build time.
 *
 * `beta/runner/selfcheck.mjs` runs this fixture through the real
 * `bootstrap()` + `fetchUserRepos()` in jsdom, so a fixture that no longer
 * matches what the app expects fails locally instead of producing 60 pictures
 * of the wrong thing.
 *
 * @module beta/runner/fixture
 */

const DAY = 86_400_000;

/** ISO timestamp `days` in the past. */
function daysAgo(days) {
  return new Date(Date.now() - days * DAY).toISOString();
}

/**
 * Build one repository payload.
 * Everything the book renders has a sensible default so each repo only spells
 * out what makes it interesting.
 */
function repo(spec) {
  const slug = spec.slug ?? 'octodemo/untitled';
  const [owner, name] = slug.split('/');
  return {
    id: spec.id ?? hashId(slug),
    full_name: slug,
    name,
    private: false,
    owner: { login: owner, id: 4242, avatar_url: 'https://github.com/identicons/octodemo.png' },
    html_url: `https://github.com/${slug}`,
    description: '',
    fork: false,
    url: `https://api.github.com/repos/${slug}`,
    created_at: daysAgo(900),
    updated_at: daysAgo(spec.days ?? 60),
    pushed_at: daysAgo(spec.days ?? 60),
    homepage: null,
    size: 2048,
    stargazers_count: 0,
    watchers_count: 0,
    language: null,
    forks_count: 0,
    open_issues_count: 0,
    license: null,
    topics: [],
    archived: false,
    disabled: false,
    default_branch: 'main',
    // `spec.raw` wins over every default above, so an individual repository can
    // contradict the defaults (an archived repo with a recent push, say).
    ...spec.raw,
  };
}

/** Small stable string hash, so fixture ids never change between runs. */
function hashId(slug) {
  let hash = 2166136261;
  for (const char of String(slug)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 1_000_000;
}

/**
 * The twelve repositories of the demo account.
 *
 * Chosen so every branch of `services/status.js` is represented at least once —
 * that is what makes M06 (status engine) a real check rather than a picture of
 * four identical cards.
 */
export const DEMO_REPOS = [
  repo({
    slug: 'octodemo/gitbinder',
    days: 5,
    raw: {
      description: 'Turn your GitHub repositories into a printable Classic Book PDF portfolio.',
      language: 'JavaScript',
      homepage: 'https://gitbinder.pages.dev',
      stargazers_count: 128,
      forks_count: 9,
      open_issues_count: 3,
      license: { key: 'mit', name: 'MIT License', spdx_id: 'MIT' },
      topics: ['portfolio', 'pdf', 'github-api', 'static-site'],
    },
  }),
  repo({
    slug: 'octodemo/paperback-pdf',
    days: 21,
    raw: {
      description: 'A tiny paged-media composer: running heads, folios and colophons for the browser.',
      language: 'TypeScript',
      stargazers_count: 64,
      forks_count: 4,
      open_issues_count: 0,
      license: { key: 'apache-2.0', name: 'Apache License 2.0', spdx_id: 'Apache-2.0' },
      topics: ['status-live', 'css-paged-media', 'typography'],
    },
  }),
  repo({
    slug: 'octodemo/ink-engine',
    days: 3,
    raw: {
      description: 'Incremental markdown renderer with a 4 kB core.',
      language: 'Rust',
      stargazers_count: 21,
      forks_count: 1,
      open_issues_count: 7,
      topics: ['markdown', 'parser'],
    },
  }),
  repo({
    slug: 'octodemo/spine-cli',
    days: 44,
    raw: {
      description: 'Bind a folder of markdown into a signed PDF, from the terminal.',
      language: 'Go',
      stargazers_count: 12,
      forks_count: 0,
      open_issues_count: 2,
      topics: ['status-wip', 'cli'],
    },
  }),
  repo({
    slug: 'octodemo/folio-ui',
    days: 120,
    raw: {
      description: 'Accessible form primitives for design systems that still have to print.',
      language: 'JavaScript',
      stargazers_count: 88,
      forks_count: 11,
      open_issues_count: 5,
      license: { key: 'mit', name: 'MIT License', spdx_id: 'MIT' },
      topics: ['a11y', 'forms', 'design-system'],
    },
  }),
  repo({
    slug: 'octodemo/atlas-notes',
    days: 210,
    raw: {
      description: 'Offline-first notes with a conflict-free merge strategy.',
      language: 'Kotlin',
      stargazers_count: 34,
      forks_count: 2,
      open_issues_count: 12,
      topics: ['status-mvp', 'offline-first', 'crdt'],
    },
  }),
  repo({
    slug: 'octodemo/quill',
    days: 500,
    raw: {
      description: 'A fountain pen for the terminal. Superseded by spine-cli.',
      language: 'Python',
      stargazers_count: 7,
      forks_count: 0,
      open_issues_count: 0,
    },
  }),
  repo({
    slug: 'octodemo/old-lab',
    days: 240,
    raw: {
      description: 'Experiment archive: shader toys and half-finished compilers.',
      language: 'C++',
      stargazers_count: 3,
      archived: true,
    },
  }),
  repo({
    slug: 'octodemo/legacy-tools',
    days: 40,
    raw: {
      description: 'Maintenance-only utilities. Kept alive for one internal script.',
      language: 'Shell',
      stargazers_count: 1,
      disabled: true,
    },
  }),
  repo({
    slug: 'octodemo/demo-fork',
    days: 15,
    raw: {
      description: 'Fork of a static site generator, patched for A4 output.',
      language: 'JavaScript',
      fork: true,
      stargazers_count: 0,
    },
  }),
  repo({
    slug: 'octodemo/tiny',
    days: 9,
    raw: { description: '', language: null, stargazers_count: 0 },
  }),
  repo({
    slug: 'octodemo/verbose',
    days: 66,
    raw: {
      description:
        'A deliberately over-long description used to check truncation in the card, the catalogue ' +
        'entry and the printed chapter summary: it runs well past the two hundred characters the ' +
        'book allows, includes a colon: a semicolon; and an em dash — so nothing in the layout can ' +
        'assume a tidy sentence.',
      language: 'JavaScript',
      homepage: 'https://octodemo.github.io/verbose/',
      stargazers_count: 156,
      forks_count: 22,
      open_issues_count: 18,
      license: { key: 'gpl-3.0', name: 'GNU General Public License v3.0', spdx_id: 'GPL-3.0' },
      topics: [
        'layout',
        'typography',
        'edge-cases',
        'truncation',
        'testing',
        'documentation',
        'examples',
        'stress',
      ],
    },
  }),
];

/** The demo account every fixture answers for. */
export const DEMO_USER = 'octodemo';

/** Repos returned when a token is present: the public list plus private work. */
const TOKEN_ONLY_REPO = repo({
  slug: 'octodemo/private-vault',
  days: 8,
  raw: {
    description: 'Private prototype — only visible with a token that has the repo scope.',
    language: 'TypeScript',
    private: true,
    stargazers_count: 0,
  },
});

/**
 * A second page worth of generated repositories, so M03 can show real
 * pagination (`GITHUB.perPage` is 100; page 1 must be full for the app to
 * follow the `Link` header at all).
 */
function bulkPage(count) {
  return Array.from({ length: count }, (_, index) =>
    repo({
      slug: `octodemo/bulk-${String(index + 1).padStart(3, '0')}`,
      days: 2 + (index % 400),
      raw: {
        description: `Generated repository ${index + 1} — pagination fixture.`,
        language: ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust'][index % 5],
        stargazers_count: index % 17,
        forks_count: index % 3,
        open_issues_count: index % 5,
      },
    }),
  );
}

/* -------------------------------------------------------------------------- *
 * Scenarios
 * -------------------------------------------------------------------------- */

/**
 * Every scenario the matrix can ask for.
 *
 * `kind` decides how the runner answers:
 *   • `repos`  — 200 + JSON body (+ optional `Link` header)
 *   • `error`  — the given HTTP status, with GitHub-shaped headers
 *   • `reject` — the request never returns (offline / DNS failure)
 */
export const SCENARIOS = {
  /** Twelve repositories, one page. The default for most modules. */
  ok: { kind: 'repos', pages: [DEMO_REPOS] },

  /** 103 repositories across two pages — exercises the `Link` header loop. */
  paged: { kind: 'repos', pages: [bulkPage(100), DEMO_REPOS.slice(0, 3)] },

  /** An account with no public repositories. */
  empty: { kind: 'repos', pages: [[]] },

  /** Unknown username. */
  notFound: { kind: 'error', status: 404, message: 'Not Found' },

  /** A token that GitHub rejects. */
  unauthorized: { kind: 'error', status: 401, message: 'Bad credentials' },

  /** Anonymous rate limit exhausted, resets in 42 minutes. */
  rateLimit: {
    kind: 'error',
    status: 403,
    message: "API rate limit exceeded for 203.0.113.7. (But here's the good news: …)",
    rateLimit: { limit: 60, remaining: 0, resetInMinutes: 42 },
  },

  /** GitHub is having a bad day. */
  server: { kind: 'error', status: 502, message: 'Bad Gateway' },

  /** No network at all. */
  offline: { kind: 'reject', message: 'Failed to fetch' },

  /** Slow response, so the loading state can actually be captured. */
  slow: { kind: 'repos', pages: [DEMO_REPOS], delayMs: 2500 },

  /** Token present: private work appears, and `/user` verifies. */
  token: { kind: 'repos', pages: [[...DEMO_REPOS, TOKEN_ONLY_REPO]] },
};

export const SCENARIO_IDS = Object.keys(SCENARIOS);

/* -------------------------------------------------------------------------- *
 * Response building
 * -------------------------------------------------------------------------- */

/**
 * Headers as the app sees them. Uses the platform `Headers` so
 * `response.headers.get('x-ratelimit-remaining')` behaves exactly as it does in
 * the browser.
 * @param {Record<string, string>} extra
 */
function headers(extra = {}) {
  const base = {
    'content-type': 'application/vnd.github+json',
    'x-ratelimit-limit': '5000',
    'x-ratelimit-remaining': '4999',
    'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
    ...extra,
  };
  return new Headers(base);
}

/** `Link` header for a paginated listing. */
function linkHeader(page, pages, baseUrl) {
  if (pages <= 1) return null;
  const parts = [];
  if (page < pages) parts.push(`<${baseUrl}?page=${page + 1}>; rel="next"`);
  parts.push(`<${baseUrl}?page=${pages}>; rel="last"`);
  if (page > 1) parts.push(`<${baseUrl}?page=${page - 1}>; rel="prev"`);
  parts.push(`<${baseUrl}?page=1>; rel="first"`);
  return parts.join(', ');
}

/**
 * Answer one request.
 *
 * @param {string} scenarioId  key of SCENARIOS
 * @param {string} url         the URL the app asked for
 * @param {{ page?: number, withToken?: boolean }} [request]
 * @returns {{ ok: boolean, status: number, headers: Headers, body: unknown, delayMs: number }}
 */
export function answerRequest(scenarioId, url, request = {}) {
  const scenario = SCENARIOS[scenarioId] ?? SCENARIOS.ok;
  const parsed = new URL(url, 'https://api.github.com');
  const page = Number(request.page ?? parsed.searchParams.get('page') ?? 1);
  const withToken = request.withToken ?? /\/user\/repos/.test(parsed.pathname);

  if (scenario.kind === 'reject') {
    return { reject: new TypeError(scenario.message ?? 'Failed to fetch') };
  }

  if (scenario.kind === 'error') {
    const rate = scenario.rateLimit;
    const extra = { 'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': '4998' };
    if (rate) {
      extra['x-ratelimit-limit'] = String(rate.limit);
      extra['x-ratelimit-remaining'] = String(rate.remaining);
      extra['x-ratelimit-reset'] = String(
        Math.floor(Date.now() / 1000) + rate.resetInMinutes * 60,
      );
      // GitHub also names the limit in a machine-readable retry-after.
      extra['retry-after'] = String(rate.resetInMinutes * 60);
    }
    return {
      ok: false,
      status: scenario.status,
      headers: headers(extra),
      body: { message: scenario.message, documentation_url: 'https://docs.github.com/rest' },
      delayMs: 0,
    };
  }

  // Token verification endpoint.
  if (/^\/user$/.test(parsed.pathname)) {
    if (scenarioId === 'unauthorized') {
      return {
        ok: false,
        status: 401,
        headers: headers(),
        body: { message: 'Bad credentials' },
        delayMs: 0,
      };
    }
    return {
      ok: true,
      status: 200,
      headers: headers(),
      body: { login: DEMO_USER, id: 4242, name: 'Octo Demo', public_repos: DEMO_REPOS.length },
      delayMs: 0,
    };
  }

  const pages = scenario.pages ?? [[]];
  const body = pages[page - 1] ?? [];
  const link = linkHeader(page, pages.length, `${parsed.origin}${parsed.pathname}`);

  return {
    ok: true,
    status: 200,
    headers: headers(link ? { link } : {}),
    body,
    delayMs: scenario.delayMs ?? 0,
    // Recorded so the selfcheck can prove which endpoint the app chose.
    source: withToken ? 'user' : 'users',
  };
}

/**
 * A `fetch` implementation for Node-side checks (`selfcheck.mjs`).
 *
 * The browser runner does not use this — it intercepts at the network layer —
 * but both read the same table above, so a fixture change cannot silently
 * desynchronise the two.
 *
 * @param {string} scenarioId
 * @returns {{ impl: typeof fetch, calls: Array<{ url: string, page: number, auth: boolean }> }}
 */
export function fixtureFetch(scenarioId) {
  const calls = [];

  async function impl(input, init = {}) {
    const url = String(typeof input === 'string' ? input : input?.url ?? input);
    const auth = /(^|\s)Bearer\s+\S+/i.test(String(init?.headers?.Authorization ?? ''));
    const page = Number(new URL(url, 'https://api.github.com').searchParams.get('page') ?? 1);
    calls.push({ url, page, auth });

    const answer = answerRequest(scenarioId, url, { page, withToken: auth });
    if (answer.reject) throw answer.reject;
    if (answer.delayMs) await new Promise((resolve) => setTimeout(resolve, answer.delayMs));

    return {
      ok: answer.ok,
      status: answer.status,
      headers: answer.headers,
      json: async () => answer.body,
    };
  }

  return { impl, calls };
}

/**
 * A Playwright route handler for the same table.
 *
 * @param {string} scenarioId
 * @param {boolean} withToken  whether a PAT is seeded into the app
 */
export function routeHandler(scenarioId, withToken = false) {
  return async function handle(route) {
    const url = route.request().url();
    const authHeader = route.request().headers()['authorization'] ?? '';
    const auth = withToken || /Bearer\s+\S+/i.test(authHeader);
    const page = Number(new URL(url).searchParams.get('page') ?? 1);

    const answer = answerRequest(scenarioId, url, { page, withToken: auth });
    if (answer.reject) {
      await route.abort('failed');
      return;
    }
    if (answer.delayMs) await new Promise((resolve) => setTimeout(resolve, answer.delayMs));

    await route.fulfill({
      status: answer.status,
      headers: Object.fromEntries(answer.headers.entries()),
      contentType: 'application/vnd.github+json',
      body: JSON.stringify(answer.body),
    });
  };
}

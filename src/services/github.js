/**
 * GitHub REST client.
 *
 * The only network code in the app. Everything runs from the browser directly
 * against `api.github.com` — no proxy, no backend, no stored credentials other
 * than the optional token the visitor types in.
 *
 * Endpoints used (all read-only):
 *   GET /users/{username}/repos — a specific account's public repositories,
 *                                 plus private ones the caller can see
 *   GET /user/repos             — the authenticated user's repositories,
 *                                 including private ones; used when a PAT is
 *                                 supplied so private work shows up too
 *   GET /user                   — token verification in the settings drawer
 *
 * @module services/github
 */

import { GITHUB } from '../config/app.js';

const JSON_ACCEPT = 'application/vnd.github+json';
const API_VERSION = '2022-11-28';

/** Error kinds the UI knows how to translate into a message. */
export const GITHUB_ERROR_KINDS = Object.freeze([
  'network',
  'unauthorized',
  'notFound',
  'forbidden',
  'rateLimit',
  'server',
  'aborted',
  'unknown',
]);

export class GithubError extends Error {
  /**
   * @param {string} kind  one of GITHUB_ERROR_KINDS — mapped to an i18n key
   * @param {object} [details]
   */
  constructor(kind, details = {}) {
    super(details.message ?? `GitHub request failed (${kind})`);
    this.name = 'GithubError';
    this.kind = GITHUB_ERROR_KINDS.includes(kind) ? kind : 'unknown';
    this.status = details.status ?? null;
    this.resetAt = details.resetAt ?? null;
    this.username = details.username ?? null;
    this.cause = details.cause ?? null;
  }

  /** i18n key for `errors.*` */
  get i18nKey() {
    return `errors.${this.kind === 'aborted' ? 'unknown' : this.kind}`;
  }
}

/**
 * Trim a raw GitHub repository payload down to the fields the book needs.
 *
 * Keeping this as an explicit allow-list (rather than spreading the payload)
 * means a new GitHub field can never accidentally end up in localStorage or in
 * the printed book.
 */
export function normalizeRepo(raw) {
  const fullName = String(raw?.full_name ?? '');
  const [owner, name] = fullName.split('/');

  return {
    id: raw?.id ?? null,
    /** Stable, human-readable identifier used as the `repoOverrides` key. */
    slug: fullName,
    name: raw?.name ?? name ?? fullName,
    owner: raw?.owner?.login ?? owner ?? '',
    url: raw?.html_url ?? (fullName ? `${GITHUB.webBase}/${fullName}` : ''),
    description: raw?.description ?? '',
    language: raw?.language ?? null,
    stars: raw?.stargazers_count ?? 0,
    forks: raw?.forks_count ?? 0,
    openIssues: raw?.open_issues_count ?? 0,
    isFork: Boolean(raw?.fork),
    isPrivate: Boolean(raw?.private),
    archived: Boolean(raw?.archived),
    disabled: Boolean(raw?.disabled),
    defaultBranch: raw?.default_branch ?? 'main',
    homepage: raw?.homepage || null,
    topics: Array.isArray(raw?.topics) ? raw.topics.slice(0, 12) : [],
    license: normalizeLicense(raw?.license),
    sizeKb: raw?.size ?? 0,
    createdAt: raw?.created_at ?? null,
    updatedAt: raw?.updated_at ?? null,
    pushedAt: raw?.pushed_at ?? null,
  };
}

function normalizeLicense(license) {
  if (!license) return null;
  const spdx = license.spdx_id;
  if (spdx && spdx !== 'NOASSERTION' && spdx !== 'NONE') return spdx;
  return license.name || null;
}

/** Build request headers, adding auth only when a token is present. */
function buildHeaders(token) {
  const headers = {
    Accept: JSON_ACCEPT,
    'X-GitHub-Api-Version': API_VERSION,
  };
  const value = String(token ?? '').trim();
  if (value) headers.Authorization = `Bearer ${value}`;
  return headers;
}

function parseRateLimit(response) {
  const limit = Number(response.headers?.get?.('x-ratelimit-limit'));
  const remaining = Number(response.headers?.get?.('x-ratelimit-remaining'));
  const reset = Number(response.headers?.get?.('x-ratelimit-reset'));
  if (!Number.isFinite(limit) || !Number.isFinite(remaining)) return null;
  return {
    limit,
    remaining,
    resetAt: Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toISOString() : null,
  };
}

/**
 * Parse a RFC 8288 `Link` header into `{ next, last, prev, first }`.
 * GitHub sends it on paginated collections and it is the only reliable way to
 * know how many pages there are in total.
 */
export function parseLinkHeader(header) {
  /** @type {Record<string, string>} */
  const links = {};
  if (!header) return links;

  for (const part of String(header).split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?([^";]+)"?/);
    if (match) links[match[2].trim()] = match[1];
  }
  return links;
}

/** Extract the final page number from a parsed `Link` header. */
export function lastPageFromLink(links) {
  const url = links?.last;
  if (!url) return null;
  try {
    const parsed = new URL(url, GITHUB.apiBase);
    const page = Number(parsed.searchParams.get('page'));
    return Number.isFinite(page) && page > 0 ? page : null;
  } catch {
    return null;
  }
}

/**
 * Build the repository list URL for one page.
 *
 * With a token we ask for **our own** repositories (`/user/repos`), which is
 * the only endpoint that returns private repos the token can read. Without one
 * we fall back to the public per-user listing.
 *
 * @param {object} options
 * @param {string} [options.username]
 * @param {string} [options.token]
 * @param {number} [options.page=1]
 * @param {number} [options.perPage=100]
 * @returns {{ url: string, source: 'user'|'users' }}
 */
export function buildReposUrl({ username, token = '', page = 1, perPage = GITHUB.perPage } = {}) {
  const login = String(username ?? '').trim().replace(/^@/, '');
  const auth = String(token ?? '').trim();
  const params = new URLSearchParams({
    per_page: String(perPage),
    page: String(page),
    sort: 'updated',
    direction: 'desc',
  });

  if (auth) {
    // `affiliation=owner` keeps the list to repos we own, so a token with org
    // access does not flood the book with other people's projects.
    params.set('affiliation', 'owner');
    params.set('visibility', 'all');
    return { url: `${GITHUB.apiBase}/user/repos?${params}`, source: 'user' };
  }

  params.set('type', 'owner');
  return {
    url: `${GITHUB.apiBase}/users/${encodeURIComponent(login)}/repos?${params}`,
    source: 'users',
  };
}

/** Translate a failed response into a typed error the UI can localise. */
async function toError(response, { username } = {}) {
  const rateLimit = parseRateLimit(response);
  const status = response.status;

  if (status === 401) return new GithubError('unauthorized', { status, username });
  if (status === 404) return new GithubError('notFound', { status, username });
  if (status === 403 || status === 429) {
    if (rateLimit && rateLimit.remaining === 0) {
      return new GithubError('rateLimit', { status, username, resetAt: rateLimit.resetAt });
    }
    return new GithubError('forbidden', { status, username });
  }
  if (status >= 500) return new GithubError('server', { status, username });
  return new GithubError('server', { status, username });
}

/**
 * Fetch every repository of a user, paginating until GitHub runs dry.
 *
 * @param {object} options
 * @param {string} options.username
 * @param {string} [options.token]          optional PAT for private repositories
 * @param {number} [options.perPage=100]
 * @param {number} [options.maxPages=10]     safety cap (1 000 repos)
 * @param {AbortSignal} [options.signal]
 * @param {(state: { repos: object[], page: number, total: number, totalPages: number|null }) => void} [options.onPage]
 *        progress callback — lets the UI show "Fetching page 2 of 5…"
 * @param {typeof fetch} [options.fetchImpl] injectable for tests
 * @returns {Promise<{ repos: object[], rateLimit: object|null, pages: number,
 *                     source: 'user'|'users', truncated: boolean }>}
 */
export async function fetchUserRepos(options) {
  const {
    username = '',
    token = '',
    perPage = GITHUB.perPage,
    maxPages = GITHUB.maxPages,
    signal,
    onPage,
    fetchImpl = (...args) => fetch(...args),
  } = options;

  const login = String(username ?? '').trim().replace(/^@/, '');
  const auth = String(token ?? '').trim();

  // Without a token the endpoint is keyed by username, so it is required.
  if (!auth && !login) throw new GithubError('notFound', { username: '' });

  const headers = buildHeaders(auth);
  /** @type {object[]} */
  const repos = [];
  let rateLimit = null;
  let source = auth ? 'user' : 'users';
  let page = 0;
  let totalPages = null;

  while (page < maxPages) {
    page += 1;
    const built = buildReposUrl({ username: login, token: auth, page, perPage });
    source = built.source;

    let response;
    try {
      response = await fetchImpl(built.url, { headers, signal, mode: 'cors' });
    } catch (error) {
      if (error?.name === 'AbortError') throw new GithubError('aborted', { username: login, cause: error });
      throw new GithubError('network', { username: login, cause: error });
    }

    rateLimit = parseRateLimit(response) ?? rateLimit;

    if (!response.ok) throw await toError(response, { username: login });

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new GithubError('server', { username: login, status: response.status, cause: error });
    }
    if (!Array.isArray(payload)) throw new GithubError('server', { username: login, status: response.status });

    for (const raw of payload) repos.push(normalizeRepo(raw));

    // The Link header is authoritative; a short page is the belt-and-braces
    // fallback for endpoints that do not send one.
    totalPages = lastPageFromLink(parseLinkHeader(response.headers?.get?.('link'))) ?? totalPages;

    onPage?.({ repos: [...repos], page, total: repos.length, totalPages });

    if (totalPages !== null && page >= totalPages) break;
    if (payload.length < perPage) break;
  }

  return {
    repos,
    rateLimit,
    pages: page,
    source,
    // Hit the safety cap with pages still to come: the list is incomplete.
    truncated: totalPages !== null && totalPages > page,
  };
}

/**
 * Verify a Personal Access Token.
 * @returns {Promise<{ login: string, name: string|null, plan: string|null, scopes: string[] }>}
 */
export async function verifyToken(token, { fetchImpl = (...args) => fetch(...args), signal } = {}) {
  const value = String(token ?? '').trim();
  if (!value) throw new GithubError('unauthorized', { message: 'empty token' });

  let response;
  try {
    response = await fetchImpl(`${GITHUB.apiBase}/user`, {
      headers: buildHeaders(value),
      signal,
      mode: 'cors',
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new GithubError('aborted', { cause: error });
    throw new GithubError('network', { cause: error });
  }

  if (!response.ok) throw await toError(response);

  const payload = await response.json().catch(() => ({}));
  const scopes = String(response.headers?.get?.('x-oauth-scopes') ?? '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);

  return {
    login: payload?.login ?? '',
    name: payload?.name ?? null,
    plan: payload?.plan?.name ?? null,
    scopes,
  };
}

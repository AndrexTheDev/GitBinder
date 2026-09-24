# GitBooklet

> Turn your GitHub repositories into a printable **Classic Book** PDF portfolio.

GitBooklet is a **100% free, 100% client-side** web application. It has no backend, no
accounts, no cookies and no analytics: your repositories are fetched straight from
`api.github.com`, curated in your browser, and composed into a book. Settings — including
an optional Personal Access Token — never leave the device.

Deployed on **Cloudflare Pages** as a static bundle.

---

## Status of this milestone

The shell, i18n and state layer are done; **the GitHub integration and the repository
manager are in**.

| Area | State |
| --- | --- |
| Vite + Tailwind v4 + Lucide static build | ✅ |
| Layout shell (navbar / hero / library / summary / footer) | ✅ |
| i18n engine with EN + DE dictionaries | ✅ |
| Reactive store with `localStorage` persistence | ✅ |
| Settings drawer (GitHub, book meta, language, data) | ✅ |
| Export / import settings as JSON | ✅ |
| **GitHub fetcher: dual endpoint, pagination, rate limits** | ✅ |
| **Project status auto-detection engine** | ✅ |
| **Repository manager: cards, inline editing, global controls** | ✅ |
| Support / crypto-donation modal | ✅ |
| **PDF "Classic Book" composer** | ⏳ next milestone |

---

## Quick start

```bash
npm install
npm run dev       # http://localhost:5173  (binds 0.0.0.0 for container/preview use)
```

Other scripts:

```bash
npm test          # 101 unit + smoke tests (node:test, no browser needed)
npm run build     # static bundle → dist/
npm run preview   # serve dist/ locally
npm run deploy    # build + `wrangler pages deploy dist`
```

---

## Deploying to Cloudflare Pages

**Option A — Dashboard (zero config).** Connect the repository and set:

| Setting | Value |
| --- | --- |
| Framework preset | `None` (or `Vite`) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `20.19+` or `22.12+` (Vite 8 requirement) |

**Option B — Wrangler CLI.**

```bash
npm run deploy
```

`public/_headers` and `public/_redirects` ship with the build: they lock down the
security headers, cache hashed assets for a year and fall back to `index.html` for
unknown routes.

**Option C — GitHub Actions.** See `.github/workflows/deploy.yml`; it needs two
repository secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

---

## Project structure

```
index.html                  Static shell — every mount point lives here
vite.config.js              Vite 8 + Tailwind v4 (CSS-first config)
public/                     favicon, _headers, _redirects, robots.txt
src/
├── main.js                 Entry point (error boundary + boot splash teardown)
├── app.js                  Bootstrap: mounts components, owns the fetch pipeline
├── config/
│   ├── app.js              Constants, storage keys, GitHub config, repo statuses
│   └── support.js          ⚠️ Crypto addresses — replace the placeholders
├── core/                   Framework-free primitives, usable and testable in Node
│   ├── store.js            Deep-reactive Proxy store + debounced persistence
│   ├── i18n.js             Translator: dot paths, plurals, DOM binding applier
│   ├── vault.js            Device-keyed obfuscation for the optional token
│   ├── dom.js              `h()` hyperscript + attribute/prop handling
│   ├── list.js             Keyed list reconciler (preserves focus while typing)
│   ├── events.js           Tiny sync event bus for UI signals
│   └── storage.js          localStorage adapter with an in-memory fallback
├── i18n/
│   ├── index.js            Composition root (static dictionary imports)
│   ├── languages.js        Language registry — add a locale here
│   └── locales/{en,de}.js  Dictionaries (parity enforced by tests)
├── state/
│   ├── schema.js           Defaults, sanitizers, migrations
│   ├── codec.js            seal / open / redact at the storage boundary
│   ├── selectors.js        Derived state (library, chapters, stats)
│   └── index.js            Wires storage → vault → codec → stores → i18n
├── services/
│   ├── github.js           The only network code: endpoints, pagination, errors
│   └── status.js           Project status auto-detection engine
├── components/
│   ├── AppNavbar.js        Branding, language switch, support, settings, fetch
│   ├── HeroPanel.js        Product intro + live stat strip
│   ├── RepositoryLibrary.js Toolbar, counters, keyed rows, empty states
│   ├── RepoCard.js         One row: visibility, status, custom summary
│   ├── BookSummary.js      Live cover + table of contents preview
│   ├── AppFooter.js        Provenance, privacy line, storage usage
│   ├── SettingsDrawer.js   All persisted configuration + data portability
│   ├── SupportModal.js     Crypto addresses + free ways to help
│   ├── LanguageToggle.js   EN ⇄ DE segmented control
│   └── ui/                 Overlay, Toast, Confirm, Field, Icon
├── styles/
│   ├── index.css           Tailwind v4 `@theme` tokens (paper / ink / brass)
│   ├── components.css      Semantic component classes (.btn, .card, .badge …)
│   └── print.css           Print foundation for the Classic Book output
└── utils/                  object, format, file, clipboard, timing
tests/                      node:test suites (jsdom smoke tests included)
```

---

## State & persistence

Everything the visitor configures lives in `localStorage` under namespaced keys
(`gitbooklet:state`, `gitbooklet:vault`).

```js
{
  githubUsername: '',            // string
  personalAccessToken: '',       // optional; sealed before it touches disk
  customBookTitle: 'My Software Engineering Anthology',
  authorName: 'AndrexTheDev',
  authorEmail: 'hippie.highho@gmail.com',
  language: 'en',                // auto-detected from the browser on first run
  repoOverrides: {               // keyed by "owner/repo"
    'AndrexTheDev/GitBinder': {
      visible: true,
      // live | development | beta | paused — or null to keep auto-detection
      status: null,
      // overrides the GitHub description in the book index, or null to use it
      shortDescription: null,
      updatedAt: '2026-09-24T…',
    },
  },
  library: { sort: 'status', hideForks: false },
}
```

`null` is meaningful here, not an absence of data: it means *"the visitor has not
touched this field, keep deriving it from the live metadata"*.

Statuses written by the previous six-value taxonomy (`showcase`, `active`, `wip`,
`experiment`, `legacy`, `archived`) are migrated on load, so a book curated before the
change does not lose its curation.

Fetched repositories live in a **separate, memory-only store**. Re-fetching is cheap, and
keeping them out of `localStorage` prevents the quota from being eaten by data that is
one network request away anyway.

Writes are debounced (150 ms) and additionally flushed on `pagehide`,
`visibilitychange` and `beforeunload`, so closing a tab mid-edit never loses work.
Tabs stay in sync through the native `storage` event.

### About the Personal Access Token

The token is the only sensitive value in the app, so it gets special treatment — and an
honest description. **Obfuscation is not encryption**: any JavaScript on this origin can
read it, and no browser API can change that. What the vault does provide:

- the token is never written to `localStorage` in plain text, so devtools glances,
  screenshots and shared machines do not leak it;
- the key is generated per browser profile and stored separately, so sealed values are
  not portable to another device — a checksum makes a wrong key resolve to `''` instead
  of garbage being sent to GitHub;
- exports omit the token unless you explicitly tick the box;
- "Clear local data" destroys the key, making every sealed value unreadable.

The UI states this plainly next to the field. On a shared computer, leave it empty:
public repositories work without any token at all.

---

## GitHub fetcher

`src/services/github.js`

| Concern | Behaviour |
| --- | --- |
| Endpoint | `/users/{username}/repos?type=owner` without a token · `/user/repos?affiliation=owner&visibility=all` **with** one — the only listing that returns private repositories |
| Pagination | Follows the RFC 8288 `Link` header (`rel="last"`) to know the page count up front, and falls back to "a short page means we're done" |
| Safety | Caps at 10 pages (1 000 repos) and reports `truncated` instead of silently returning a partial list |
| Errors | Typed `GithubError` with a `kind` mapped to an i18n key: `network`, `unauthorized`, `notFound`, `forbidden`, `rateLimit` (with the reset time), `server`, `aborted` |
| Aborts | A new fetch cancels the one in flight, and a superseded request is never shown as an error |
| Metadata | `id`, `name`/`full_name`, `description`, `html_url`, `homepage`, `language`, `stargazers_count`, `forks_count`, `updated_at`, `archived`, `fork`, `topics` — trimmed to an explicit allow-list, so a new GitHub field can never leak into localStorage or the printed book |

## Status auto-detection

`src/services/status.js` — pure, synchronous, and takes an injectable `now`, so the
whole matrix is unit-testable without touching the clock.

Four statuses, in book order: **Live → In Development → Beta / MVP → Paused / Archived**.

| Priority | Signal | Result |
| --- | --- | --- |
| 1 | Topic `status-live` / `status-mvp` / `status-beta` / `status-paused` / `status-archived` / `status-wip` | that status |
| 2 | `archived` or `disabled` | Paused / Archived |
| 3 | `homepage` present | Live |
| 4 | Updated < 30 days | In Development |
| 5 | Updated ≤ 365 days | Beta / MVP |
| 6 | Anything older | Paused / Archived |

Two ordering decisions worth naming:

- **Topics beat everything.** A `status-*` topic is the author telling us what the
  project is; a guess should never override it.
- **A homepage beats recency.** A repo with a live site and no commits for a year is
  still a *live* product, not a work in progress.

Every result carries the reason it was chosen, and the card shows it
("has a live homepage", "from topic `status-beta`", "updated 2 days ago"), so the
visitor is never asked to trust an unexplained default.

**Overrides are the exception, not the rule.** `status` and `shortDescription` are
stored as `null` until the visitor edits them, and detection runs at render time. A
project that goes quiet for a year therefore becomes "Paused" on its own instead of
staying frozen at whatever it was on the day it was first fetched. Manually pinning a
status switches the card to a "manual" badge.

## Repository manager

`src/components/RepositoryLibrary.js` + `src/components/RepoCard.js`

Per repo card:

- **Include in book** checkbox — on for everything, off for forks
- **Status dropdown** with the four book statuses, plus the auto/manual origin
- **Short book description** textarea, pre-filled from `repo.description`, with a live
  counter, a "reset to GitHub" button and a "from GitHub" / "edited" origin label
- **Link badges** out to the repository and, when there is one, the live homepage
- Language, fork/private/archived badges, stars, forks, last update, licence, topics

Global controls:

- **Sort** by Status, Last Updated or Alphabetical (A–Z) — persisted
- **Hide forks** toggle — a *view* filter, deliberately separate from book inclusion
- **Search** across name, description, language and topics
- Bulk select all / none / invert, and **Refresh repositories**

Cards are reconciled by slug (`src/core/list.js`) rather than re-rendered, so typing in
a description never loses the caret — even though the store is written on every
keystroke.

## Internationalisation

- Dictionaries are **statically imported**, so the right language is available before the
  first paint — no fetch, no flicker, works offline.
- Static strings are declared with `data-i18n`, `data-i18n-placeholder`,
  `data-i18n-aria-label`, … and rewritten in place by `i18n.applyTo(document)`.
  That is what makes the EN ⇄ DE switch *instant* and lossless: no re-render, so an
  open drawer keeps its scroll position and a half-typed field keeps its caret.
- Dynamic strings go through `t()` with `Intl.PluralRules` (`{ count }`),
  `Intl.NumberFormat`, `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat`.
- Placeholders: `{name}` (escaped on demand), `{{name}}` (always escaped),
  `{{{name}}}` (raw), plus formatters: `{n|number}`, `{n|compact}`, `{n|percent}`,
  `{d|date}`, `{d|datetime}`, `{s|upper}`, `{s|lower}`.
- `tests/i18n.test.js` enforces key parity, non-empty values and identical placeholder
  names across locales, so a translation can never silently drift.

### Adding a language

1. Copy `src/i18n/locales/en.js` → `src/i18n/locales/<code>.js` and translate.
2. Register it in `src/i18n/index.js` (`LOCALES`).
3. Add one line to `LANGUAGES` in `src/i18n/languages.js`.

---

## Architecture notes

**No framework.** GitBooklet is a single-purpose tool; a ~37 kB gzipped bundle that
starts instantly *is* a feature. `core/dom.js` provides a small `h()` factory and
`core/list.js` a keyed reconciler — the one piece of hand-rolled UI code that is easy to
get wrong, because re-rendering a list on every keystroke would steal focus from the
description inputs.

**One data path.** Visitor action → event bus → controller in `app.js` → GitHub service →
session store → component subscriptions re-render. The bus carries *UI signals* only
(open the drawer, push a toast); application data always flows through a store, which
keeps the data path debuggable.

**Locale lives in the store.** `state.language` is the single source of truth. The store
pushes to i18n and i18n pushes back; `setLocale()` is idempotent, so the loop settles
after one hop and the choice is persisted for free.

**Storage is injected.** Every module that touches persistence accepts an adapter, which
is why the whole app boots in `node --test` under jsdom — see `tests/app.smoke.test.js`,
which drives the real components against a stubbed GitHub API.

---

## Tests

```bash
npm test
```

162 tests across six suites:

- `tests/store.test.js` — reactivity paths, batching, persistence, encode/decode,
  import/export, migrations, corrupt-payload survival.
- `tests/i18n.test.js` — dictionary parity, plurals, interpolation, escaping,
  locale detection, DOM binding applier.
- `tests/status.test.js` — the full detection matrix, including the 30-day and 365-day
  boundaries and every priority tie-break, plus legacy status migration.
- `tests/github.test.js` — endpoint selection, `Link`-header pagination, the truncation
  cap, abort handling, every error kind, and the metadata allow-list.
- `tests/schema.test.js` — defaults, hostile input, vault sealing, codec, selectors.
- `tests/utils.test.js` — object/format helpers, repo normalisation, debounce.
- `tests/app.smoke.test.js` — **jsdom**: boots the real app, opens the drawer, types,
  fetches 101 repositories across two pages, edits statuses and descriptions, toggles
  the fork filter and sorting, switches language, exports/imports.

The suite includes a regression test for repository names containing a dot
(`octo/special.name`), which would be split into nested keys by a naive dot-path write.

---

## Before you deploy

1. Replace the placeholder wallet addresses in `src/config/support.js` — the UI
   currently labels them as placeholders on purpose.
2. Update `LINKS` in `src/config/app.js` if the repository is renamed or moved.
3. Update the `<link rel="canonical">` in `index.html` to your Pages domain.

---

## License

MIT — see [LICENSE](./LICENSE).

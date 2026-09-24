# GitBooklet

> Turn your GitHub repositories into a printable **Classic Book** PDF portfolio.

GitBooklet is a **100% free, 100% client-side** web application. It has no backend, no
accounts, no cookies and no analytics: your repositories are fetched straight from
`api.github.com`, curated in your browser, and composed into a book. Settings — including
an optional Personal Access Token — never leave the device.

Deployed on **Cloudflare Pages** as a static bundle.

---

## Status of this milestone

The shell, i18n, state layer, GitHub integration, repository manager **and the Classic
Book PDF composer** are in.

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
| **PDF "Classic Book" composer: cover, contents, catalogue** | ✅ |
| **Paged-media runners (header / page number / attribution)** | ✅ |
| **Live A4 preview + sticky print action bar** | ✅ |
| Deploy to Cloudflare Pages | ⏳ after the placeholders in `config/support.js` are replaced |

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
├── book/                   Classic Book composer (pure, DOM- and store-free)
│   ├── paginate.js         Geometry: grouping, page packing, TOC sorter
│   ├── compose.js          settings + chapters → the printable book model
│   └── template.js         Book model → one <section class="book-page"> per sheet
├── services/
│   ├── github.js           The only network code: endpoints, pagination, errors
│   ├── status.js           Project status auto-detection engine
│   └── print.js            window.print() trigger: file name, print CSS, cleanup
├── components/
│   ├── AppNavbar.js        Branding, language switch, support, settings, fetch
│   ├── HeroPanel.js        Product intro + live stat strip
│   ├── RepositoryLibrary.js Toolbar, counters, keyed rows, empty states
│   ├── RepoCard.js         One row: visibility, status, custom summary
│   ├── BookPreview.js      Book studio: live preview + sticky print action bar
│   ├── BookSummary.js      Live cover + table of contents preview
│   ├── AppFooter.js        Provenance, privacy line, storage usage
│   ├── SettingsDrawer.js   All persisted configuration + data portability
│   ├── SupportModal.js     Crypto addresses + free ways to help
│   ├── LanguageToggle.js   EN ⇄ DE segmented control
│   └── ui/                 Overlay, Toast, Confirm, Field, Icon
├── styles/
│   ├── index.css           Tailwind v4 `@theme` tokens (paper / ink / brass)
│   ├── components.css      Semantic component classes (.btn, .card, .badge …)
│   ├── book.css            Classic Book: cream paper, serif, pages, runners
│   └── print.css           What survives Ctrl/Cmd+P (app chrome vs. the book)
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

## The Classic Book PDF composer

The book is *composed*, not screenshotted: GitBooklet decides which projects share
a sheet and what number that sheet carries, then renders one
`<section class="book-page">` per physical page. `window.print()` (or the browser's
"Save as PDF") does the rest — no PDF library, no canvas raster, no server.

### Why it paginates itself

A table of contents must quote the page number of a chapter it has not reached yet,
and CSS `@page` counters are not readable from JavaScript. So the numbering is
computed in `book/paginate.js` from the numbers in `config/book.js`, and the
stylesheet merely executes the decision. Two consequences worth knowing:

* **The cover has no running header or footer.** The runners are absolutely
  positioned *inside* each page section, hanging into the sheet margin — so they
  can simply be omitted on page 1. (`position: fixed` would repeat on every sheet
  including the cover; `@page` margin boxes with `content: string(…)` only work in
  Prince and WeasyPrint, not in Chromium.)
* **The geometry is a contract.** `BOOK_PAPER` and `BOOK_WEIGHTS` in
  `config/book.js` mirror `styles/book.css`. Change a padding, change the weight —
  `tests/paginate.test.js` pins the relationships, not the millimetres.

### The document

| Page | Content |
| --- | --- |
| 1 | Cover: title, the subtitle "Project & Codebase Anthology", author, contact, bio, generation date and a colophon line |
| 2 … n | Table of contents, grouped by project status (Live → In Development → Beta/MVP → Paused), each row showing chapter number, title, primary language and page number |
| n+1 … end | Project catalogue: **1–2 projects per page, decided by description length** |

Every project prints its name, a classically styled status badge, its primary
language, stars / forks / last-updated / licence, the short book description, its
topics, and its links.

**Links stay clickable.** Each link is a real `<a href>`, and Chromium's
print-to-PDF preserves link annotations, so the PDF remains navigable. The URL is
*also* spelled out under its label, so the paper copy is usable too. Untrusted
homepages are passed through `safeUrl()` first: anything that is not `http(s)` or
`mailto:` is dropped rather than printed as dead text — or shipped as a clickable
`javascript:` URL.

### Running header and footer

* **Header** — the book title, small and muted.
* **Footer** — `Author: <name>` on the left, the page number centred, and
  `Generated with GitBooklet (https://gitbinder.pages.dev)` on the right.

### Printing

`services/print.js` wraps the `window.print()` call and handles the three things
that are easy to get wrong:

1. **The file name** — Chromium seeds "Save as PDF" with `document.title`, so the
   book title is swapped in for the duration of the call
   (`gitbooklet-my-software-engineering-anthology`) and restored afterwards.
2. **What gets printed** — a `body.is-printing-book` class hides the app chrome and
   reveals the composed book. Nothing is moved in the DOM, so cancelling the dialog
   leaves the app exactly as it was. The book is composed synchronously *before*
   the printer snapshots the page, even if the preview was never opened.
3. **When it finished** — `afterprint` is not fired by every browser, so a safety
   timer releases the guard.

### Book studio UI

A sticky action bar follows the visitor down the page with the live-preview toggle
and the **Generate PDF / Print book** button. The preview renders the real book DOM
at true A4 size through the real print stylesheet — what is on screen is what the
PDF will contain. Recomposition is animation-frame coalesced and skipped entirely
while the preview is collapsed, so typing in a description textarea does not
rebuild a 60-page document on every keystroke.

> **Tip:** `?u=<username>` deep-links straight into a populated book, e.g.
> `https://gitbinder.pages.dev/?u=AndrexTheDev`.

---

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

221 tests across eight suites:

- `tests/store.test.js` — reactivity paths, batching, persistence, encode/decode,
  import/export, migrations, corrupt-payload survival.
- `tests/i18n.test.js` — dictionary parity, plurals, interpolation, escaping,
  locale detection, DOM binding applier.
- `tests/status.test.js` — the full detection matrix, including the 30-day and 365-day
  boundaries and every priority tie-break, plus legacy status migration.
- `tests/github.test.js` — endpoint selection, `Link`-header pagination, the truncation
  cap, abort handling, every error kind, and the metadata allow-list.
- `tests/schema.test.js` — defaults, hostile input, vault sealing, codec, selectors.
- `tests/utils.test.js` — object/format helpers, repo normalisation, URL safety, debounce.
- `tests/paginate.test.js` — the book geometry: entry heights, the 1–2-per-page rule,
  group ordering, TOC widow control, and the invariant that every page number in the
  contents points at the sheet that really holds the chapter.
- `tests/book.test.js` — cover/contents/catalogue rendering, the print controller
  (file name, chrome hiding, dialog refusal, guard release), and the book studio
  mounted in the real app under jsdom.
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

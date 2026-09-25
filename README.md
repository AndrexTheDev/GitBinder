# GitBinder

> Turn your GitHub repositories into a printable **Classic Book** PDF portfolio.

GitBinder is a **100% free, 100% client-side** web application. It has no backend, no
accounts, no cookies and no analytics: your repositories are fetched straight from
`api.github.com`, curated in your browser, and composed into a book. Settings — including
an optional Personal Access Token — never leave the device.

Deployed on **Cloudflare Pages** as a static bundle.

---

## Status of this milestone

The shell, i18n, state layer, GitHub integration, repository manager, the Classic Book
PDF composer, the donations and legal surfaces, **text exports, per-project notes and the
ad-blocker gate** are in.

The project has since been audited module by module for release: every module under
`src/` was read against its tests, and the findings were fixed rather than noted. The
release gate is `npm test` — 687 tests across 34 suites, including `tests/deploy.test.js`,
which fails on any drift between the Pages project name, the deployed origin, the sitemap,
the canonical URL and the Node pin.

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
| **Support modal: SOL / BTC / ETH tabs, QR codes, copy feedback** | ✅ |
| **Footer: Help / Disclaimer / Terms / Contact (EN + DE)** | ✅ |
| **Cloudflare Pages config: wrangler, _headers, CSP, robots, sitemap** | ✅ |
| **Chapter picker: tick projects for the book from the action bar** | ✅ |
| **Text exports: Markdown, plain text, CSV** | ✅ |
| **Per-project notes that survive a re-fetch** | ✅ |
| **Ad-blocker gate with a friendly, re-checkable notice** | ✅ |
| GitBinder brand mark (navbar, footer, book cover, favicon) | ✅ |
| **Release audit, module by module, with the deploy gate in `npm test`** | ✅ |

---

## Quick start

```bash
npm install
npm run dev       # http://localhost:5173  (binds 0.0.0.0 for container/preview use)
```

Other scripts:

```bash
npm test          # the whole suite (node:test, no browser needed)
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
| Node version | leave on the default — `.nvmrc` pins `22.22.3` |

**Option B — Wrangler CLI.**

```bash
npm run deploy          # builds, then `wrangler pages deploy dist --project-name=gitbinder --branch=main`
npm run deploy:preview  # same, but on the current branch → a preview URL
```

`wrangler.toml` pins the project name (it is what produces the `*.pages.dev`
host) and the output directory. The `--branch=main` in `npm run deploy` is not
optional: without it, Wrangler deploys to whatever branch is checked out, which
gives you a preview URL while the production host keeps serving the old build —
a "successful" deploy that changes nothing.

`public/_headers` ships with the build and locks down the security headers and
the cache policy.

**Do not add a `public/_redirects`.** The textbook SPA rule — `/* /index.html 200`
— is rejected by Cloudflare as an infinite loop, because `/*` re-matches
`/index.html` and Cloudflare's own `.html`-stripping redirect throws the result
back into the rule. On Workers the upload fails outright (API code `100324`); on
Pages the rule is discarded with an "Infinite loop detected … has been ignored"
warning on every deploy. It is also unnecessary here: per Cloudflare's docs, *"if
your project does not include a top-level `404.html` file, Pages assumes that you
are deploying a single-page application"* and serves `index.html` for unmatched
paths by itself. This repo ships no `404.html` and no `_redirects`, and unknown
paths return the shell — verified against `wrangler pages dev`, byte for byte.
`tests/deploy.test.js` fails if either file is added back.

**Content-Security-Policy.** The bundle has no inline scripts and only one inline
`<style>` (the pre-paint boot splash), so `_headers` can — and does — ship a strict
CSP: `default-src 'self'`, plus `connect-src https://api.github.com` for the one
outbound call the app makes. If you ever embed a third-party script, font or
analytics snippet, add its origin in `public/_headers`, or switch the header to
`Content-Security-Policy-Report-Only` first and watch the console.

**Option C — GitHub Actions.** See `.github/workflows/deploy.yml`; it needs two
repository secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

---

## Project structure

```
index.html                  Static shell — every mount point lives here
vite.config.js              Vite 8 + Tailwind v4 (CSS-first config)
public/                     favicon, og.png, brand/mark.svg, _headers, robots.txt, sitemap.xml
src/
├── main.js                 Entry point (error boundary + boot splash teardown)
├── app.js                  Bootstrap: mounts components, owns the fetch pipeline
├── config/
│   ├── app.js              Constants, storage keys, GitHub config, LINKS, DEVELOPER
│   └── support.js          Crypto addresses + shape checks (test-enforced)
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
│   ├── template.js         Book model → one <section class="book-page"> per sheet
│   └── export.js           The same model → Markdown / plain text / CSV
├── services/
│   ├── github.js           The only network code: endpoints, pagination, errors
│   ├── status.js           Project status auto-detection engine
│   ├── print.js            window.print() trigger: file name, print CSS, cleanup
│   └── adblock.js          Bait-element detection, no network involved
├── components/
│   ├── AppNavbar.js        Branding, language switch, support, settings, fetch
│   ├── HeroPanel.js        Product intro + live stat strip
│   ├── RepositoryLibrary.js Toolbar, counters, keyed rows, empty states
│   ├── RepoCard.js         One row: visibility, status, summary, notes
│   ├── BookPreview.js      Book studio: live preview, chapter picker, export menu
│   ├── AdBlockNotice.js    The screen a blocked visitor sees
│   ├── BookSummary.js      Live cover + table of contents preview
│   ├── AppFooter.js        Provenance, info links, privacy line, storage usage
│   ├── SettingsDrawer.js   All persisted configuration + data portability
│   ├── SupportModal.js     SOL / BTC / ETH tabs, QR codes, copy feedback
│   ├── InfoModals.js       Help, Disclaimer, Terms, Contact (built on open)
│   ├── LanguageToggle.js   EN ⇄ DE segmented control
│   └── ui/                 Overlay, Toast, Confirm, Field, Icon, Tabs
├── styles/
│   ├── index.css           Tailwind v4 `@theme` tokens (paper / ink / brass)
│   ├── components.css      Semantic component classes (.btn, .card, .badge …)
│   ├── book.css            Classic Book: cream paper, serif, pages, runners
│   └── print.css           What survives Ctrl/Cmd+P (app chrome vs. the book)
└── utils/                  object, format, file, clipboard, timing, qrcode
tests/                      node:test suites (jsdom smoke tests included)
```

---

## State & persistence

Everything the visitor configures lives in `localStorage` under namespaced keys
(`gitbinder:state`, `gitbinder:vault`).

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

### Renamed from GitBooklet

The project was called GitBooklet until Milestone 5. Renaming it must not cost
anybody their book, so visitors who used the old build keep their curated
portfolio under the old keys and `migrateStorageKeys()` moves them across on the
first load after the rename — `gitbooklet:state` → `gitbinder:state`,
`gitbooklet:vault` → `gitbinder:vault`.

It only deletes the old copy once the new one verifies, so a quota error leaves
the original intact rather than destroying both. The legacy names are constants
in `src/config/app.js` and are pinned by `tests/migration.test.js`; they are the
one place where the old name is still expected to appear.

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

The book is *composed*, not screenshotted: GitBinder decides which projects share
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
  `Generated with GitBinder (https://gitbinder.pages.dev)` on the right.

### Printing

`services/print.js` wraps the `window.print()` call and handles the three things
that are easy to get wrong:

1. **The file name** — Chromium seeds "Save as PDF" with `document.title`, so the
   book title is swapped in for the duration of the call
   (`gitbinder-my-software-engineering-anthology`) and restored afterwards.
2. **What gets printed** — a `body.is-printing-book` class hides the app chrome and
   reveals the composed book. Nothing is moved in the DOM, so cancelling the dialog
   leaves the app exactly as it was. The book is composed synchronously *before*
   the printer snapshots the page, even if the preview was never opened.
3. **When it finished** — `afterprint` is not fired by every browser, so a safety
   timer releases the guard.

### Book studio UI

A sticky action bar follows the visitor down the page, and it is the only part
of the book UI that stays visible when the preview is collapsed — which is the
default state, and the state you are in when you reach for the PDF. It carries
four actions:

* **Projects** — a checkbox per fetched repository, with select-all, select-none
  and an `included/total` counter. It writes the same
  `repoOverrides[slug].visible` the library's own checkbox writes, so the two
  views can never disagree.
* **Export as text** — Markdown, plain text or CSV (see below).
* **Preview** — toggle the live A4 preview.
* **Generate PDF / Print book** — compose, then open the print dialog.

Placing the picker here rather than in the studio toolbar is deliberate: the
studio shell is hidden while the preview is collapsed, so a picker living there
would be unreachable exactly when the visitor is about to press Generate.

The preview renders the real book DOM at true A4 size through the real print
stylesheet — what is on screen is what the PDF will contain. Recomposition is
animation-frame coalesced and skipped entirely while the preview is collapsed,
so typing in a description textarea does not rebuild a 60-page document on
every keystroke. On phones the bar's caption and button labels give way below
640 px, leaving icon buttons that keep their accessible names.

> **Tip:** `?u=<username>` deep-links straight into a populated book, e.g.
> `https://gitbinder.pages.dev/?u=AndrexTheDev`.

---

## Text exports

PDF is the showpiece, but it is not the only thing people want out of a
portfolio. The export menu in the action bar writes three more formats, each a
pure function over the same inputs `composeBook()` takes, so an export always
matches the book on screen:

| Format | Best for | Notes |
| --- | --- | --- |
| **Markdown** (`.md`) | READMEs, wikis, static-site generators | Notes become blockquotes, so they read as annotation |
| **Plain text** (`.txt`) | Terminals, email, anywhere at all | Fixed 72-column wrapping, ruled section breaks |
| **CSV** (`.csv`) | Sorting, filtering, spreadsheets | RFC 4180: doubled quotes, CRLF, BOM for Excel |

Two details are deliberate rather than incidental:

* **Empty notes still export.** A project with no notes writes a dotted
  placeholder block, exactly as the PDF prints ruled lines. The file is meant
  to be a working document, not only a snapshot.
* **The CSV carries a BOM** and uses CRLF. Without the BOM, Excel on Windows
  mangles any non-ASCII text — the single most common complaint about exported
  CSV.

File names come from `slugifyTitle()`, shared with the PDF, so the same book
downloaded as a PDF and as Markdown is called the same thing. It maps umlauts
before NFKD decomposition (`ä→ae`, `ö→oe`, `ü→ue`, `ß→ss`, per DIN 5007-2) —
"Übermäßig" has to become `uebermaessig`, not `ubermassig`.

## Per-project notes

Each project has a notes field in the repository manager, and those notes are
printed with the project in the book.

**They belong to you, not to GitHub.** They live in `repoOverrides` beside the
status and the description, nothing derives them from the API, and a re-fetch
cannot touch them — verified end to end: a repository whose description, stars
and status all changed on GitHub keeps its notes byte-for-byte.

In the book the block has two shapes, and the difference is the point:

* **With notes** — your text is printed, line breaks preserved.
* **Without notes** — the block prints ruled lines to write on, by hand or with
  any PDF reader's annotation tool.

The empty block is there on purpose. A notes area that only appears once filled
in is useless to the person who wants to fill it in on the printout. The
paginator reserves the space either way, including explicit newlines, so a book
with notes on every project does not overrun its last sheet. Notes are capped at
600 characters so the block cannot outgrow what the paginator measured.

## The ad-blocker gate

Visitors running a content blocker are shown a notice instead of the app: what
was detected, three steps to allow the page, and a **Check again** button so
nobody has to hunt for a reload. When the blocker is off, the app boots
normally.

Three decisions worth knowing before changing anything here:

* **The app is never constructed when blocked** — not merely covered by an
  overlay. No components mount, no listeners attach, no state is read. An
  overlay over a running app leaves every feature reachable through the
  console and the keyboard.
* **No network.** The usual technique requests a URL that blockers blacklist,
  which would leak a request from every visitor to a third party. This app's
  whole promise is that it talks to nobody but `api.github.com`, so detection
  measures bait elements in the DOM instead.
* **Computed style, not layout metrics.** `offsetHeight`/`offsetParent` are
  zero wherever there is no layout engine — including the test suite — so they
  would flag every visitor. Filter lists hide things with CSS or delete the
  node, which is exactly what is checked.

Detection is heuristic, and this is the honest caveat: Firefox's strict mode
and Brave Shields hide the same bait elements a filter list does, so those
visitors land on the notice too. That is why it explains itself and offers a
re-check rather than a dead end. Set `ADBLOCK_GATE.enabled = false` in
`src/config/app.js` to remove the gate entirely.

## Brand mark

The mark is a bound book spine — page edges combed through the head, raised
bands, dashed rules, `CODE & STORY`, a braided vine, and the imprint block at
the foot. It lives in `public/brand/mark.svg` and is referenced — never
inlined — from the navbar, the footer and the book cover, so the artwork exists
once.

Because the mark is a tall 1:3.34 column rather than a square badge, the three
placements size it by height and take their width from `BRAND_MARK_RATIO`:
44 px in the navbar (which makes it 13 px wide, reading as a deliberate
vertical rule beside the wordmark), 28 px in the footer, and 34 mm on the A4
cover. `tests/brand.test.js` asserts that the constant still matches the file
it describes — a mismatch is a layout shift waiting to happen.

`public/favicon.svg` is a **separate, simplified drawing**, not a scaled copy.
At 16 px one SVG unit is about 0.07 px, so the comb, the stitching and both
imprint lines collapse into the navy. The favicon keeps only what survives:
silhouette, the two bands, a cream bar standing in for the lettering, and the
stem with its nodes.

Both files are plain SVG with no external references, so they stay sharp at any
size, cost no request beyond the drawing itself, and satisfy the CSP. Text
inside the mark is pinned with `textLength`, so the lockup keeps its layout
instead of reflowing with whatever serif the system happens to offer — a
sandbox with no fonts installed at all is how that one got noticed.

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

**No framework.** GitBinder is a single-purpose tool; a ~37 kB gzipped bundle that
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

687 tests across 34 suites. They run on Node's own test runner — no framework, no
configuration — and the whole app boots inside them, so a break anywhere from the
GitHub parser to the print stylesheet fails the same command:

**The state layer**

- `tests/store.test.js` — reactivity paths, batching, persistence, encode/decode,
  import/export, migrations, corrupt-payload survival.
- `tests/schema.test.js` — defaults, hostile input, vault sealing, the codec, and the
  per-repository override rules.
- `tests/context.test.js` — the real `createAppContext()`: the token sealed at rest and
  readable again on the next visit, a payload under the pre-rename storage key moved
  rather than ignored, an older schema version migrated, a bare object without an
  envelope accepted, corrupt storage survived, and the language the visitor chose coming
  back — plus `migrateState()` itself.
- `tests/selectors.test.js` — the merge and ordering rules behind the book: an override
  wins over detection and says so, a note is only ever read from the override, a fork
  stays out until it is ticked, and the chapter order is stable under reversed input.
- `tests/storage.test.js`, `tests/migration.test.js` — the adapters, the memory fallback,
  and the storage-key hand-off that has to survive a failed write.

**Language**

- `tests/i18n.test.js` — dictionary parity, identical placeholders, plurals,
  interpolation, escaping, locale detection, the DOM binding applier, and the scan that
  checks every key the code asks for — including the ones held in a constant.
- `tests/languages.test.js` — the registry, the two dictionaries and the detector have to
  agree in both directions, and the control on the page offers exactly those languages.
- `tests/rerender.test.js` — walks the whole interface while recording every
  `textContent` write, and fails if a binding ever assigns over an element that has
  children. That failure shipped once; it is not going to ship twice.

**GitHub, and what leaves the browser**

- `tests/github.test.js` — endpoint selection, `Link`-header pagination, the truncation
  cap, abort handling, every error kind, the metadata allow-list, and `verifyToken()`.
- `tests/status.test.js` — the full detection matrix, including the 30-day and 365-day
  boundaries and every priority tie-break, plus legacy status migration.
- `tests/security.test.js` — the invariants that must not rot: the token only ever in an
  `Authorization: Bearer` header, no third-party request, `target="_blank"` always
  carrying `rel="noopener noreferrer"`.
- `tests/adblock.test.js` — detection on a clean page and under injected CSS filters, the
  "no layout engine" trap, and that no bait elements are left behind.

**The book**

- `tests/paginate.test.js` and `tests/geometry.test.js` — entry heights, the 1–2-per-page
  rule, TOC widow control, and the invariant that every page number in the contents
  points at the sheet that really holds the chapter.
- `tests/book.test.js` — cover/contents/catalogue rendering, the print controller (file
  name, chrome hiding, dialog refusal, guard release), and the book studio mounted in the
  real app under jsdom.
- `tests/export.test.js` — Markdown/plain-text/CSV output, RFC 4180 escaping, the Excel
  BOM, umlaut transliteration.
- `tests/notes.test.js` — the note lifecycle, including the rule that a re-fetch may not
  touch what the visitor typed.
- `tests/print.test.js`, `tests/print-overlay.test.js` — the print contract, walked
  through the real CSSOM: what is hidden on paper, what is forced.
- `tests/qrcode.test.js` — finder patterns, the quiet zone, determinism, and byte-mode
  case fidelity.

**The interface**

- `tests/app.smoke.test.js` — boots the real app and drives it the way a visitor would:
  fetch 101 repositories across two pages, edit statuses and descriptions, toggle the
  fork filter, switch language, export and import, tick projects in the chapter picker,
  open the text-export menu.
- `tests/dom.test.js`, `tests/list.test.js`, `tests/events.test.js` — the micro DOM layer,
  the keyed-list reconciler that keeps a typing visitor's caret, and the event bus.
- `tests/a11y.test.js` — accessible names and roles on the booted application.
- `tests/icons.test.js` — every icon name the code asks for is registered (a typo renders
  a blank square and one console line, nothing more), and all of them draw.
- `tests/formatting.test.js`, `tests/utils.test.js`, `tests/timing.test.js`,
  `tests/file.test.js` — the `Intl`-backed formatters, the object helpers, the debounce
  and throttle, and every route out of the app that produces a file download.

**Release**

- `tests/deploy.test.js` — the Pages project name, the deployed origin, the sitemap, the
  canonical URL and the Node pin, all cross-checked.
- `tests/brand.test.js` — the mark exists where the code says it does, is self-contained
  SVG, and stays small.
- `tests/support.test.js` — the wallet addresses are shape-checked and not placeholders.

The suite includes a regression test for repository names containing a dot
(`octo/special.name`), which would be split into nested keys by a naive dot-path write.

---

## Before you deploy

1. Check the wallet addresses in `src/config/support.js`. They are real and
   shape-checked (`npm test` fails if one is malformed or still a placeholder),
   but they are yours to confirm — a typo here costs a real donation.
2. Update `LINKS` in `src/config/app.js` if the repository is renamed or moved.
   `LINKS.deployed` is printed in the running footer of every generated page, so
   it is also the URL you want attributed.
3. Update the `<link rel="canonical">` in `index.html` and the `Sitemap:` line in
   `public/robots.txt` to your Pages domain.
4. Match the Pages project name (`gitbinder` here) in `wrangler.toml`,
   `package.json` → `scripts.deploy`, and `.github/workflows/deploy.yml`.
   `tests/deploy.test.js` cross-checks the project name against `LINKS.deployed`,
   so a rename cannot leave the book crediting a host that does not exist.

Watch out for four things that fail silently rather than loudly:

- **A deploy without `--branch=main` is a preview, not a release.** The live
  host keeps serving the previous build and nothing in the output says so.
- **`NODE_VERSION` in the dashboard can be ignored.** Once a `wrangler.toml`
  exists, Cloudflare treats the file as the source of truth for the project and
  the environment variable may not win. `.nvmrc` is the reliable pin.
- **A `_redirects` file breaks the deploy** rather than fixing routing; see the
  note above.
- **`NODE_ENV=production` in the dashboard breaks the build.** Cloudflare runs
  `npm ci` first, and that variable makes npm skip devDependencies — which is
  where Vite lives, so the build stops with `vite: not found` before it reaches
  any of this code. `.npmrc` pins `include=dev` so the deploy works with or
  without it (`tests/deploy.test.js` fails if that file goes away).

---

## License

MIT — see [LICENSE](./LICENSE).

# GitBinder — beta run results

Ledger for the run planned in [`PLAN.md`](./PLAN.md). Every number below came
from a command executed on 2026-09-25 in the sandbox at
`/home/user/GitBinder`, branch `arena/01a0d7de-gitbinder`.

Environment: Debian 12, Node **v22.22.3** (matches `.nvmrc` / `.node-version`),
npm 10.9.8, Vite 8.3.1.

---

## Step 1 — M00 Baseline & build ✅

| Check | Command | Result |
| --- | --- | --- |
| Dependencies install | `npm install --no-audit --no-fund` | 74 packages, 4 s, exit 0 |
| Unit suite, **without** `dist/` | `npm test` | 714 tests · **712 pass** · 0 fail · **2 skipped** |
| Production build | `npm run build` | ✓ 1921 modules, 512 ms |
| Unit suite, **with** `dist/` | `npm test` | 714 tests · **714 pass** · 0 fail · **0 skipped** |
| Bundle weight | `ls dist` | index.html 5.44 kB · style 69.68 kB (gzip 13.40) · vendor 32.01 kB · index 182.12 kB (gzip 58.42) |
| Deploy files shipped | `ls dist` | `_headers`, `robots.txt`, `sitemap.xml`, `favicon.svg`, `og.png`, `brand/` |
| `dist/` size | `du -sh dist` | 365 K |
| Beta fixture vs. real app | `npm run beta:selfcheck` | **11 / 11 pass** |
| Matrix expansion | `npm run beta:shots:plan` | **57 scenarios → 70 captures**, matrix validates |
| Dev server | `npm run dev` | Vite ready in 320 ms, listening on `0.0.0.0:5173` |

What the self-check actually executes: the real `bootstrap()` from `src/app.js`
in jsdom, the real `fetchUserRepos()` pagination loop (103 repos over 2 pages),
`normalizeRepo()`, `detectStatus()` for all four statuses, the `/user/repos`
switch when a token is present, and the rendered `.repo-card` DOM. It is the
proof that the screenshots to come are pictures of the real app and not of a
mock that happens to look like it.

### Findings

**F-01 · CI never runs the two built-output assertions** — severity: medium,
module: M00, status: open.

`tests/deploy.test.js` gates two tests on the presence of `dist/`:

```js
test('the built site is entirely self-contained', { skip: !has('dist') ? … : false }, …)
test('the built site ships the deploy files and the brand assets', { skip: … }, …)
```

`.github/workflows/ci.yml` runs `npm test` (line 23) **before** `npm run build`
(line 26), so on a fresh checkout `dist/` does not exist yet and both tests
skip — silently, with exit code 0. Reproduced locally: without `dist/` the suite
reports `pass 712 / skipped 2`; after `npm run build` the same suite reports
`pass 714 / skipped 0`. The drift checks the README names (Pages project name,
deployed origin, sitemap, canonical URL, Node pin) are among the other 15 tests
in that file and *do* run, so the release gate is not broken — these two
assertions are simply never exercised where it matters.

*Fix:* move the build step above the test step in `ci.yml`, or gate on
`npm run build && npm test`.

*Not checked:* the CI job log for run `36116792977`, to read the `# skipped 2`
line directly — `results-receiver.actions.githubusercontent.com` is not
reachable from this sandbox. The conclusion rests on the workflow order plus the
local reproduction above.

**F-02 · No browser engine can be installed in the sandbox** — severity:
informational, status: accepted, workaround in place.

The screenshot matrix needs Chromium. Every download host is blocked here:

| Host | Used for | Result |
| --- | --- | --- |
| `registry.npmjs.org` | npm packages | 200 |
| `api.github.com` | GitHub API, `gh` | 200 |
| `codeload.github.com` | branch tarballs | 200 |
| `cdn.playwright.dev` | Playwright browsers | `000` (TLS reset) |
| `storage.googleapis.com` | Puppeteer / Chrome-for-Testing | `000` |
| `deb.debian.org` | `libnss3`, `libatk`, `libpango`, … | `000` (apt fails) |
| `objects.githubusercontent.com` | release assets | `000` |
| `cdn.jsdelivr.net`, `unpkg.com`, `*.npmmirror.com` | mirrors | `000` |

No system browser exists either (`find /` finds none) and the Chromium shared
libraries are absent (`libnss3`, `libatk-1`, `libpango`, `libgbm`, `libcairo`,
`libasound` → 0 matches in `/usr/lib/x86_64-linux-gnu`). So the matrix is
rendered by `.github/workflows/screens.yml` on `ubuntu-latest` and committed
back to `beta/shots/`, which this sandbox can then read via `codeload`.

### First full sweep (all 16 modules, one capture pass)

The harness was then pointed at the whole matrix: **70 captures → 58 pass,
12 fail**. All 12 remaining failures are the *same* defect (F-03). Every other
module captured green on the first real-browser pass — including the two
areas that had looked broken in the pilot run but turned out to be harness
artefacts (F-04).

| Module | Captures | Failed | Verdict |
| --- | ---: | ---: | --- |
| M01 Layout shell | 6 | 2 | F-03 only |
| M02 i18n | 3 | 1 | F-03 only |
| M03 GitHub | 13 | 2 | F-03 on mobile; all error kinds green |
| M04 Manager | 6 | 2 | F-03 on mobile |
| M05 Card & overrides | 4 | 0 | ✅ |
| M06 Status engine | 1 | 0 | ✅ all four statuses |
| M07 Settings | 5 | 1 | F-03 on mobile; token-verify-fail green |
| M08 Summary + picker | 4 | 1 | F-03 on mobile |
| M09 Book studio | 4 | 1 | F-03 on mobile; cover/contents/catalogue green |
| M10 Print / PDF | 2 | 0 | ✅ chrome hidden, A4 PDF produced |
| M11 Exports | 2 | 0 | ✅ |
| M12 Support | 4 | 1 | F-03 on mobile; QR + copy green |
| M13 Legal modals | 5 | 0 | ✅ incl. DE contact + Escape |
| M14 Ad-block gate | 3 | 0 | ✅ gate shows, re-check boots the app |
| M15 A11y / responsive | 5 | 1 | F-03 at 320 px; skip-link + focus trap green |
| M16 Persistence | 3 | 0 | ✅ reload, migration, import |

### Findings (continued)

**F-03 · Horizontal overflow on narrow viewports — the repo card's right column**
— severity: high, modules: M01/M04/M05/M15, status: open.

Every capture at ≤ ~430 px (`mobile 390`, `small 320`) fails with
`horizontal-overflow`: the document is ~425 px wide in a 390 px viewport and
355 px in 320. The runner names the offending nodes, and they are stable across
shots:

```
<div.flex.shrink-0.items-center>        right=432px   (link/status badges)
<span.flex.flex-col.items-end>          right=432px   (card right column)
<span.text-2xs.text-ink-400>            right=432px
<span.badge.badge--neutral>             right=432px
```

i.e. the right-hand badge/meta column of `.repo-card` (`components/RepoCard.js`,
the `flex flex-col items-end` block holding `linkBadges` + `badges`) never
shrinks or wraps below ~430 px, so the page scrolls sideways and text is visibly
clipped (the library header's "Synchronised …" / connection badge are cut off in
`m03-fetch-loaded@mobile@en`). This is the one genuine app defect the first
sweep surfaced, and it affects the app's most important surface (the library)
on phones.

**F-03 status (after fix attempts).** Two distinct contributors, fixed / open:

1. *Library header — fixed.* `components/RepositoryLibrary.js` rendered the
   "N repositories · M in the book" chip **and** the long, unbreakable
   "Synchronised … / Public" detail in a `shrink-0` block. The fix hides the
   secondary detail below `sm` (`hidden … sm:flex`) and lets the right block
   wrap (`min-w-0 flex-wrap justify-end`). Verified: the card/header offenders
   disappeared from the matrix.

2. *Navbar — open, precisely localised.* The runner's layer diagnosis shows that
   on every ≤ 390 px capture, hiding `#navbar-root` alone drops `scrollWidth`
   from ~425 px to exactly 390 px — the navbar is the remaining constant
   overflow. An icon-only-Fetch attempt *regressed* it (425→451) and was
   reverted; the navbar needs an interactive pass to compress its
   wordmark+EN/DE+actions row without removing affordances. Kept as an open,
   reproducible finding rather than guessed at blind.

**F-04 · The ad-block gate did NOT crash — the first pilot's M14 failure was the
runner** — severity: n/a (correction), module: M14, status: resolved (harness).

The pilot run reported `Cannot read properties of null (reading 'append')` in
all three M14 captures. Root cause: the runner injected its bait-hiding
`<style>` at `document_start`, where neither `<head>` nor `<html>` exists yet —
`(document.head ?? document.documentElement).append(...)` threw in the harness,
not the app. After deferring the style until `<head>` exists, all three M14
captures pass: the gate renders when baits are hidden and the re-check boots the
real app. The gate is **not** a bug.

---

### Visual review notes (first pass, desktop + the failing mobile set)

Reviewed by eye from `beta/shots/`:

* **M01 shell** — desktop empty state is clean and well balanced; hero, stat
  tiles, fetch card, three-step strip, library + sticky summary all present.
* **M05/M06/M08** — the full-page matrix shows every status badge (LIVE /
  IN DEVELOPMENT / BETA·MVP / PAUSED), per-card override dropdowns, short
  descriptions and notes, and the summary's chapter list grouped by status.
* **M09 book cover** — the seeded custom title + author flow onto a properly
  typeset cover (spine mark, small-caps, blurb) on the dark studio backdrop.
* **M10 print** — `print.css` strips navbar/footer/book-bar; catalogue pages
  keep topics, repo/docs links and the ruled NOTES box; running footer prints.
* **M12 support** — BTC tab renders a real client-side QR + bech32 address,
  copy/explorer actions and the SOL/BTC/ETH tabs; no blank QR.
* **M14 gate** — friendly notice, no app chrome behind it; re-check boots the
  app (F-04).
* **M01/M03/M15 mobile** — content reads fine but the navbar introduces a
  ~35 px horizontal scroll (F-03.2); text near the right edge is clipped.

Everything else on desktop passed both the assertions and the eye. The single
cross-cutting defect to fix next is the mobile navbar overflow.

---

## Step 2 — M01 Layout shell

_sweep captured + visually reviewed; open: F-03.2 (navbar overflow)_

### Rest-module review (second pass)

* **M02 i18n** — German is complete and idiomatic end to end (hero, toolbar,
  bulk actions, book studio, toasts); no truncated DE labels on desktop.
* **M04 manager** — search filters live with a clear button and a visible focus
  ring; sort/hide-forks/bulk controls all render.
* **M07 settings** — strong privacy story ("stored locally, nothing uploaded"),
  token field with reveal/verify/remove, scope hint and the obfuscation warning.
  *Minor:* the "NO TOKEN STORED — PUBLIC REPOSITORIES…" badge clips at the
  drawer's right edge on desktop.
* **M11 exports** — the menu lists Markdown/.md, Plain text/.txt, CSV/.csv with
  icons; export raises a success toast.
* **M13 legal/contact** — German contact modal is complete, including the
  hobby-project disclaimer; footer links localise.
* **M15 responsive** — at 1920 px the content column stays capped and readable;
  the summary shows status-group chips + ToC. (320/390 px remain blocked by
  F-03.2, the navbar overflow.)
* **M16 persistence** — importing a settings file applies it live (UI switched
  to the imported language) with a success toast; export offers an opt-in
  "include token" checkbox. Pre-existing toasts keep their original language —
  acceptable, not a bug.

No new blocking defects surfaced in the second pass; the only cross-cutting
issue remains **F-03.2 (mobile navbar overflow)**, plus the two cosmetic notes
above (token badge clip in the drawer; non-retroactive toast language).

---

## Step 3 — M02 i18n

_reviewed, ✅ (see second-pass notes)_

## Step 4 — M03 GitHub integration

_not started_

## Step 5 — M04 Repository manager

_not started_

## Step 6 — M05 Repository card & overrides

_not started_

## Step 7 — M06 Status auto-detection

_not started_

## Step 8 — M07 Settings drawer

_not started_

## Step 9 — M08 Summary & chapter picker

_not started_

## Step 10 — M09 Book studio & preview

_not started_

## Step 11 — M10 Print / PDF

_not started_

## Step 12 — M11 Text exports

_not started_

## Step 13 — M12 Support & donations

_not started_

## Step 14 — M13 Legal & info modals

_not started_

## Step 15 — M14 Ad-blocker gate

_not started_

## Step 16 — M15 A11y & responsive

_not started_

## Step 17 — M16 Persistence & migration

_not started_

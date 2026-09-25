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

---

## Step 2 — M01 Layout shell

_not started_

## Step 3 — M02 i18n

_not started_

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

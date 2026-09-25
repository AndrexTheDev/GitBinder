# GitBinder — beta run

A systematic pre-release pass over the whole app, module by module, with a
screenshot matrix as the evidence.

This folder holds the plan, the matrix and the runner. Results land in
[`RESULTS.md`](./RESULTS.md) as each step is executed.

---

## How the run is organised

Sixteen modules, executed in order. A module is only *done* when its scenarios
have been driven in a real browser **and** every screenshot has been looked at —
a green assertion with a broken layout on the picture is still a finding.

| Module | Surface under test | Primary source |
| --- | --- | --- |
| M00 | Baseline: unit suite, production build, deploy gate | `tests/`, `vite.config.js`, `public/_headers` |
| M01 | Layout shell: navbar, hero, library, summary, footer | `index.html`, `components/App*.js` |
| M02 | i18n: EN/DE dictionaries, toggle, `<html lang>` | `core/i18n.js`, `i18n/locales/*` |
| M03 | GitHub: endpoints, pagination, every error kind | `services/github.js`, `app.js` |
| M04 | Repository manager: search, sort, hide forks, bulk select | `components/RepositoryLibrary.js` |
| M05 | Repository card: description, status override, notes, focus | `components/RepoCard.js` |
| M06 | Status auto-detection: all seven reasons | `services/status.js` |
| M07 | Settings drawer: identity, book meta, token, data | `components/SettingsDrawer.js`, `core/vault.js` |
| M08 | Summary + chapter picker | `components/BookSummary.js`, `BookPreview.js` |
| M09 | Book studio: cover, contents, catalogue, A4 preview | `book/*`, `components/BookPreview.js` |
| M10 | Print / PDF: `print.css`, page count, chrome hidden | `styles/print.css`, `services/print.js` |
| M11 | Text exports: Markdown, plain text, CSV | `book/export.js`, `utils/file.js` |
| M12 | Support modal: SOL/BTC/ETH tabs, QR, clipboard | `components/SupportModal.js`, `utils/qrcode.js` |
| M13 | Legal + info modals (help, disclaimer, terms, contact) | `components/InfoModals.js`, `AppFooter.js` |
| M14 | Ad-blocker gate: detection, notice, re-check | `services/adblock.js`, `components/AdBlockNotice.js` |
| M15 | A11y + responsive: skip link, focus trap, 320→1920 px | `tests/a11y.test.js`, `styles/*` |
| M16 | Persistence: reload, legacy-key migration, import | `core/storage.js`, `state/*` |

## The matrix

`matrix.json` holds one entry per **scenario**; the runner expands each over
`viewports × langs` into concrete captures — currently **57 scenarios → 70
captures**.

Viewports: `desktop 1440×900`, `tablet 820×1180`, `mobile 390×844`,
`small 320×568`, `wide 1920×1080`. Locales: `en`, `de`.

Every scenario carries an `expect` block, so a capture is an assertion and not
just a picture:

```jsonc
{
  "id": "m06-status-matrix",
  "module": "M06",
  "fixture": "ok",                 // which GitHub response the app sees
  "seed": { "username": "octodemo" },
  "expect": {
    "selectors": [".repo-card[data-status=\"live\"]"],
    "count": { ".repo-card": 12 },
    "noScrollX": true
  }
}
```

### Determinism

No shot talks to the real `api.github.com`. `runner/fixture.js` answers at the
network layer with GitHub-shaped payloads (`full_name`, `pushed_at`,
`stargazers_count`, …) so the app's real `normalizeRepo()` / `detectStatus()`
run, and it computes dates **relative to now** — hardcoded ISO strings would
drift, and a repo that is "In Development" today would silently become "Paused"
next month. Scenarios: `ok`, `paged` (103 repos / 2 pages), `empty`, `notFound`,
`unauthorized`, `rateLimit`, `server`, `offline`, `slow`, `token`.

### Checks that run on every capture

* page errors and `console.error` output
* failed network requests (fixture aborts excepted)
* horizontal overflow
* `data-i18n` nodes that rendered empty or as their own key
* controls without an accessible name, images without `alt` (warning)

## Running it

```bash
npm ci
npm run beta:selfcheck     # fixture × real app in jsdom — no browser needed
npm run beta:shots:plan    # what the matrix expands to
npm run build && npm run preview
npm run beta:shots         # renders beta/shots/ (+ report.json, REPORT.md)
```

The runner needs Chromium. It is not installed in every environment, so it
prints the two commands to get it and exits with code 3 instead of failing
mid-run. `.github/workflows/screens.yml` runs the same command on
`ubuntu-latest`, uploads the matrix as an artifact **and** commits it to
`beta/shots/` on the triggering branch, so the pictures can be reviewed without
re-running anything.

## Pass criteria

A module passes when, across all of its captures:

1. no page error and no `console.error`;
2. every `expect` assertion holds;
3. no horizontal overflow at any viewport in the matrix;
4. no untranslated or empty label in either locale;
5. every screenshot has been **looked at** — spacing, alignment, truncation and
   contrast are not things an assertion can see.

Anything else is a finding, recorded in `RESULTS.md` with the capture name that
shows it.

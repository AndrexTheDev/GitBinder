# GitBinder — Phase 2: hardening & perfection

Phase 1 (see `PLAN.md` / `RESULTS.md`) established the baseline, the screenshot
matrix (70/70) and fixed the layout/CI findings. Phase 2 goes deeper than
"does it render": it tries to make the app *wrong* on purpose and locks down
every way it refuses to be.

Steps are executed in order; each one ends with a durable test (in the release
gate or in `beta:selfcheck`, which CI runs) so a regression cannot slip back in.

| Step | Theme | Status |
| --- | --- | --- |
| P2‑1 | Security / output escaping (XSS, `javascript:` hrefs) | ✅ done — found & fixed one real vuln |
| P2‑2 | Storage & session robustness (corrupt/quota, fetch races, Unicode) | ✅ done — no new defects; pinned by 4 integration tests |
| P2‑3 | Data-output correctness (PDF structure, full-fixture export round-trips) | ✅ done — integration seam pinned; per-format/PDF already unit-covered |
| P2‑4 | Accessibility deep-dive (focus behaviour, landmarks, live region) | ✅ done — jsdom-verifiable behaviour pinned; contrast/axe belong to the browser run |
| P2‑5 | Performance (bundle budget, 103-repo render/filter, debounce coalescing) | ✅ done — 3 deterministic checks |
| P2‑6 | i18n polish (pluralisation) | ✅ done — fixed hardcoded plurals ("1 stars" → "1 star") |

---

## P2‑1 — Security / output escaping ✅

**Audit.** Every DOM node in the app is built through `h()` with `text:`
(textContent); the only `innerHTML` sinks are (a) `h()`'s `html:` prop — unused,
(b) the i18n `data-i18n-html` binding — unused (no dictionary string uses
`{{{…}}}`), (c) the static boot splash, (d) the QR SVG built from app-controlled
values with `escapeHtml()`. Links go through `safeUrl()` (http/https/mailto
allow-list). So the posture is strong.

**Real vulnerability found & fixed.** The repository *card* attached the
owner-controlled `homepage` as a raw `href` (`RepoCard.js`), unlike the book,
which already used `safeUrl()`. A repository whose owner sets
`homepage: "javascript:…"` therefore rendered a **live `javascript:` link** in
the library. Fixed by routing the card's homepage badge through `safeUrl()`
(dropping unsafe schemes, normalising scheme-less hosts exactly like the book).

**Locked down.** New adversarial end-to-end tests (`beta/runner/selfcheck.mjs`,
"adversarial GitHub payloads render inert") drive a hostile repository —
`<script>`, `<img onerror>`, handler attributes, `javascript:` homepage — through
the real card and the real book composer and assert nothing executes and nothing
injects. `beta:selfcheck` is 14/14 and runs in the `Beta screenshots` workflow,
so the guarantee holds in CI. One existing smoke assertion was updated to the
normalised homepage form, matching the security suite's pinned expectation.

Re-rendered the matrix after the fix: **70/70, 0 failed** — no visual regression
(the homepage badge still renders for valid addresses).

## P2‑2 — Storage & session robustness ✅

**Audit.** The persistence layer is already defensive: a single persisted store
(`gitbinder:state`; repositories are memory-only by design) restores inside a
`try/catch` that falls back to defaults and reports via `onError`; `persistNow()`
swallows write failures (quota/blocked storage) the same way; `resolveStorage()`
probes `setItem` and falls back to an in-memory adapter; `fetchRepos()` aborts a
superseded request and treats `AbortError` as "not an error". Cross-tab sync and
the migration-with-verify path are already covered by the unit gate.

**No new defects.** Instead of finding a bug, this step converts that posture
into an integration guarantee — four tests in `beta/runner/selfcheck.mjs`
("storage & session robustness", run by CI) drive the real `bootstrap()`:

- **corrupt persisted JSON** in `gitbinder:state`/`gitbinder:vault` → app boots
  on defaults, and a following fetch still renders all 12 cards;
- **a storage that throws on every write** (quota) → in-memory state still
  updates and the library stays fully usable;
- **a superseded fetch** (slow first request aborted by a fast second) → the
  aborted result loses; final state is the newer dataset, status `ready`;
- **Unicode** (umlauts, emoji, CJK, quotes, `<angle>`) typed into a card →
  stored verbatim in state, persisted verbatim to `gitbinder:state`, rendered
  intact, nothing injected.

`beta:selfcheck` is 18/18; the release gate stays 714/714.

## P2‑3 — Data outputs ✅

**Audit.** Export correctness (RFC-4180 escaping, BOM, CRLF, round-trip parse)
is already pinned by `tests/export.test.js`; book/PDF structure (one section per
page, running heads, folios, TOC page targets, hostile-URL safety, text-not-HTML
typesetting) by 30 tests in `tests/book.test.js`. Crucially, `BookPreview`
feeds the *same* `currentChapters()` to both `compose()` and `exportAs()`, so an
export can never diverge from the book on screen. Re-testing those on synthetic
inputs would only duplicate coverage.

**What was missing — the integration seam at full size.** Two tests in
`beta/runner/selfcheck.mjs` ("data outputs over the full fixture") drive the real
selection→compose pipeline with all 12 repositories:

- the composed book renders **one `.book-entry` and one `.book-toc__entry` per
  selected repo**, every slug present in both, folios ascending and unique, a
  cover page present, and every TOC page target within range;
- all three export formats (`.md`/`.txt`/`.csv`) come back non-empty with the
  right filename/extension/mime, the CSV parses to **header + 12 records**, and
  the Markdown carries **12 numbered chapter sections**.

`beta:selfcheck` is 20/20; the release gate stays 714/714.

## P2‑4 — Accessibility ✅

**Audit.** `tests/a11y.test.js` already pins accessible names (shell + drawer +
every card), label/control association, alt text, valid ARIA references,
document language/title, unique ids and per-locale control names. The shared
`ui/Overlay.js` is correctly built: `role="dialog"` + `aria-modal`, focus moved
in (via `requestAnimationFrame`) and trapped (Tab/Shift-Tab cycle), a stacked
`Escape` handler, and focus returned to the opener on close. `index.html`
carries a `skip-link`, a `<main id="main">` landmark and a `#toast-root`
`role="status" aria-live="polite"` region.

**What jsdom can additionally prove** (and no static check catches) — two
integration tests in `beta/runner/selfcheck.mjs` ("accessibility behaviour"):

- opening the settings drawer **moves focus into the dialog**, and closing it
  **returns focus to the element that opened it**;
- the shell exposes a `<main>` and `<nav>` landmark, a skip link targeting
  `#main`, and the polite live region the toasts ride on.

**Honest scope note.** Contrast ratios and full axe rules need a real rendering
engine, so they are *not* asserted here — they belong to the browser run, not
jsdom. The overlay's `Escape`-to-close is also browser-verified rather than
asserted in jsdom, because that handler binds to the `window` present at
module-import time and a synthetic event on a later test window would not reach
it; the synchronous focus-restore on `close()` is what the test pins.

`beta:selfcheck` is 22/22; the release gate stays 714/714.

## P2‑5 — Performance ✅

Timing under `node:test` is too noisy to assert on, so this step measures the
deterministic things (three tests in `beta/runner/selfcheck.mjs`, "performance"):

- **Bundle budget** — the production JS (app + vendor), gzipped, must stay under
  90 KB. Today it is ~69 KB (index ~58 KB + vendor ~11 KB); the guard fails if a
  heavy dependency lands without a decision. Skips cleanly when `dist/` is absent.
- **Full-list render/filter** — the library renders all **103** repositories from
  the `paged` fixture, a non-matching filter empties it to 0, and clearing the
  filter restores all 103.
- **Debounce coalescing** — five keystrokes inside the debounce window store only
  the final value, not one write per keystroke.

`beta:selfcheck` is 25/25; the release gate stays 714/714.

## P2‑6 — i18n pluralisation ✅

**Real bug found & fixed.** Several count-bearing strings were hardcoded plural,
so the UI read **"1 stars"**, **"1 forks"**, **"1 open issues"**, **"1
characters"** and **"Loaded 1 repositories so far…"** whenever a count was
exactly one. Converted to `{ one, other }` plural objects (resolved through the
existing `Intl.PluralRules` path) in **both** `en.js` and `de.js`:
`library.row.stars/forks/issues`, `library.loading.count`, `common.characters`.
The resolver already falls back to `other` when no count is given, so the change
is safe for every call site; counts above one are unchanged.

**Locked down.** Three tests in `beta/runner/selfcheck.mjs` ("i18n
pluralisation") assert the singular at one and the plural above one, in English
and German.

`beta:selfcheck` is 28/28; the release gate stays 714/714 (locale parity intact).

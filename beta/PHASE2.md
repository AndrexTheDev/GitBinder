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
| P2‑2 | Storage & session robustness (corrupt/quota/cross-tab, fetch races, Unicode) | pending |
| P2‑3 | Data-output correctness (PDF structure, full-fixture export round-trips) | pending |
| P2‑4 | Accessibility deep-dive (axe-core in CI, contrast, focus order) | pending |
| P2‑5 | Performance (100+ repos render, bundle budget, debounce) | pending |
| P2‑6 | i18n polish (plurals, date formats, long DE strings) | pending |

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

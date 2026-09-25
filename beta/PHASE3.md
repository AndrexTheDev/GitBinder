# GitBinder — Phase 3: deep dives

Phase 1 established the baseline + screenshot matrix (70/70); Phase 2 hardened
security, robustness, outputs, a11y, performance and i18n (28→30 selfcheck
tests, two real fixes). Phase 3 goes after the seams a unit suite cannot reach,
prioritised by what a bug would cost a visitor.

| Step | Theme | Status |
| --- | --- | --- |
| V3‑1 | Data-loss protection (export→import round-trip, legacy migration) | ✅ done — no data-loss; pinned by 2 integration tests |
| V3‑2 | Cross-tab session sync (storage events across two live apps) | ✅ done — a hide in tab A re-renders tab B |
| V3‑3 | Selection combinatorics (search × sort × hide-forks, full fixture) | ✅ done — every combo yields the exact subset |
| V3‑4 | Print/PDF page fidelity (catalogue packing over large sets) | pending |
| V3‑5 | Cross-browser (Firefox/WebKit in CI) | pending |

---

## V3‑1 — Data-loss protection ✅

The settings store already exposes `exportJSON` (redacted), `importJSON` and a
versioned `migrate` path, each unit-tested on synthetic stores. What was *not*
tested end to end: does a real backup survive a real restore, and does a legacy
(v0) profile keep its book?

Two integration tests in `beta/runner/selfcheck.mjs` ("data-loss protection"):

- **export→import round-trip** — curate a repo (status/description/notes), set a
  book title and a token, `exportJSON()`, then import into a *fresh* bootstrap.
  The description, notes, status and title all come back, and the serialized
  export **does not contain the token** (redaction verified on the wire).
- **legacy migration** — seed storage with a bare version-0 state (no envelope)
  holding an override; boot the real app and assert the override, its
  description and the username survive instead of being discarded.

A small correction surfaced while writing these: the book title lives in
`state.customBookTitle`, not `state.book.title` (`book` only carries `preview`),
so the test asserts the real key.

No data-loss defect found — the round-trip and migration are correct. The value
is the durable guarantee: `beta:selfcheck` is 32/32; the release gate stays
714/714.

## V3‑2 — Cross-tab sync ✅

Two real `bootstrap()`s share one storage. Tab A hides a repository and calls
`persistNow()`; the resulting `storage` event, delivered to Tab B's window exactly
as the browser would, re-hydrates Tab B's store **and** re-renders its library.

One correction while writing it: the repository manager lists *every* repository
with an "include in book" checkbox, so hiding a repo removes it from the **book**
but not from the manager list. The test therefore asserts the card's checkbox
flips to unchecked (and the store updates), not that a card disappears.

Also learned: `tests/helpers/dom.js` installs each environment's `window`/
`document` as globals, so two live environments must be unwound in reverse order
after letting debounced work settle — the test does this to avoid tearing down
globals a still-live app needs.

No sync defect found — the cross-tab path is correct. `beta:selfcheck` 33/33;
the release gate stays 714/714.

## V3‑3 — Selection combinatorics ✅

`search × sort × hide-forks` over the full 103-repository `paged` fixture (status
is a *sort*, not a filter, in the toolbar). For each combination the test
recomputes the expected subset **independently** from the session's repos and
asserts the rendered card set equals it, plus that the ordering respects the
active sort's primary comparator (name ascending / updated descending). A
no-match search yields the empty state with zero cards.

No defect found — the selection pipeline composes correctly. `beta:selfcheck`
35/35; the release gate stays 714/714.

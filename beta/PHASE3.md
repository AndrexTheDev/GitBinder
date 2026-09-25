# GitBinder — Phase 3: deep dives

Phase 1 established the baseline + screenshot matrix (70/70); Phase 2 hardened
security, robustness, outputs, a11y, performance and i18n (28→30 selfcheck
tests, two real fixes). Phase 3 goes after the seams a unit suite cannot reach,
prioritised by what a bug would cost a visitor.

| Step | Theme | Status |
| --- | --- | --- |
| V3‑1 | Data-loss protection (export→import round-trip, legacy migration) | ✅ done — no data-loss; pinned by 2 integration tests |
| V3‑2 | Cross-tab session sync (storage events across two live apps) | pending |
| V3‑3 | Selection combinatorics (search × sort × hide-forks × status, full fixture) | pending |
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

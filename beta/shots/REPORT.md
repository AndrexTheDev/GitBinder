# GitBinder beta run — screenshot matrix

Captured 70 shots from http://127.0.0.1:4173 on 2026-09-25T10:17:56.446Z.
**58 passed, 12 failed, 0 warning(s).**

| Module | Shots | Failed |
| --- | ---: | ---: |
| M01 | 6 | 2 |
| M02 | 3 | 1 |
| M03 | 13 | 2 |
| M04 | 6 | 2 |
| M05 | 4 | 0 |
| M06 | 1 | 0 |
| M07 | 5 | 1 |
| M08 | 4 | 1 |
| M09 | 4 | 1 |
| M10 | 2 | 0 |
| M11 | 2 | 0 |
| M12 | 4 | 1 |
| M13 | 5 | 0 |
| M14 | 3 | 0 |
| M15 | 5 | 1 |
| M16 | 3 | 0 |

## Failures

### m01-shell-empty@mobile@en — First visit, nothing fetched yet
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m01-shell-empty-de@mobile@de — First visit — German
- **horizontal-overflow** — content is 424px wide in a 390px viewport

### m02-i18n-loaded-de@mobile@de — Loaded library in German
- **horizontal-overflow** — content is 424px wide in a 390px viewport

### m03-fetch-loaded@mobile@en — Twelve repositories fetched
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m03-error-notfound@mobile@en — Unknown username (404)
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m04-search@mobile@en — Search filters the list
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m04-search-noresult@mobile@en — Search with no matches
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m07-settings-top@mobile@en — Settings drawer — GitHub & token
- **horizontal-overflow** — content is 425px wide in a 390px viewport — widest: <span.badge.badge--neutral> w=346 right=505

### m08-chapter-picker@mobile@en — Chapter picker open
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m09-book-bar@mobile@en — Sticky action bar on mobile
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m12-support-modal@mobile@en — Support modal
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m15-responsive-small@small@en — Narrowest phone (320 px)
- **horizontal-overflow** — content is 355px wide in a 320px viewport — widest: <div.flex.shrink-0.items-center.gap-2> w=358 right=378; <button.btn.btn-outline.book-bar__action> w=38 right=332; <button.btn.btn-accent.book-bar__action> w=38 right=378; <svg.> w=16 right=367; <path.> w=13 right=366; <path.> w=8 right=363
- **horizontal-overflow** — 35px of horizontal overflow

## All captures

- ✅ `m01-shell-empty@desktop@en` — First visit, nothing fetched yet (992 ms)
- ✅ `m01-shell-empty@tablet@en` — First visit, nothing fetched yet (919 ms)
- ❌ `m01-shell-empty@mobile@en` — First visit, nothing fetched yet (878 ms)
- ✅ `m01-shell-empty-de@desktop@de` — First visit — German (947 ms)
- ❌ `m01-shell-empty-de@mobile@de` — First visit — German (869 ms)
- ✅ `m01-shell-scrolled@desktop@en` — Sticky navbar after scrolling (1421 ms)
- ✅ `m02-i18n-loaded-de@desktop@de` — Loaded library in German (1465 ms)
- ❌ `m02-i18n-loaded-de@mobile@de` — Loaded library in German (1399 ms)
- ✅ `m02-i18n-toggle@desktop@en` — Language toggle mid-session (1650 ms)
- ✅ `m03-fetch-loading@desktop@en` — Fetch in flight (skeletons) (220 ms)
- ✅ `m03-fetch-loaded@desktop@en` — Twelve repositories fetched (1459 ms)
- ✅ `m03-fetch-loaded@tablet@en` — Twelve repositories fetched (1443 ms)
- ❌ `m03-fetch-loaded@mobile@en` — Twelve repositories fetched (1393 ms)
- ✅ `m03-fetch-paged@desktop@en` — 103 repositories across two pages (1501 ms)
- ✅ `m03-fetch-empty@desktop@en` — Account with no repositories (1477 ms)
- ✅ `m03-error-notfound@desktop@en` — Unknown username (404) (1500 ms)
- ❌ `m03-error-notfound@mobile@en` — Unknown username (404) (1441 ms)
- ✅ `m03-error-ratelimit@desktop@en` — Anonymous rate limit hit (403) (1542 ms)
- ✅ `m03-error-unauthorized@desktop@en` — Bad credentials (401) (1500 ms)
- ✅ `m03-error-offline@desktop@en` — No network at all (1432 ms)
- ✅ `m03-error-server@desktop@en` — GitHub 502 (1485 ms)
- ✅ `m03-fetch-private@desktop@en` — Token present: private work appears (1451 ms)
- ✅ `m04-search@desktop@en` — Search filters the list (1501 ms)
- ❌ `m04-search@mobile@en` — Search filters the list (1417 ms)
- ❌ `m04-search-noresult@mobile@en` — Search with no matches (1416 ms)
- ✅ `m04-sort-name@desktop@en` — Sort by name (1447 ms)
- ✅ `m04-hide-forks@desktop@en` — Hide forks (1433 ms)
- ✅ `m04-select-all@desktop@en` — Select all / none (1851 ms)
- ✅ `m05-card-description@desktop@en` — Editing a chapter description inline (1449 ms)
- ✅ `m05-card-status-override@desktop@en` — Manual status override (1433 ms)
- ✅ `m05-card-notes@desktop@en` — Per-project notes (1467 ms)
- ✅ `m05-card-keyboard@desktop@en` — Keyboard focus inside a card (1451 ms)
- ✅ `m06-status-matrix@desktop@en` — Every detection rule in one list (1776 ms)
- ✅ `m07-settings-top@desktop@en` — Settings drawer — GitHub & token (1624 ms)
- ❌ `m07-settings-top@mobile@en` — Settings drawer — GitHub & token (1496 ms)
- ✅ `m07-settings-book-meta@desktop@en` — Settings drawer — book metadata (2038 ms)
- ✅ `m07-settings-data@desktop@en` — Settings drawer — data & privacy (1928 ms)
- ✅ `m07-settings-token-verify-fail@desktop@en` — Token verification fails (3059 ms)
- ✅ `m08-summary-chapters@desktop@en` — Summary with chapters selected (1871 ms)
- ✅ `m08-summary-chapters@tablet@en` — Summary with chapters selected (1816 ms)
- ✅ `m08-chapter-picker@desktop@en` — Chapter picker open (1580 ms)
- ❌ `m08-chapter-picker@mobile@en` — Chapter picker open (1462 ms)
- ✅ `m09-book-cover@desktop@en` — Live A4 preview — cover (3377 ms)
- ✅ `m09-book-contents@desktop@en` — Live A4 preview — contents (3410 ms)
- ✅ `m09-book-catalogue@desktop@en` — Live A4 preview — catalogue entries (3371 ms)
- ❌ `m09-book-bar@mobile@en` — Sticky action bar on mobile (1374 ms)
- ✅ `m10-print-emulate@desktop@en` — Print media: only the book survives (2860 ms)
- ✅ `m10-print-pdf@desktop@en` — A4 PDF of the composed book (3214 ms)
- ✅ `m11-export-menu@desktop@en` — Text export menu (1927 ms)
- ✅ `m11-export-toast@desktop@en` — Export confirmed by toast (2448 ms)
- ✅ `m12-support-modal@desktop@en` — Support modal (1668 ms)
- ❌ `m12-support-modal@mobile@en` — Support modal (1543 ms)
- ✅ `m12-support-qr@desktop@en` — Crypto tab with QR code (2089 ms)
- ✅ `m12-support-copy@desktop@en` — Copy address feedback (2634 ms)
- ✅ `m13-info-help@desktop@en` — Help modal (1537 ms)
- ✅ `m13-info-disclaimer@desktop@en` — Disclaimer modal (1479 ms)
- ✅ `m13-info-terms@desktop@en` — Terms modal (1520 ms)
- ✅ `m13-info-contact@desktop@de` — Contact modal — German (1495 ms)
- ✅ `m13-info-escape@desktop@en` — Escape closes the dialog (2047 ms)
- ✅ `m14-gate-blocked@desktop@en` — Ad-blocker gate (837 ms)
- ✅ `m14-gate-blocked@mobile@en` — Ad-blocker gate (817 ms)
- ✅ `m14-gate-recheck@desktop@en` — Gate cleared, app boots (2510 ms)
- ✅ `m15-a11y-skip-link@desktop@en` — Skip link on first Tab (1247 ms)
- ✅ `m15-a11y-modal-focus@desktop@en` — Focus trapped in the settings drawer (1837 ms)
- ❌ `m15-responsive-small@small@en` — Narrowest phone (320 px) (1622 ms)
- ✅ `m15-responsive-wide@wide@en` — Wide desktop (1920 px) (1490 ms)
- ✅ `m15-reduced-motion@desktop@en` — prefers-reduced-motion (1454 ms)
- ✅ `m16-persistence-reload@desktop@en` — Overrides survive a reload (3510 ms)
- ✅ `m16-legacy-migration@desktop@en` — State migrated from gitbooklet:* (1474 ms)
- ✅ `m16-import-settings@desktop@en` — Import a settings file (2568 ms)


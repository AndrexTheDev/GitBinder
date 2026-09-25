# GitBinder beta run — screenshot matrix

Captured 70 shots from http://127.0.0.1:4173 on 2026-09-25T10:02:03.515Z.
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
- **horizontal-overflow** — content is 424px wide in a 390px viewport — widest: <div.flex.shrink-0.items-center> right=408px; <span.flex.flex-col.items-end> right=408px; <span.text-2xs.text-ink-400> right=408px; <span.badge.badge--neutral> right=408px

### m03-fetch-loaded@mobile@en — Twelve repositories fetched
- **horizontal-overflow** — content is 425px wide in a 390px viewport — widest: <div.flex.shrink-0.items-center> right=432px; <span.flex.flex-col.items-end> right=432px; <span.text-2xs.text-ink-400> right=432px; <span.badge.badge--neutral> right=432px

### m03-error-notfound@mobile@en — Unknown username (404)
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m04-search@mobile@en — Search filters the list
- **horizontal-overflow** — content is 425px wide in a 390px viewport — widest: <div.flex.shrink-0.items-center> right=432px; <span.flex.flex-col.items-end> right=432px; <span.text-2xs.text-ink-400> right=432px; <span.badge.badge--neutral> right=432px

### m04-search-noresult@mobile@en — Search with no matches
- **horizontal-overflow** — content is 425px wide in a 390px viewport — widest: <div.flex.shrink-0.items-center> right=432px; <span.flex.flex-col.items-end> right=432px; <span.text-2xs.text-ink-400> right=432px; <span.badge.badge--neutral> right=432px

### m07-settings-top@mobile@en — Settings drawer — GitHub & token
- **horizontal-overflow** — content is 425px wide in a 390px viewport — widest: <span.badge.badge--neutral> right=505px; <div.flex.shrink-0.items-center> right=432px; <span.flex.flex-col.items-end> right=432px; <span.text-2xs.text-ink-400> right=432px

### m08-chapter-picker@mobile@en — Chapter picker open
- **horizontal-overflow** — content is 425px wide in a 390px viewport — widest: <div.flex.shrink-0.items-center> right=432px; <span.flex.flex-col.items-end> right=432px; <span.text-2xs.text-ink-400> right=432px; <span.badge.badge--neutral> right=432px

### m09-book-bar@mobile@en — Sticky action bar on mobile
- **horizontal-overflow** — content is 425px wide in a 390px viewport — widest: <div.flex.shrink-0.items-center> right=432px; <span.flex.flex-col.items-end> right=432px; <span.text-2xs.text-ink-400> right=432px; <span.badge.badge--neutral> right=432px

### m12-support-modal@mobile@en — Support modal
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m15-responsive-small@small@en — Narrowest phone (320 px)
- **horizontal-overflow** — content is 355px wide in a 320px viewport — widest: <div.flex.shrink-0.items-center> right=432px; <span.flex.flex-col.items-end> right=432px; <span.text-2xs.text-ink-400> right=432px; <span.badge.badge--neutral> right=432px
- **horizontal-overflow** — 35px of horizontal overflow

## All captures

- ✅ `m01-shell-empty@desktop@en` — First visit, nothing fetched yet (1006 ms)
- ✅ `m01-shell-empty@tablet@en` — First visit, nothing fetched yet (919 ms)
- ❌ `m01-shell-empty@mobile@en` — First visit, nothing fetched yet (882 ms)
- ✅ `m01-shell-empty-de@desktop@de` — First visit — German (947 ms)
- ❌ `m01-shell-empty-de@mobile@de` — First visit — German (869 ms)
- ✅ `m01-shell-scrolled@desktop@en` — Sticky navbar after scrolling (1416 ms)
- ✅ `m02-i18n-loaded-de@desktop@de` — Loaded library in German (1450 ms)
- ❌ `m02-i18n-loaded-de@mobile@de` — Loaded library in German (1385 ms)
- ✅ `m02-i18n-toggle@desktop@en` — Language toggle mid-session (1583 ms)
- ✅ `m03-fetch-loading@desktop@en` — Fetch in flight (skeletons) (204 ms)
- ✅ `m03-fetch-loaded@desktop@en` — Twelve repositories fetched (1457 ms)
- ✅ `m03-fetch-loaded@tablet@en` — Twelve repositories fetched (1423 ms)
- ❌ `m03-fetch-loaded@mobile@en` — Twelve repositories fetched (1381 ms)
- ✅ `m03-fetch-paged@desktop@en` — 103 repositories across two pages (1496 ms)
- ✅ `m03-fetch-empty@desktop@en` — Account with no repositories (1444 ms)
- ✅ `m03-error-notfound@desktop@en` — Unknown username (404) (1482 ms)
- ❌ `m03-error-notfound@mobile@en` — Unknown username (404) (1423 ms)
- ✅ `m03-error-ratelimit@desktop@en` — Anonymous rate limit hit (403) (1493 ms)
- ✅ `m03-error-unauthorized@desktop@en` — Bad credentials (401) (1482 ms)
- ✅ `m03-error-offline@desktop@en` — No network at all (1433 ms)
- ✅ `m03-error-server@desktop@en` — GitHub 502 (1483 ms)
- ✅ `m03-fetch-private@desktop@en` — Token present: private work appears (1452 ms)
- ✅ `m04-search@desktop@en` — Search filters the list (1521 ms)
- ❌ `m04-search@mobile@en` — Search filters the list (1420 ms)
- ❌ `m04-search-noresult@mobile@en` — Search with no matches (1398 ms)
- ✅ `m04-sort-name@desktop@en` — Sort by name (1445 ms)
- ✅ `m04-hide-forks@desktop@en` — Hide forks (1451 ms)
- ✅ `m04-select-all@desktop@en` — Select all / none (1860 ms)
- ✅ `m05-card-description@desktop@en` — Editing a chapter description inline (1438 ms)
- ✅ `m05-card-status-override@desktop@en` — Manual status override (1449 ms)
- ✅ `m05-card-notes@desktop@en` — Per-project notes (1447 ms)
- ✅ `m05-card-keyboard@desktop@en` — Keyboard focus inside a card (1468 ms)
- ✅ `m06-status-matrix@desktop@en` — Every detection rule in one list (1732 ms)
- ✅ `m07-settings-top@desktop@en` — Settings drawer — GitHub & token (1623 ms)
- ❌ `m07-settings-top@mobile@en` — Settings drawer — GitHub & token (1478 ms)
- ✅ `m07-settings-book-meta@desktop@en` — Settings drawer — book metadata (2039 ms)
- ✅ `m07-settings-data@desktop@en` — Settings drawer — data & privacy (1985 ms)
- ✅ `m07-settings-token-verify-fail@desktop@en` — Token verification fails (3032 ms)
- ✅ `m08-summary-chapters@desktop@en` — Summary with chapters selected (1820 ms)
- ✅ `m08-summary-chapters@tablet@en` — Summary with chapters selected (1785 ms)
- ✅ `m08-chapter-picker@desktop@en` — Chapter picker open (1545 ms)
- ❌ `m08-chapter-picker@mobile@en` — Chapter picker open (1451 ms)
- ✅ `m09-book-cover@desktop@en` — Live A4 preview — cover (3381 ms)
- ✅ `m09-book-contents@desktop@en` — Live A4 preview — contents (3362 ms)
- ✅ `m09-book-catalogue@desktop@en` — Live A4 preview — catalogue entries (3310 ms)
- ❌ `m09-book-bar@mobile@en` — Sticky action bar on mobile (1358 ms)
- ✅ `m10-print-emulate@desktop@en` — Print media: only the book survives (2825 ms)
- ✅ `m10-print-pdf@desktop@en` — A4 PDF of the composed book (3071 ms)
- ✅ `m11-export-menu@desktop@en` — Text export menu (1886 ms)
- ✅ `m11-export-toast@desktop@en` — Export confirmed by toast (2399 ms)
- ✅ `m12-support-modal@desktop@en` — Support modal (1667 ms)
- ❌ `m12-support-modal@mobile@en` — Support modal (1561 ms)
- ✅ `m12-support-qr@desktop@en` — Crypto tab with QR code (2063 ms)
- ✅ `m12-support-copy@desktop@en` — Copy address feedback (2629 ms)
- ✅ `m13-info-help@desktop@en` — Help modal (1491 ms)
- ✅ `m13-info-disclaimer@desktop@en` — Disclaimer modal (1472 ms)
- ✅ `m13-info-terms@desktop@en` — Terms modal (1515 ms)
- ✅ `m13-info-contact@desktop@de` — Contact modal — German (1500 ms)
- ✅ `m13-info-escape@desktop@en` — Escape closes the dialog (2042 ms)
- ✅ `m14-gate-blocked@desktop@en` — Ad-blocker gate (829 ms)
- ✅ `m14-gate-blocked@mobile@en` — Ad-blocker gate (804 ms)
- ✅ `m14-gate-recheck@desktop@en` — Gate cleared, app boots (2504 ms)
- ✅ `m15-a11y-skip-link@desktop@en` — Skip link on first Tab (1216 ms)
- ✅ `m15-a11y-modal-focus@desktop@en` — Focus trapped in the settings drawer (1803 ms)
- ❌ `m15-responsive-small@small@en` — Narrowest phone (320 px) (1583 ms)
- ✅ `m15-responsive-wide@wide@en` — Wide desktop (1920 px) (1489 ms)
- ✅ `m15-reduced-motion@desktop@en` — prefers-reduced-motion (1442 ms)
- ✅ `m16-persistence-reload@desktop@en` — Overrides survive a reload (3527 ms)
- ✅ `m16-legacy-migration@desktop@en` — State migrated from gitbooklet:* (1455 ms)
- ✅ `m16-import-settings@desktop@en` — Import a settings file (2563 ms)


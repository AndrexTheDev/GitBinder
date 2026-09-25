# GitBinder beta run — screenshot matrix

Captured 70 shots from http://127.0.0.1:4173 on 2026-09-25T10:12:37.968Z.
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
- **horizontal-overflow** — content is 424px wide in a 390px viewport — widest: <div.flex.shrink-0.items-center.gap-2> w=373 right=408; <span.flex.flex-col.items-end.gap-0.5> w=145 right=408; <span.text-2xs.text-ink-400> w=145 right=408; <span.badge.badge--neutral> w=138 right=408

### m03-fetch-loaded@mobile@en — Twelve repositories fetched
- **horizontal-overflow** — content is 425px wide in a 390px viewport — widest: <div.flex.shrink-0.items-center.gap-2> w=397 right=432; <span.flex.flex-col.items-end.gap-0.5> w=151 right=432; <span.text-2xs.text-ink-400> w=151 right=432; <span.badge.badge--neutral> w=102 right=432

### m03-error-notfound@mobile@en — Unknown username (404)
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m04-search@mobile@en — Search filters the list
- **horizontal-overflow** — content is 425px wide in a 390px viewport — widest: <div.flex.shrink-0.items-center.gap-2> w=397 right=432; <span.flex.flex-col.items-end.gap-0.5> w=151 right=432; <span.text-2xs.text-ink-400> w=151 right=432; <span.badge.badge--neutral> w=102 right=432

### m04-search-noresult@mobile@en — Search with no matches
- **horizontal-overflow** — content is 425px wide in a 390px viewport — widest: <div.flex.shrink-0.items-center.gap-2> w=397 right=432; <span.flex.flex-col.items-end.gap-0.5> w=151 right=432; <span.text-2xs.text-ink-400> w=151 right=432; <span.badge.badge--neutral> w=102 right=432

### m07-settings-top@mobile@en — Settings drawer — GitHub & token
- **horizontal-overflow** — content is 425px wide in a 390px viewport — widest: <div.flex.shrink-0.items-center.gap-2> w=397 right=432; <span.badge.badge--neutral> w=346 right=505; <span.flex.flex-col.items-end.gap-0.5> w=151 right=432; <span.text-2xs.text-ink-400> w=151 right=432; <span.badge.badge--neutral> w=102 right=432

### m08-chapter-picker@mobile@en — Chapter picker open
- **horizontal-overflow** — content is 425px wide in a 390px viewport — widest: <div.flex.shrink-0.items-center.gap-2> w=397 right=432; <span.flex.flex-col.items-end.gap-0.5> w=151 right=432; <span.text-2xs.text-ink-400> w=151 right=432; <span.badge.badge--neutral> w=102 right=432

### m09-book-bar@mobile@en — Sticky action bar on mobile
- **horizontal-overflow** — content is 425px wide in a 390px viewport — widest: <div.flex.shrink-0.items-center.gap-2> w=397 right=432; <span.flex.flex-col.items-end.gap-0.5> w=151 right=432; <span.text-2xs.text-ink-400> w=151 right=432; <span.badge.badge--neutral> w=102 right=432

### m12-support-modal@mobile@en — Support modal
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m15-responsive-small@small@en — Narrowest phone (320 px)
- **horizontal-overflow** — content is 355px wide in a 320px viewport — widest: <div.flex.shrink-0.items-center.gap-2> w=397 right=432; <div.flex.shrink-0.items-center.gap-2> w=358 right=378; <span.flex.flex-col.items-end.gap-0.5> w=151 right=432; <span.text-2xs.text-ink-400> w=151 right=432; <span.badge.badge--neutral> w=102 right=432; <button.btn.btn-outline.book-bar__action> w=38 right=332
- **horizontal-overflow** — 35px of horizontal overflow

## All captures

- ✅ `m01-shell-empty@desktop@en` — First visit, nothing fetched yet (999 ms)
- ✅ `m01-shell-empty@tablet@en` — First visit, nothing fetched yet (904 ms)
- ❌ `m01-shell-empty@mobile@en` — First visit, nothing fetched yet (878 ms)
- ✅ `m01-shell-empty-de@desktop@de` — First visit — German (950 ms)
- ❌ `m01-shell-empty-de@mobile@de` — First visit — German (866 ms)
- ✅ `m01-shell-scrolled@desktop@en` — Sticky navbar after scrolling (1437 ms)
- ✅ `m02-i18n-loaded-de@desktop@de` — Loaded library in German (1465 ms)
- ❌ `m02-i18n-loaded-de@mobile@de` — Loaded library in German (1399 ms)
- ✅ `m02-i18n-toggle@desktop@en` — Language toggle mid-session (1633 ms)
- ✅ `m03-fetch-loading@desktop@en` — Fetch in flight (skeletons) (219 ms)
- ✅ `m03-fetch-loaded@desktop@en` — Twelve repositories fetched (1460 ms)
- ✅ `m03-fetch-loaded@tablet@en` — Twelve repositories fetched (1442 ms)
- ❌ `m03-fetch-loaded@mobile@en` — Twelve repositories fetched (1393 ms)
- ✅ `m03-fetch-paged@desktop@en` — 103 repositories across two pages (1482 ms)
- ✅ `m03-fetch-empty@desktop@en` — Account with no repositories (1480 ms)
- ✅ `m03-error-notfound@desktop@en` — Unknown username (404) (1517 ms)
- ❌ `m03-error-notfound@mobile@en` — Unknown username (404) (1435 ms)
- ✅ `m03-error-ratelimit@desktop@en` — Anonymous rate limit hit (403) (1480 ms)
- ✅ `m03-error-unauthorized@desktop@en` — Bad credentials (401) (1485 ms)
- ✅ `m03-error-offline@desktop@en` — No network at all (1465 ms)
- ✅ `m03-error-server@desktop@en` — GitHub 502 (1483 ms)
- ✅ `m03-fetch-private@desktop@en` — Token present: private work appears (1452 ms)
- ✅ `m04-search@desktop@en` — Search filters the list (1488 ms)
- ❌ `m04-search@mobile@en` — Search filters the list (1431 ms)
- ❌ `m04-search-noresult@mobile@en` — Search with no matches (1417 ms)
- ✅ `m04-sort-name@desktop@en` — Sort by name (1431 ms)
- ✅ `m04-hide-forks@desktop@en` — Hide forks (1436 ms)
- ✅ `m04-select-all@desktop@en` — Select all / none (1863 ms)
- ✅ `m05-card-description@desktop@en` — Editing a chapter description inline (1436 ms)
- ✅ `m05-card-status-override@desktop@en` — Manual status override (1447 ms)
- ✅ `m05-card-notes@desktop@en` — Per-project notes (1422 ms)
- ✅ `m05-card-keyboard@desktop@en` — Keyboard focus inside a card (1445 ms)
- ✅ `m06-status-matrix@desktop@en` — Every detection rule in one list (1774 ms)
- ✅ `m07-settings-top@desktop@en` — Settings drawer — GitHub & token (1633 ms)
- ❌ `m07-settings-top@mobile@en` — Settings drawer — GitHub & token (1493 ms)
- ✅ `m07-settings-book-meta@desktop@en` — Settings drawer — book metadata (2087 ms)
- ✅ `m07-settings-data@desktop@en` — Settings drawer — data & privacy (2041 ms)
- ✅ `m07-settings-token-verify-fail@desktop@en` — Token verification fails (3043 ms)
- ✅ `m08-summary-chapters@desktop@en` — Summary with chapters selected (1888 ms)
- ✅ `m08-summary-chapters@tablet@en` — Summary with chapters selected (1834 ms)
- ✅ `m08-chapter-picker@desktop@en` — Chapter picker open (1565 ms)
- ❌ `m08-chapter-picker@mobile@en` — Chapter picker open (1462 ms)
- ✅ `m09-book-cover@desktop@en` — Live A4 preview — cover (3380 ms)
- ✅ `m09-book-contents@desktop@en` — Live A4 preview — contents (3478 ms)
- ✅ `m09-book-catalogue@desktop@en` — Live A4 preview — catalogue entries (3396 ms)
- ❌ `m09-book-bar@mobile@en` — Sticky action bar on mobile (1376 ms)
- ✅ `m10-print-emulate@desktop@en` — Print media: only the book survives (2844 ms)
- ✅ `m10-print-pdf@desktop@en` — A4 PDF of the composed book (3174 ms)
- ✅ `m11-export-menu@desktop@en` — Text export menu (1930 ms)
- ✅ `m11-export-toast@desktop@en` — Export confirmed by toast (2431 ms)
- ✅ `m12-support-modal@desktop@en` — Support modal (1668 ms)
- ❌ `m12-support-modal@mobile@en` — Support modal (1546 ms)
- ✅ `m12-support-qr@desktop@en` — Crypto tab with QR code (2110 ms)
- ✅ `m12-support-copy@desktop@en` — Copy address feedback (2748 ms)
- ✅ `m13-info-help@desktop@en` — Help modal (1507 ms)
- ✅ `m13-info-disclaimer@desktop@en` — Disclaimer modal (1488 ms)
- ✅ `m13-info-terms@desktop@en` — Terms modal (1501 ms)
- ✅ `m13-info-contact@desktop@de` — Contact modal — German (1498 ms)
- ✅ `m13-info-escape@desktop@en` — Escape closes the dialog (2047 ms)
- ✅ `m14-gate-blocked@desktop@en` — Ad-blocker gate (838 ms)
- ✅ `m14-gate-blocked@mobile@en` — Ad-blocker gate (803 ms)
- ✅ `m14-gate-recheck@desktop@en` — Gate cleared, app boots (2505 ms)
- ✅ `m15-a11y-skip-link@desktop@en` — Skip link on first Tab (1268 ms)
- ✅ `m15-a11y-modal-focus@desktop@en` — Focus trapped in the settings drawer (1896 ms)
- ❌ `m15-responsive-small@small@en` — Narrowest phone (320 px) (1627 ms)
- ✅ `m15-responsive-wide@wide@en` — Wide desktop (1920 px) (1490 ms)
- ✅ `m15-reduced-motion@desktop@en` — prefers-reduced-motion (1460 ms)
- ✅ `m16-persistence-reload@desktop@en` — Overrides survive a reload (3556 ms)
- ✅ `m16-legacy-migration@desktop@en` — State migrated from gitbooklet:* (1453 ms)
- ✅ `m16-import-settings@desktop@en` — Import a settings file (2581 ms)


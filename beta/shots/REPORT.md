# GitBinder beta run — screenshot matrix

Captured 70 shots from http://127.0.0.1:4173 on 2026-09-25T10:31:31.494Z.
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
- **horizontal-overflow** — content is 425px wide in a 390px viewport — layer(s) whose removal shrinks it: #navbar-root 425→390

### m01-shell-empty-de@mobile@de — First visit — German
- **horizontal-overflow** — content is 424px wide in a 390px viewport — layer(s) whose removal shrinks it: #navbar-root 424→390

### m02-i18n-loaded-de@mobile@de — Loaded library in German
- **horizontal-overflow** — content is 424px wide in a 390px viewport — layer(s) whose removal shrinks it: #navbar-root 424→390

### m03-fetch-loaded@mobile@en — Twelve repositories fetched
- **horizontal-overflow** — content is 425px wide in a 390px viewport — layer(s) whose removal shrinks it: #navbar-root 425→390

### m03-error-notfound@mobile@en — Unknown username (404)
- **horizontal-overflow** — content is 425px wide in a 390px viewport — layer(s) whose removal shrinks it: #navbar-root 425→390

### m04-search@mobile@en — Search filters the list
- **horizontal-overflow** — content is 425px wide in a 390px viewport — layer(s) whose removal shrinks it: #navbar-root 425→390

### m04-search-noresult@mobile@en — Search with no matches
- **horizontal-overflow** — content is 425px wide in a 390px viewport — layer(s) whose removal shrinks it: #navbar-root 425→390

### m07-settings-top@mobile@en — Settings drawer — GitHub & token
- **horizontal-overflow** — content is 425px wide in a 390px viewport — widest: <div.drawer.animate-slide-in-right> w=390 right=414; <header.flex.items-start.justify-between.gap-3.border-b> w=389 right=414; <div.scroll-thin.flex-1.overflow-y-auto.px-5.py-4> w=389 right=414; <footer.items-center.justify-end.gap-2.border-t.border-paper-300> w=389 right=414; <section.space-y-4> w=349 right=394; <div.mb-3.flex.items-start.gap-2.5> w=349 right=394 — layer(s) whose removal shrinks it: #navbar-root 425→390

### m08-chapter-picker@mobile@en — Chapter picker open
- **horizontal-overflow** — content is 425px wide in a 390px viewport — layer(s) whose removal shrinks it: #navbar-root 425→390

### m09-book-bar@mobile@en — Sticky action bar on mobile
- **horizontal-overflow** — content is 425px wide in a 390px viewport — layer(s) whose removal shrinks it: #navbar-root 425→390

### m12-support-modal@mobile@en — Support modal
- **horizontal-overflow** — content is 425px wide in a 390px viewport — layer(s) whose removal shrinks it: #navbar-root 425→390

### m15-responsive-small@small@en — Narrowest phone (320 px)
- **horizontal-overflow** — content is 355px wide in a 320px viewport — widest: <div.flex.shrink-0.items-center.gap-2> w=358 right=378; <button.btn.btn-outline.book-bar__action> w=38 right=332; <button.btn.btn-accent.book-bar__action> w=38 right=378; <svg.> w=16 right=367; <path.> w=13 right=366; <path.> w=8 right=363 — layer(s) whose removal shrinks it: #navbar-root 355→320
- **horizontal-overflow** — 35px of horizontal overflow

## All captures

- ✅ `m01-shell-empty@desktop@en` — First visit, nothing fetched yet (1002 ms)
- ✅ `m01-shell-empty@tablet@en` — First visit, nothing fetched yet (919 ms)
- ❌ `m01-shell-empty@mobile@en` — First visit, nothing fetched yet (897 ms)
- ✅ `m01-shell-empty-de@desktop@de` — First visit — German (930 ms)
- ❌ `m01-shell-empty-de@mobile@de` — First visit — German (885 ms)
- ✅ `m01-shell-scrolled@desktop@en` — Sticky navbar after scrolling (1422 ms)
- ✅ `m02-i18n-loaded-de@desktop@de` — Loaded library in German (1482 ms)
- ❌ `m02-i18n-loaded-de@mobile@de` — Loaded library in German (1418 ms)
- ✅ `m02-i18n-toggle@desktop@en` — Language toggle mid-session (1633 ms)
- ✅ `m03-fetch-loading@desktop@en` — Fetch in flight (skeletons) (221 ms)
- ✅ `m03-fetch-loaded@desktop@en` — Twelve repositories fetched (1472 ms)
- ✅ `m03-fetch-loaded@tablet@en` — Twelve repositories fetched (1443 ms)
- ❌ `m03-fetch-loaded@mobile@en` — Twelve repositories fetched (1426 ms)
- ✅ `m03-fetch-paged@desktop@en` — 103 repositories across two pages (1514 ms)
- ✅ `m03-fetch-empty@desktop@en` — Account with no repositories (1464 ms)
- ✅ `m03-error-notfound@desktop@en` — Unknown username (404) (1497 ms)
- ❌ `m03-error-notfound@mobile@en` — Unknown username (404) (1438 ms)
- ✅ `m03-error-ratelimit@desktop@en` — Anonymous rate limit hit (403) (1493 ms)
- ✅ `m03-error-unauthorized@desktop@en` — Bad credentials (401) (1500 ms)
- ✅ `m03-error-offline@desktop@en` — No network at all (1456 ms)
- ✅ `m03-error-server@desktop@en` — GitHub 502 (1513 ms)
- ✅ `m03-fetch-private@desktop@en` — Token present: private work appears (1465 ms)
- ✅ `m04-search@desktop@en` — Search filters the list (1539 ms)
- ❌ `m04-search@mobile@en` — Search filters the list (1466 ms)
- ❌ `m04-search-noresult@mobile@en` — Search with no matches (1450 ms)
- ✅ `m04-sort-name@desktop@en` — Sort by name (1445 ms)
- ✅ `m04-hide-forks@desktop@en` — Hide forks (1450 ms)
- ✅ `m04-select-all@desktop@en` — Select all / none (1869 ms)
- ✅ `m05-card-description@desktop@en` — Editing a chapter description inline (1448 ms)
- ✅ `m05-card-status-override@desktop@en` — Manual status override (1482 ms)
- ✅ `m05-card-notes@desktop@en` — Per-project notes (1449 ms)
- ✅ `m05-card-keyboard@desktop@en` — Keyboard focus inside a card (1476 ms)
- ✅ `m06-status-matrix@desktop@en` — Every detection rule in one list (1790 ms)
- ✅ `m07-settings-top@desktop@en` — Settings drawer — GitHub & token (1702 ms)
- ❌ `m07-settings-top@mobile@en` — Settings drawer — GitHub & token (1595 ms)
- ✅ `m07-settings-book-meta@desktop@en` — Settings drawer — book metadata (2041 ms)
- ✅ `m07-settings-data@desktop@en` — Settings drawer — data & privacy (1987 ms)
- ✅ `m07-settings-token-verify-fail@desktop@en` — Token verification fails (3077 ms)
- ✅ `m08-summary-chapters@desktop@en` — Summary with chapters selected (1915 ms)
- ✅ `m08-summary-chapters@tablet@en` — Summary with chapters selected (1850 ms)
- ✅ `m08-chapter-picker@desktop@en` — Chapter picker open (1576 ms)
- ❌ `m08-chapter-picker@mobile@en` — Chapter picker open (1532 ms)
- ✅ `m09-book-cover@desktop@en` — Live A4 preview — cover (3374 ms)
- ✅ `m09-book-contents@desktop@en` — Live A4 preview — contents (3421 ms)
- ✅ `m09-book-catalogue@desktop@en` — Live A4 preview — catalogue entries (3387 ms)
- ❌ `m09-book-bar@mobile@en` — Sticky action bar on mobile (1449 ms)
- ✅ `m10-print-emulate@desktop@en` — Print media: only the book survives (2890 ms)
- ✅ `m10-print-pdf@desktop@en` — A4 PDF of the composed book (3228 ms)
- ✅ `m11-export-menu@desktop@en` — Text export menu (1946 ms)
- ✅ `m11-export-toast@desktop@en` — Export confirmed by toast (2463 ms)
- ✅ `m12-support-modal@desktop@en` — Support modal (1691 ms)
- ❌ `m12-support-modal@mobile@en` — Support modal (1610 ms)
- ✅ `m12-support-qr@desktop@en` — Crypto tab with QR code (2130 ms)
- ✅ `m12-support-copy@desktop@en` — Copy address feedback (2649 ms)
- ✅ `m13-info-help@desktop@en` — Help modal (1502 ms)
- ✅ `m13-info-disclaimer@desktop@en` — Disclaimer modal (1531 ms)
- ✅ `m13-info-terms@desktop@en` — Terms modal (1539 ms)
- ✅ `m13-info-contact@desktop@de` — Contact modal — German (1515 ms)
- ✅ `m13-info-escape@desktop@en` — Escape closes the dialog (2125 ms)
- ✅ `m14-gate-blocked@desktop@en` — Ad-blocker gate (841 ms)
- ✅ `m14-gate-blocked@mobile@en` — Ad-blocker gate (808 ms)
- ✅ `m14-gate-recheck@desktop@en` — Gate cleared, app boots (2519 ms)
- ✅ `m15-a11y-skip-link@desktop@en` — Skip link on first Tab (1248 ms)
- ✅ `m15-a11y-modal-focus@desktop@en` — Focus trapped in the settings drawer (1847 ms)
- ❌ `m15-responsive-small@small@en` — Narrowest phone (320 px) (1651 ms)
- ✅ `m15-responsive-wide@wide@en` — Wide desktop (1920 px) (1499 ms)
- ✅ `m15-reduced-motion@desktop@en` — prefers-reduced-motion (1471 ms)
- ✅ `m16-persistence-reload@desktop@en` — Overrides survive a reload (3574 ms)
- ✅ `m16-legacy-migration@desktop@en` — State migrated from gitbooklet:* (1478 ms)
- ✅ `m16-import-settings@desktop@en` — Import a settings file (2583 ms)


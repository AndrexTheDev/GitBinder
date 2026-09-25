# GitBinder beta run — screenshot matrix

Captured 70 shots from http://127.0.0.1:4173 on 2026-09-25T09:50:38.423Z.
**40 passed, 30 failed, 0 warning(s).**

| Module | Shots | Failed |
| --- | ---: | ---: |
| M01 | 6 | 2 |
| M02 | 3 | 2 |
| M03 | 13 | 11 |
| M04 | 6 | 2 |
| M05 | 4 | 0 |
| M06 | 1 | 1 |
| M07 | 5 | 2 |
| M08 | 4 | 2 |
| M09 | 4 | 1 |
| M10 | 2 | 0 |
| M11 | 2 | 0 |
| M12 | 4 | 1 |
| M13 | 5 | 0 |
| M14 | 3 | 3 |
| M15 | 5 | 2 |
| M16 | 3 | 1 |

## Failures

### m01-shell-empty@mobile@en — First visit, nothing fetched yet
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m01-shell-empty-de@mobile@de — First visit — German
- **horizontal-overflow** — content is 424px wide in a 390px viewport

### m02-i18n-loaded-de@desktop@de — Loaded library in German
- **wrong-count** — ".repo-card": expected 12, found 5

### m02-i18n-loaded-de@mobile@de — Loaded library in German
- **horizontal-overflow** — content is 441px wide in a 390px viewport
- **wrong-count** — ".repo-card": expected 12, found 5

### m03-fetch-loaded@tablet@en — Twelve repositories fetched
- **horizontal-overflow** — content is 828px wide in a 820px viewport
- **missing-selector** — ".repo-card[data-slug="octodemo/gitbinder"]" is not in the DOM
- **wrong-count** — ".repo-card": expected 12, found 5

### m03-fetch-loaded@mobile@en — Twelve repositories fetched
- **horizontal-overflow** — content is 440px wide in a 390px viewport
- **missing-selector** — ".repo-card[data-slug="octodemo/gitbinder"]" is not in the DOM
- **wrong-count** — ".repo-card": expected 12, found 5

### m03-fetch-paged@desktop@en — 103 repositories across two pages
- **wrong-count** — ".repo-card": expected 103, found 5

### m03-fetch-empty@desktop@en — Account with no repositories
- **wrong-count** — ".repo-card": expected 0, found 5

### m03-error-notfound@desktop@en — Unknown username (404)
- **console-error** — Failed to load resource: the server responded with a status of 404 (Not Found)

### m03-error-notfound@mobile@en — Unknown username (404)
- **horizontal-overflow** — content is 425px wide in a 390px viewport
- **console-error** — Failed to load resource: the server responded with a status of 404 (Not Found)

### m03-error-ratelimit@desktop@en — Anonymous rate limit hit (403)
- **console-error** — Failed to load resource: the server responded with a status of 403 (Forbidden)

### m03-error-unauthorized@desktop@en — Bad credentials (401)
- **console-error** — Failed to load resource: the server responded with a status of 401 (Unauthorized)

### m03-error-offline@desktop@en — No network at all
- **console-error** — Failed to load resource: net::ERR_FAILED

### m03-error-server@desktop@en — GitHub 502
- **console-error** — Failed to load resource: the server responded with a status of 502 (Bad Gateway)

### m03-fetch-private@desktop@en — Token present: private work appears
- **missing-selector** — ".repo-card[data-slug="octodemo/private-vault"]" is not in the DOM
- **wrong-count** — ".repo-card": expected 13, found 5

### m04-search@mobile@en — Search filters the list
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m04-search-noresult@mobile@en — Search with no matches
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m06-status-matrix@desktop@en — Every detection rule in one list
- **missing-selector** — ".repo-card[data-status="live"]" is not in the DOM
- **missing-selector** — ".repo-card[data-status="development"]" is not in the DOM

### m07-settings-top@mobile@en — Settings drawer — GitHub & token
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m07-settings-token-verify-fail@desktop@en — Token verification fails
- **console-error** — Failed to load resource: the server responded with a status of 401 (Unauthorized)
- **console-error** — Failed to load resource: the server responded with a status of 401 (Unauthorized)

### m08-summary-chapters@tablet@en — Summary with chapters selected
- **step-failed** — locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('[data-i18n="library.toolbar.selectAll"], [data-i18n-aria-label="library.toolbar.selectAll"]').first()
    - locator resolved to <span class="hidden xl:inline" data-i18n="library.toolbar.selectAll">Select all</span>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms


### m08-chapter-picker@mobile@en — Chapter picker open
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m09-book-bar@mobile@en — Sticky action bar on mobile
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m12-support-modal@mobile@en — Support modal
- **horizontal-overflow** — content is 425px wide in a 390px viewport

### m14-gate-blocked@desktop@en — Ad-blocker gate
- **missing-selector** — ".adblock-notice" is not in the DOM
- **missing-selector** — "#adblock-title" is not in the DOM
- **wrong-count** — "#navbar-root > *": expected 0, found 1
- **page-error** — Cannot read properties of null (reading 'append')

### m14-gate-blocked@mobile@en — Ad-blocker gate
- **horizontal-overflow** — content is 425px wide in a 390px viewport
- **missing-selector** — ".adblock-notice" is not in the DOM
- **missing-selector** — "#adblock-title" is not in the DOM
- **wrong-count** — "#navbar-root > *": expected 0, found 1
- **page-error** — Cannot read properties of null (reading 'append')

### m14-gate-recheck@desktop@en — Gate cleared, app boots
- **step-failed** — locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('.adblock-notice button.btn-accent').first()

- **page-error** — Cannot read properties of null (reading 'append')

### m15-responsive-small@small@en — Narrowest phone (320 px)
- **horizontal-overflow** — content is 370px wide in a 320px viewport
- **wrong-count** — ".repo-card": expected 12, found 5
- **horizontal-overflow** — 35px of horizontal overflow

### m15-responsive-wide@wide@en — Wide desktop (1920 px)
- **wrong-count** — ".repo-card": expected 12, found 5

### m16-legacy-migration@desktop@en — State migrated from gitbooklet:*
- **missing-selector** — ".repo-card[data-slug="octodemo/gitbinder"][data-status="live"]" is not in the DOM
- **wrong-count** — ".repo-card": expected 12, found 5

## All captures

- ✅ `m01-shell-empty@desktop@en` — First visit, nothing fetched yet (536 ms)
- ✅ `m01-shell-empty@tablet@en` — First visit, nothing fetched yet (469 ms)
- ❌ `m01-shell-empty@mobile@en` — First visit, nothing fetched yet (431 ms)
- ✅ `m01-shell-empty-de@desktop@de` — First visit — German (510 ms)
- ❌ `m01-shell-empty-de@mobile@de` — First visit — German (426 ms)
- ✅ `m01-shell-scrolled@desktop@en` — Sticky navbar after scrolling (873 ms)
- ❌ `m02-i18n-loaded-de@desktop@de` — Loaded library in German (594 ms)
- ❌ `m02-i18n-loaded-de@mobile@de` — Loaded library in German (485 ms)
- ✅ `m02-i18n-toggle@desktop@en` — Language toggle mid-session (1112 ms)
- ✅ `m03-fetch-loading@desktop@en` — Fetch in flight (skeletons) (202 ms)
- ✅ `m03-fetch-loaded@desktop@en` — Twelve repositories fetched (585 ms)
- ❌ `m03-fetch-loaded@tablet@en` — Twelve repositories fetched (525 ms)
- ❌ `m03-fetch-loaded@mobile@en` — Twelve repositories fetched (491 ms)
- ❌ `m03-fetch-paged@desktop@en` — 103 repositories across two pages (696 ms)
- ❌ `m03-fetch-empty@desktop@en` — Account with no repositories (542 ms)
- ❌ `m03-error-notfound@desktop@en` — Unknown username (404) (534 ms)
- ❌ `m03-error-notfound@mobile@en` — Unknown username (404) (458 ms)
- ❌ `m03-error-ratelimit@desktop@en` — Anonymous rate limit hit (403) (510 ms)
- ❌ `m03-error-unauthorized@desktop@en` — Bad credentials (401) (559 ms)
- ❌ `m03-error-offline@desktop@en` — No network at all (536 ms)
- ❌ `m03-error-server@desktop@en` — GitHub 502 (522 ms)
- ❌ `m03-fetch-private@desktop@en` — Token present: private work appears (574 ms)
- ✅ `m04-search@desktop@en` — Search filters the list (1040 ms)
- ❌ `m04-search@mobile@en` — Search filters the list (960 ms)
- ❌ `m04-search-noresult@mobile@en` — Search with no matches (948 ms)
- ✅ `m04-sort-name@desktop@en` — Sort by name (944 ms)
- ✅ `m04-hide-forks@desktop@en` — Hide forks (981 ms)
- ✅ `m04-select-all@desktop@en` — Select all / none (1368 ms)
- ✅ `m05-card-description@desktop@en` — Editing a chapter description inline (1033 ms)
- ✅ `m05-card-status-override@desktop@en` — Manual status override (1025 ms)
- ✅ `m05-card-notes@desktop@en` — Per-project notes (950 ms)
- ✅ `m05-card-keyboard@desktop@en` — Keyboard focus inside a card (790 ms)
- ❌ `m06-status-matrix@desktop@en` — Every detection rule in one list (904 ms)
- ✅ `m07-settings-top@desktop@en` — Settings drawer — GitHub & token (1211 ms)
- ❌ `m07-settings-top@mobile@en` — Settings drawer — GitHub & token (1025 ms)
- ✅ `m07-settings-book-meta@desktop@en` — Settings drawer — book metadata (1709 ms)
- ✅ `m07-settings-data@desktop@en` — Settings drawer — data & privacy (1496 ms)
- ❌ `m07-settings-token-verify-fail@desktop@en` — Token verification fails (2601 ms)
- ✅ `m08-summary-chapters@desktop@en` — Summary with chapters selected (1378 ms)
- ❌ `m08-summary-chapters@tablet@en` — Summary with chapters selected (30429 ms)
- ✅ `m08-chapter-picker@desktop@en` — Chapter picker open (1107 ms)
- ❌ `m08-chapter-picker@mobile@en` — Chapter picker open (1013 ms)
- ✅ `m09-book-cover@desktop@en` — Live A4 preview — cover (2885 ms)
- ✅ `m09-book-contents@desktop@en` — Live A4 preview — contents (2904 ms)
- ✅ `m09-book-catalogue@desktop@en` — Live A4 preview — catalogue entries (2832 ms)
- ❌ `m09-book-bar@mobile@en` — Sticky action bar on mobile (810 ms)
- ✅ `m10-print-emulate@desktop@en` — Print media: only the book survives (2411 ms)
- ✅ `m10-print-pdf@desktop@en` — A4 PDF of the composed book (2617 ms)
- ✅ `m11-export-menu@desktop@en` — Text export menu (1454 ms)
- ✅ `m11-export-toast@desktop@en` — Export confirmed by toast (1946 ms)
- ✅ `m12-support-modal@desktop@en` — Support modal (1225 ms)
- ❌ `m12-support-modal@mobile@en` — Support modal (1092 ms)
- ✅ `m12-support-qr@desktop@en` — Crypto tab with QR code (1622 ms)
- ✅ `m12-support-copy@desktop@en` — Copy address feedback (2182 ms)
- ✅ `m13-info-help@desktop@en` — Help modal (1027 ms)
- ✅ `m13-info-disclaimer@desktop@en` — Disclaimer modal (1037 ms)
- ✅ `m13-info-terms@desktop@en` — Terms modal (1034 ms)
- ✅ `m13-info-contact@desktop@de` — Contact modal — German (1029 ms)
- ✅ `m13-info-escape@desktop@en` — Escape closes the dialog (1582 ms)
- ❌ `m14-gate-blocked@desktop@en` — Ad-blocker gate (477 ms)
- ❌ `m14-gate-blocked@mobile@en` — Ad-blocker gate (418 ms)
- ❌ `m14-gate-recheck@desktop@en` — Gate cleared, app boots (30600 ms)
- ✅ `m15-a11y-skip-link@desktop@en` — Skip link on first Tab (798 ms)
- ✅ `m15-a11y-modal-focus@desktop@en` — Focus trapped in the settings drawer (1362 ms)
- ❌ `m15-responsive-small@small@en` — Narrowest phone (320 px) (703 ms)
- ❌ `m15-responsive-wide@wide@en` — Wide desktop (1920 px) (638 ms)
- ✅ `m15-reduced-motion@desktop@en` — prefers-reduced-motion (577 ms)
- ✅ `m16-persistence-reload@desktop@en` — Overrides survive a reload (3066 ms)
- ❌ `m16-legacy-migration@desktop@en` — State migrated from gitbooklet:* (578 ms)
- ✅ `m16-import-settings@desktop@en` — Import a settings file (2123 ms)


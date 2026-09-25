#!/usr/bin/env node
/**
 * GitBinder beta runner — drives a real browser through `beta/matrix.json`.
 *
 * Every shot does three things:
 *
 *   1. **Arranges** — a fresh browser context (viewport, locale, motion), a
 *      deterministic GitHub fixture at the network layer, and whatever
 *      localStorage the scenario needs.
 *   2. **Acts** — the `steps` list: real clicks, real typing, real key presses.
 *      Nothing pokes the store from the console; if a control is unreachable
 *      the way a visitor would reach it, that is a finding, not a workaround.
 *   3. **Asserts** — `expect` plus the checks that run on every shot regardless:
 *      page errors, console errors, failed requests, horizontal overflow,
 *      missing translations.
 *
 * The picture is the evidence; the assertions are the test. A screenshot that
 * looks right but was produced after a console error is reported as a failure.
 *
 * Usage
 * ────
 *   node beta/runner/shoot.mjs --dry-run            # plan only, no browser
 *   node beta/runner/shoot.mjs --base http://127.0.0.1:4173
 *   node beta/runner/shoot.mjs --only M09           # one module
 *   node beta/runner/shoot.mjs --only m12-support-qr --headed
 *
 * @module beta/runner/shoot
 */

import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeHandler, SCENARIO_IDS } from './fixture.js';
import enDict from '../../src/i18n/locales/en.js';
import deDict from '../../src/i18n/locales/de.js';

const here = dirname(fileURLToPath(import.meta.url));
const betaDir = resolve(here, '..');
const repoRoot = resolve(betaDir, '..');

/* -------------------------------------------------------------------------- *
 * Arguments
 * -------------------------------------------------------------------------- */

function parseArgs(argv) {
  const args = {
    base: 'http://127.0.0.1:4173',
    out: join(betaDir, 'shots'),
    only: null,
    dryRun: false,
    headed: false,
    timeout: 30_000,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--headed') args.headed = true;
    else if (arg === '--base') args.base = argv[++i];
    else if (arg === '--out') args.out = resolve(process.cwd(), argv[++i]);
    else if (arg === '--only') args.only = argv[++i];
    else if (arg === '--timeout') args.timeout = Number(argv[++i]);
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

const args = parseArgs(process.argv);
const matrix = JSON.parse(readFileSync(join(betaDir, 'matrix.json'), 'utf8'));

/* -------------------------------------------------------------------------- *
 * Plan expansion — one entry per capture
 * -------------------------------------------------------------------------- */

/** Expand `shots` into concrete captures (shot × viewport × locale). */
export function plan(shots = matrix.shots, filter = args.only) {
  const captures = [];
  for (const shot of shots) {
    if (filter && !matches(shot, filter)) continue;
    const viewports = shot.viewports?.length ? shot.viewports : [shot.viewport ?? 'desktop'];
    const langs = shot.langs?.length ? shot.langs : ['en'];
    for (const viewport of viewports) {
      if (!matrix.viewports[viewport]) throw new Error(`${shot.id}: unknown viewport "${viewport}"`);
      for (const lang of langs) {
        if (!matrix.locales[lang]) throw new Error(`${shot.id}: unknown locale "${lang}"`);
        captures.push({ shot, viewport, lang, name: `${shot.id}@${viewport}@${lang}` });
      }
    }
  }
  return captures;
}

function matches(shot, filter) {
  const needle = filter.toLowerCase();
  return (
    shot.id.toLowerCase().includes(needle) ||
    String(shot.module ?? '').toLowerCase() === needle ||
    String(shot.title ?? '').toLowerCase().includes(needle)
  );
}

/** Validate the matrix before spending any browser time on it. */
export function validateMatrix() {
  const problems = [];
  const ids = new Set();
  for (const shot of matrix.shots) {
    if (!shot.id) problems.push('a shot is missing an id');
    if (ids.has(shot.id)) problems.push(`duplicate shot id: ${shot.id}`);
    ids.add(shot.id);
    if (!shot.module) problems.push(`${shot.id}: no module`);
    if (shot.fixture && !SCENARIO_IDS.includes(shot.fixture)) {
      problems.push(`${shot.id}: unknown fixture "${shot.fixture}" (known: ${SCENARIO_IDS.join(', ')})`);
    }
    for (const viewport of shot.viewports ?? []) {
      if (!matrix.viewports[viewport]) problems.push(`${shot.id}: unknown viewport "${viewport}"`);
    }
    for (const lang of shot.langs ?? []) {
      if (!matrix.locales[lang]) problems.push(`${shot.id}: unknown locale "${lang}"`);
    }
  }
  return problems;
}

/* -------------------------------------------------------------------------- *
 * Selectors
 * -------------------------------------------------------------------------- */

/** Flatten a nested dictionary into `{"a.b.c": "Label"}`. */
function flatten(dict, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(dict ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else if (value && typeof value === 'object') flatten(value, path, out);
  }
  return out;
}

/**
 * Both dictionaries, flattened.
 *
 * A few controls carry no `data-i18n` hook — the token's "Verify" button, for
 * one. For those a shot names the control by its translation *key* and the
 * runner resolves it to the label of the locale being captured, which keeps the
 * matrix language-neutral without inventing test-only attributes in `src/`.
 */
const DICTS = { en: flatten(enDict), de: flatten(deDict) };

/** Locale of the capture currently running; set by `runCapture`. */
let activeLang = 'en';

/**
 * Resolve a step target to a Playwright locator.
 *
 * `key` is the interesting one: components carry `data-i18n="<key>"` on the
 * element that holds the label, so a shot can name a control by its
 * translation key and stay correct in both languages.
 */
function locatorFor(page, target) {
  if (typeof target === 'string') return page.locator(target).first();
  if (target.sel) return page.locator(target.sel).nth(target.nth ?? 0);
  if (target.key) {
    return page
      .locator(`[data-i18n="${target.key}"], [data-i18n-aria-label="${target.key}"]`)
      .first();
  }
  if (target.nameKey) {
    const name = DICTS[activeLang]?.[target.nameKey];
    if (!name) throw new Error(`no ${activeLang} label for "${target.nameKey}"`);
    return page.getByRole(target.role ?? 'button', { name, exact: true }).nth(target.nth ?? 0);
  }
  if (target.role) return page.getByRole(target.role, { name: target.name }).nth(target.nth ?? 0);
  throw new Error(`unsupported target: ${JSON.stringify(target)}`);
}

/**
 * A click target that resolves to a bare label (`<span data-i18n>`) is a poor
 * click surface: the span is `hidden` below certain breakpoints while its
 * `<button>` parent stays visible. Resolve the nearest interactive ancestor so
 * a shot behaves like a visitor's pointer, not like a query.
 *
 * @returns {Promise<import('playwright').ElementHandle | import('playwright').Locator>}
 */
async function clickLocator(page, target) {
  const base = locatorFor(page, target);
  const handle = await base.elementHandle({ timeout: args.timeout });
  if (!handle) return base;
  const clickable = await handle.evaluateHandle(
    (el) => el.closest('button, a, [role="button"], [role="tab"]') || el,
  );
  const element = clickable.asElement();
  await handle.dispose();
  return element ?? base;
}

/**
 * Give the app a beat after the last step so the keyed list reconciles and any
 * rAF-scheduled render lands. Without this, a count assertion can race the
 * first frame and read a half-mounted list.
 */
async function settle(page, shot) {
  if (shot.fixture) await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(450);
}

/** The app's boot splash must be gone before anything is measured. */
async function waitForBoot(page) {
  await page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 15_000 }).catch(() => {});
}

/* -------------------------------------------------------------------------- *
 * Seeding
 * -------------------------------------------------------------------------- */

const BAIT_CSS =
  '.adsbox,.ad-banner,.ad-placement,.advertisement,.sponsored-content,#ad-banner-slot,#adsense-bait{display:none!important}';

/**
 * Build the URL + init script for one capture.
 *
 * `?u=` / `?lang=` are the app's own deep links, so the app does the fetching
 * itself — the runner never calls `fetchRepos()` behind its back.
 */
function seedFor(capture) {
  const seed = capture.shot.seed ?? {};
  const params = new URLSearchParams();
  if (seed.username) params.set('u', seed.username);
  const lang = seed.lang ?? (capture.lang !== 'en' ? capture.lang : null);
  if (lang) params.set('lang', lang);
  const url = `${args.base}/${params.size ? `?${params}` : ''}`;

  /** Persisted settings envelope — `src/state/index.js` writes the same shape. */
  const state = seed.state ?? null;
  if (seed.username && !state) {
    // nothing: the deep link covers it
  }
  const bookTitle = seed.bookTitle ?? null;
  const author = seed.author ?? null;
  const token = seed.token ?? '';

  const envelope =
    state || bookTitle || author || token
      ? {
          version: 1,
          data: {
            ...(state ?? {}),
            ...(seed.username ? { githubUsername: seed.username } : {}),
            ...(bookTitle ? { customBookTitle: bookTitle } : {}),
            ...(author ? { authorName: author } : {}),
            ...(token ? { personalAccessToken: token } : {}),
          },
        }
      : null;

  return {
    url,
    envelope,
    legacy: seed.legacy ?? null,
    blockBait: Boolean(seed.blockBait),
    reducedMotion: seed.reducedMotion ?? 'no-preference',
    withToken: Boolean(token),
  };
}

/* -------------------------------------------------------------------------- *
 * Steps
 * -------------------------------------------------------------------------- */

async function runStep(page, step, capture) {
  if (step.wait) return page.waitForTimeout(step.wait);
  if (step.click) return (await clickLocator(page, step.click)).click({ timeout: args.timeout });
  if (step.fill) return locatorFor(page, step.fill).fill(step.value ?? '');
  if (step.select) return locatorFor(page, step.select).selectOption(step.value);
  if (step.check) return locatorFor(page, step.check).check();
  if (step.uncheck) return locatorFor(page, step.uncheck).uncheck();
  if (step.focus) return locatorFor(page, step.focus).focus();
  if (step.hover) return locatorFor(page, step.hover).hover();
  if (step.press) return page.keyboard.press(step.press);

  if (step.scroll) {
    const target = step.scroll;
    if (typeof target === 'object' && 'y' in target) {
      return page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), target.y);
    }
    if (typeof target === 'object' && target.key) {
      return locatorFor(page, { key: target.key }).scrollIntoViewIfNeeded();
    }
    return locatorFor(page, target).scrollIntoViewIfNeeded();
  }

  if (step.print) return page.emulateMedia({ media: 'print' });
  if (step.screen) return page.emulateMedia({ media: 'screen' });
  if (step.reload) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    return waitForBoot(page);
  }
  if (step.unblockBait) {
    return page.evaluate(() => {
      document.querySelector('style[data-beta-bait]')?.remove();
    });
  }
  if (step.importFile) {
    /**
     * `utils/file.js#pickFiles()` builds a throwaway `<input type="file">`,
     * appends it, clicks it and removes it again — so there is no stable element
     * to hand to `setInputFiles()`. Playwright sees the click as a file chooser
     * instead, which is also closer to what a visitor does.
     */
    const name = step.importFile.name ?? 'gitbinder-settings.json';
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: args.timeout }),
      locatorFor(page, step.importFile.trigger).click(),
    ]);
    return chooser.setFiles({
      name,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(step.importFile.content), 'utf8'),
    });
  }
  if (step.shot) {
    // Intermediate capture: `<name>--<suffix>@viewport@lang.png`
    pendingExtraShots.push({ suffix: step.shot });
    return undefined;
  }
  throw new Error(`unsupported step: ${JSON.stringify(step)}`);
}

/** Extra screenshots requested mid-scenario; consumed by the capture loop. */
let pendingExtraShots = [];

/* -------------------------------------------------------------------------- *
 * Checks
 * -------------------------------------------------------------------------- */

/** Run on every capture, whether or not the shot declares `expect`. */
async function universalChecks(page) {
  const findings = [];

  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const i18nNodes = [...document.querySelectorAll('[data-i18n]')];
    const leaks = i18nNodes
      .map((el) => ({ key: el.getAttribute('data-i18n'), text: (el.textContent ?? '').trim() }))
      .filter((entry) => !entry.text || entry.text === entry.key || /^\[?missing/i.test(entry.text));
    const nameless = [...document.querySelectorAll('button, [role="button"], a')]
      .filter((el) => {
        const label = (el.getAttribute('aria-label') || el.textContent || '').trim();
        return !label && !el.getAttribute('aria-labelledby');
      })
      .length;
    const altless = [...document.querySelectorAll('img')].filter((el) => !el.hasAttribute('alt')).length;

    /** Elements spilling past the right edge — actionable overflow evidence. */
    const wide =
      root.scrollWidth > window.innerWidth
        ? [...document.querySelectorAll('*')]
            .map((el) => {
              const rect = el.getBoundingClientRect();
              return { el, right: Math.round(rect.right), w: Math.round(rect.width) };
            })
            .filter((entry) => entry.right > window.innerWidth + 1 || entry.w > window.innerWidth + 1)
            .sort((a, b) => b.w - a.w)
            .slice(0, 6)
            .map((entry) => {
              const cls = (entry.el.getAttribute('class') || '').split(/\s+/).slice(0, 5).join('.');
              return `<${entry.el.tagName.toLowerCase()}.${cls}> w=${entry.w} right=${entry.right}`;
            })
        : [];

    return {
      scrollWidth: root.scrollWidth,
      innerWidth: window.innerWidth,
      leaks,
      nameless,
      altless,
      wide,
    };
  });

  if (metrics.scrollWidth > metrics.innerWidth + 1) {
    findings.push({
      severity: 'error',
      code: 'horizontal-overflow',
      message: `content is ${metrics.scrollWidth}px wide in a ${metrics.innerWidth}px viewport` +
        (metrics.wide.length ? ` — widest: ${metrics.wide.join('; ')}` : ''),
    });
  }
  for (const leak of metrics.leaks) {
    findings.push({
      severity: 'error',
      code: 'i18n-leak',
      message: `data-i18n="${leak.key}" rendered as "${leak.text || '(empty)'}"`,
    });
  }
  if (metrics.nameless) {
    findings.push({
      severity: 'warn',
      code: 'a11y-nameless-control',
      message: `${metrics.nameless} control(s) without an accessible name`,
    });
  }
  if (metrics.altless) {
    findings.push({
      severity: 'warn',
      code: 'a11y-image-without-alt',
      message: `${metrics.altless} image(s) without alt text`,
    });
  }
  return findings;
}

/** The shot's own `expect` block. */
async function expectChecks(page, expect) {
  const findings = [];
  if (!expect) return findings;

  for (const sel of expect.selectors ?? []) {
    const count = await page.locator(sel).count();
    if (count === 0) {
      findings.push({ severity: 'error', code: 'missing-selector', message: `"${sel}" is not in the DOM` });
    }
  }

  for (const [sel, wanted] of Object.entries(expect.count ?? {})) {
    const actual = await page.locator(sel).count();
    if (actual !== wanted) {
      findings.push({
        severity: 'error',
        code: 'wrong-count',
        message: `"${sel}": expected ${wanted}, found ${actual}`,
      });
    }
  }

  for (const rule of expect.text ?? []) {
    const text = (await page.locator(rule.sel).first().innerText().catch(() => '')) ?? '';
    const has = text.includes(rule.contains);
    if (rule.not ? has : !has) {
      findings.push({
        severity: 'error',
        code: 'text-mismatch',
        message: `"${rule.sel}" ${rule.not ? 'must not contain' : 'must contain'} "${rule.contains}"`,
      });
    }
  }

  for (const sel of expect.hiddenInPrint ?? []) {
    const visible = await page.locator(sel).first().isVisible().catch(() => false);
    if (visible) {
      findings.push({
        severity: 'error',
        code: 'visible-in-print',
        message: `"${sel}" survives print media — print.css does not hide it`,
      });
    }
  }

  if (expect.focused) {
    const ok = await page.evaluate(
      (sel) => document.activeElement?.matches?.(sel) === true,
      expect.focused,
    );
    if (!ok) {
      findings.push({ severity: 'error', code: 'focus-missing', message: `"${expect.focused}" is not focused` });
    }
  }

  if (expect.focusedInside) {
    const ok = await page.evaluate(
      (sel) => Boolean(document.activeElement?.closest?.(sel)),
      expect.focusedInside,
    );
    if (!ok) {
      findings.push({
        severity: 'error',
        code: 'focus-escaped',
        message: `focus left "${expect.focusedInside}" (active: ${await page.evaluate(
          () => document.activeElement?.outerHTML?.slice(0, 120) ?? 'none',
        )})`,
      });
    }
  }

  for (const [sel, wanted] of Object.entries(expect.inputValue ?? {})) {
    const actual = await page.locator(sel).first().inputValue().catch(() => null);
    if (actual !== wanted) {
      findings.push({
        severity: 'error',
        code: 'input-value',
        message: `"${sel}": expected "${wanted}", found "${actual}"`,
      });
    }
  }

  if (expect.htmlLang) {
    const actual = await page.evaluate(() => document.documentElement.lang);
    if (actual !== expect.htmlLang) {
      findings.push({
        severity: 'error',
        code: 'html-lang',
        message: `<html lang> is "${actual}", expected "${expect.htmlLang}"`,
      });
    }
  }

  if (expect.noScrollX) {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    if (overflow > 1) {
      findings.push({
        severity: 'error',
        code: 'horizontal-overflow',
        message: `${overflow}px of horizontal overflow`,
      });
    }
  }

  return findings;
}

/* -------------------------------------------------------------------------- *
 * One capture
 * -------------------------------------------------------------------------- */

async function runCapture(browser, capture) {
  const { shot } = capture;
  activeLang = capture.lang;
  const seed = seedFor(capture);
  const findings = [];
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const started = Date.now();

  const context = await browser.newContext({
    viewport: matrix.viewports[capture.viewport],
    locale: matrix.locales[capture.lang],
    deviceScaleFactor: 1,
    reducedMotion: seed.reducedMotion,
    permissions: ['clipboard-read', 'clipboard-write'],
  });

  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // Chromium logs every non-2xx response as a console error
    // ("Failed to load resource: … 404/403/502 …"). That is network noise, not
    // an application fault — the app handles those statuses in its own UI.
    if (/^Failed to load resource/i.test(text)) return;
    consoleErrors.push(text);
  });
  page.on('pageerror', (error) =>
    pageErrors.push(`${error?.message ?? error}\n${(error?.stack ?? '').split('\n').slice(1, 6).join('\n')}`),
  );
  page.on('requestfailed', (request) => {
    // The fixture aborts api.github.com on purpose for the offline scenario.
    if (request.url().includes('api.github.com')) return;
    failedRequests.push(`${request.url()} (${request.failure()?.errorText ?? 'failed'})`);
  });

  if (shot.fixture) {
    await context.route('**://api.github.com/**', routeHandler(shot.fixture, seed.withToken));
  }

  await page.addInitScript(
    ({ envelope, legacy, blockBait, baitCss }) => {
      if (blockBait) {
        // On document_start neither <head> nor <html> is guaranteed to exist,
        // so wait for the head to appear. The baits are only mounted by the app
        // during its module evaluation (after parse), and detection settles
        // ~220 ms later — so a style inserted at DOMContentLoaded still wins.
        const addStyle = () => {
          const style = document.createElement('style');
          style.dataset.betaBait = 'true';
          style.textContent = baitCss;
          document.head.append(style);
        };
        if (document.head) addStyle();
        else document.addEventListener('DOMContentLoaded', addStyle);
      }
      if (envelope) window.localStorage.setItem('gitbinder:state', JSON.stringify(envelope));
      if (legacy) window.localStorage.setItem('gitbooklet:state', JSON.stringify({ version: 1, data: legacy }));
    },
    { envelope: seed.envelope, legacy: seed.legacy, blockBait: seed.blockBait, baitCss: BAIT_CSS },
  );

  const files = [];

  try {
    await page.goto(seed.url, { waitUntil: 'domcontentloaded', timeout: args.timeout });
    if (shot.capture !== 'immediate') await waitForBoot(page);

    pendingExtraShots = [];
    for (const step of shot.steps ?? []) {
      await runStep(page, step, capture);
      const extra = pendingExtraShots.pop();
      if (extra) {
        const name = `${shot.id}--${extra.suffix}@${capture.viewport}@${capture.lang}.png`;
        await page.screenshot({ path: join(args.out, name), fullPage: Boolean(shot.fullPage) });
        files.push(name);
      }
    }

    if (shot.capture !== 'immediate') await settle(page, shot);

    findings.push(...(await universalChecks(page)));
    findings.push(...(await expectChecks(page, shot.expect)));

    if (shot.pdf) {
      const name = `${capture.name}.pdf`;
      await page.emulateMedia({ media: 'print' });
      await page.pdf({
        path: join(args.out, name),
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      });
      files.push(name);
    } else {
      const name = `${capture.name}.png`;
      await page.screenshot({ path: join(args.out, name), fullPage: Boolean(shot.fullPage) });
      files.push(name);
    }
  } catch (error) {
    findings.push({ severity: 'error', code: 'step-failed', message: String(error?.message ?? error) });
    const name = `${capture.name}--FAILED.png`;
    await page.screenshot({ path: join(args.out, name), fullPage: false }).catch(() => {});
    files.push(name);
  }

  for (const message of consoleErrors) {
    findings.push({ severity: 'error', code: 'console-error', message });
  }
  for (const message of pageErrors) {
    findings.push({ severity: 'error', code: 'page-error', message });
  }
  for (const url of failedRequests) {
    findings.push({ severity: 'error', code: 'failed-request', message: url });
  }

  await context.close();

  return {
    id: shot.id,
    module: shot.module,
    title: shot.title,
    capture: capture.name,
    viewport: capture.viewport,
    lang: capture.lang,
    fixture: shot.fixture ?? null,
    files,
    ms: Date.now() - started,
    findings,
    status: findings.some((finding) => finding.severity === 'error') ? 'fail' : 'pass',
  };
}

/* -------------------------------------------------------------------------- *
 * Report
 * -------------------------------------------------------------------------- */

function writeReport(results) {
  const failures = results.filter((result) => result.status === 'fail');
  const warns = results.flatMap((result) =>
    result.findings.filter((finding) => finding.severity === 'warn').map((finding) => ({ ...finding, capture: result.capture })),
  );

  const byModule = new Map();
  for (const result of results) {
    const bucket = byModule.get(result.module) ?? { total: 0, fail: 0 };
    bucket.total += 1;
    if (result.status === 'fail') bucket.fail += 1;
    byModule.set(result.module, bucket);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    base: args.base,
    total: results.length,
    passed: results.length - failures.length,
    failed: failures.length,
    warnings: warns.length,
    byModule: [...byModule.entries()].map(([module, counts]) => ({ module, ...counts })),
    results,
  };
  writeFileSync(join(args.out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    '# GitBinder beta run — screenshot matrix',
    '',
    `Captured ${results.length} shots from ${args.base} on ${report.generatedAt}.`,
    `**${report.passed} passed, ${report.failed} failed, ${warns.length} warning(s).**`,
    '',
    '| Module | Shots | Failed |',
    '| --- | ---: | ---: |',
    ...report.byModule.map((row) => `| ${row.module} | ${row.total} | ${row.fail} |`),
    '',
  ];

  if (failures.length) {
    lines.push('## Failures', '');
    for (const result of failures) {
      lines.push(`### ${result.capture} — ${result.title}`);
      for (const finding of result.findings.filter((entry) => entry.severity === 'error')) {
        lines.push(`- **${finding.code}** — ${finding.message}`);
      }
      lines.push('');
    }
  }

  if (warns.length) {
    lines.push('## Warnings', '');
    for (const warn of warns) lines.push(`- \`${warn.capture}\` **${warn.code}** — ${warn.message}`);
    lines.push('');
  }

  lines.push('## All captures', '');
  for (const result of results) {
    lines.push(
      `- ${result.status === 'pass' ? '✅' : '❌'} \`${result.capture}\` — ${result.title} (${result.ms} ms)`,
    );
  }
  lines.push('');

  writeFileSync(join(args.out, 'REPORT.md'), `${lines.join('\n')}\n`);
  return report;
}

/* -------------------------------------------------------------------------- *
 * Main
 * -------------------------------------------------------------------------- */

async function main() {
  const problems = validateMatrix();
  if (problems.length) {
    for (const problem of problems) console.error(`✖ ${problem}`);
    process.exit(2);
  }

  const captures = plan();
  if (!captures.length) {
    console.error(`no shots match --only ${args.only}`);
    process.exit(2);
  }

  if (args.dryRun) {
    console.log(`${captures.length} captures from ${matrix.shots.length} shots:`);
    for (const capture of captures) {
      const shot = capture.shot;
      console.log(
        `  ${capture.name.padEnd(48)} ${shot.module}  fixture=${shot.fixture ?? 'none'}` +
          `  steps=${shot.steps?.length ?? 0}  ${shot.pdf ? '[pdf]' : ''}`,
      );
    }
    return;
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error(
      'playwright is not installed here.\n' +
        '  npm i --no-save playwright@1.63.0\n' +
        '  npx playwright install chromium\n' +
        'Then: npm run build && npm run preview, and point --base at it.',
    );
    process.exit(3);
  }

  rmSync(args.out, { recursive: true, force: true });
  mkdirSync(args.out, { recursive: true });

  const browser = await chromium.launch({
    headless: !args.headed,
    args: ['--force-color-profile=srgb', '--font-render-hinting=none'],
  });

  const results = [];
  for (const [index, capture] of captures.entries()) {
    process.stdout.write(`[${index + 1}/${captures.length}] ${capture.name} … `);
    const result = await runCapture(browser, capture);
    results.push(result);
    const marks = result.findings.length
      ? result.findings.map((finding) => finding.code).join(', ')
      : 'clean';
    console.log(`${result.status.toUpperCase()} (${result.ms} ms) ${marks === 'clean' ? '' : marks}`);
  }

  await browser.close();
  const report = writeReport(results);

  console.log(
    `\n${report.passed}/${report.total} captures passed, ${report.failed} failed, ${report.warnings} warning(s).`,
  );
  console.log(`report: ${join(args.out, 'report.json')}`);
  console.log(`summary: ${join(args.out, 'REPORT.md')}`);

  if (report.failed) process.exit(1);
}

// Only run when executed directly, so `selfcheck.mjs` can import plan().
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

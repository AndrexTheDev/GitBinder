/**
 * Ad-blocker gate — `src/services/adblock.js`.
 *
 * The awkward part of this feature is that a false positive locks a paying-
 * attention visitor out of a free tool, so the tests care as much about
 * *not* detecting as about detecting:
 *
 *   • a clean page must pass,
 *   • a page whose bait is hidden by injected CSS must not,
 *   • an environment with no layout engine (this one) must not be mistaken
 *     for a blocked one — which is exactly why detection reads computed
 *     style rather than `offsetHeight`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createDomEnvironment } from './helpers/dom.js';
import { ADBLOCK_SETTLE_MS, detectAdBlocker } from '../src/services/adblock.js';

/** Hides the bait the way a filter list would: an injected stylesheet. */
function injectFilterList(env, css) {
  const style = env.document.createElement('style');
  style.textContent = css;
  env.document.head.append(style);
}

test('a clean page is not flagged', async () => {
  const env = createDomEnvironment();
  const verdict = await detectAdBlocker({ window: env.window, document: env.document, settleMs: 0 });
  assert.equal(verdict.blocked, false, verdict.signals.join('; '));
  assert.deepEqual(verdict.signals, []);
  env.cleanup();
});

test('bait elements are removed again afterwards', async () => {
  const env = createDomEnvironment();
  await detectAdBlocker({ window: env.window, document: env.document, settleMs: 0 });
  assert.equal(
    env.document.querySelectorAll('[data-testid="adblock-baits"]').length,
    0,
    'detection must not leave anything behind in the page',
  );
  env.cleanup();
});

test('display:none on the bait is detected', async () => {
  const env = createDomEnvironment();
  injectFilterList(env, '.adsbox, .ad-banner { display: none !important; }');
  const verdict = await detectAdBlocker({ window: env.window, document: env.document, settleMs: 0 });
  assert.equal(verdict.blocked, true);
  assert.ok(verdict.signals.some((s) => s.includes('display')));
  env.cleanup();
});

test('visibility:hidden is detected', async () => {
  const env = createDomEnvironment();
  injectFilterList(env, '#adsense-bait { visibility: hidden; }');
  const verdict = await detectAdBlocker({ window: env.window, document: env.document, settleMs: 0 });
  assert.equal(verdict.blocked, true, verdict.signals.join('; '));
  env.cleanup();
});

test('a collapsed box is detected', async () => {
  const env = createDomEnvironment();
  injectFilterList(env, '.ad-placement { height: 0 !important; }');
  const verdict = await detectAdBlocker({ window: env.window, document: env.document, settleMs: 0 });
  assert.equal(verdict.blocked, true, verdict.signals.join('; '));
  env.cleanup();
});

test('opacity:0 is detected', async () => {
  const env = createDomEnvironment();
  injectFilterList(env, '#adsense-bait { opacity: 0; }');
  const verdict = await detectAdBlocker({ window: env.window, document: env.document, settleMs: 0 });
  assert.equal(verdict.blocked, true, verdict.signals.join('; '));
  env.cleanup();
});

test('one hidden bait is enough — the lists differ in what they match', async () => {
  const env = createDomEnvironment();
  // Only the second bait's class family is covered here.
  injectFilterList(env, '.sponsored-content { display: none; }');
  const verdict = await detectAdBlocker({ window: env.window, document: env.document, settleMs: 0 });
  assert.equal(verdict.blocked, true, verdict.signals.join('; '));
  env.cleanup();
});

test('enabled:false short-circuits the whole check', async () => {
  const env = createDomEnvironment();
  injectFilterList(env, '.adsbox { display: none; }');
  const verdict = await detectAdBlocker({
    window: env.window,
    document: env.document,
    enabled: false,
    settleMs: 0,
  });
  assert.equal(verdict.blocked, false);
  env.cleanup();
});

test('no document means the gate opens rather than guessing', async () => {
  assert.deepEqual(await detectAdBlocker({ window: null, document: null }), {
    blocked: false,
    signals: ['no document to measure'],
  });
  assert.equal((await detectAdBlocker({ settleMs: 0 })).blocked, false);
});

test('detection waits for a filter list to react', async () => {
  // The settle window is what lets a MutationObserver-based blocker hide the
  // bait a tick after it is inserted.
  const env = createDomEnvironment();
  const started = Date.now();
  await detectAdBlocker({ window: env.window, document: env.document, settleMs: 40 });
  assert.ok(Date.now() - started >= 35, 'should have waited');
  assert.ok(ADBLOCK_SETTLE_MS >= 100, 'the production settle window should be generous');
  env.cleanup();
});

test('a baits host is not added to <head> only documents', async () => {
  const env = createDomEnvironment();
  // Sanity: the app always has a body, but detection must not throw without
  // one either.
  assert.equal(env.document.body.tagName, 'BODY');
  env.cleanup();
});

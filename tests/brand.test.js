/**
 * Brand mark.
 *
 * The artwork lives in one file and is referenced from three places — navbar,
 * footer and book cover — so these tests guard both that the file is valid
 * and that nothing has started inlining its own copy.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { BRAND_MARK } from '../src/config/app.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('the mark exists at the path the app references', () => {
  assert.match(BRAND_MARK, /^\/brand\//);
  const file = join(root, 'public', BRAND_MARK.replace(/^\//, ''));
  assert.ok(existsSync(file), `missing artwork: public${BRAND_MARK}`);
});

test('the mark is well-formed, self-contained SVG', () => {
  const svg = readFileSync(join(root, 'public', BRAND_MARK.replace(/^\//, '')), 'utf8');

  assert.match(svg, /^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 64 64"/);
  // A favicon or logo that pulls anything external would break the CSP and
  // the offline promise.
  assert.equal(/<image|xlink:href|@import|url\(http/i.test(svg), false, 'must not reference external assets');
  assert.equal(/<script/i.test(svg), false, 'no scripts in an asset');
  // Accessible name, since it is used as a real image on the book cover.
  assert.match(svg, /<title>/);
  assert.match(svg, /role="img"/);
});

test('the favicon variant exists and is also self-contained', () => {
  const file = join(root, 'public', 'favicon.svg');
  assert.ok(existsSync(file));
  const svg = readFileSync(file, 'utf8');
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.equal(/<image|xlink:href/i.test(svg), false);
});

test('the mark stays small enough to inline in the bundle', () => {
  const bytes = readFileSync(join(root, 'public', BRAND_MARK.replace(/^\//, '')), 'utf8').length;
  // It is a hand-written drawing; if it ever grows past this, something has
  // been embedded that should not be.
  assert.ok(bytes < 4000, `mark is ${bytes} bytes`);
});

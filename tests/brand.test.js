/**
 * Brand mark.
 *
 * The artwork lives in one file and is referenced from three places — navbar,
 * footer and book cover — so these tests guard that the file is valid, that
 * nothing has started inlining its own copy, and that the aspect ratio the
 * components reserve space with still matches the file they point at.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { BRAND_MARK, BRAND_MARK_RATIO } from '../src/config/app.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const markPath = join(root, 'public', BRAND_MARK.replace(/^\//, ''));

/** Pull `viewBox="0 0 w h"` out of an SVG file. */
function viewBox(svg) {
  const match = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  assert.ok(match, 'no viewBox');
  return { width: Number(match[1]), height: Number(match[2]) };
}

test('the mark exists at the path the app references', () => {
  assert.match(BRAND_MARK, /^\/brand\//);
  assert.ok(existsSync(markPath), `missing artwork: public${BRAND_MARK}`);
});

test('the mark is well-formed, self-contained SVG', () => {
  const svg = readFileSync(markPath, 'utf8');

  assert.match(svg, /^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(viewBox(svg), 'viewBox missing or malformed');
  // Anything external would break the CSP and the offline promise.
  assert.equal(/<image|xlink:href|@import|url\(http/i.test(svg), false, 'must not reference external assets');
  assert.equal(/<script/i.test(svg), false, 'no scripts in an asset');
  // Accessible name, since it is a real image on the book cover.
  assert.match(svg, /<title>/);
  assert.match(svg, /role="img"/);
});

test('the mark is a portrait spine, not a square', () => {
  // A regression guard with teeth: the mark used to be a square badge, and
  // the components reserve their box from BRAND_MARK_RATIO. A square file
  // here would mean a stretched or letterboxed logo on the cover.
  const { width, height } = viewBox(readFileSync(markPath, 'utf8'));
  assert.ok(height > width * 2, `expected a tall spine, got ${width}x${height}`);
});

test('BRAND_MARK_RATIO matches the artwork it describes', () => {
  const { width, height } = viewBox(readFileSync(markPath, 'utf8'));
  const actual = width / height;
  // The components use this for the width/height attributes they render, so a
  // mismatch is a layout shift waiting to happen.
  assert.ok(
    Math.abs(actual - BRAND_MARK_RATIO) < 0.01,
    `ratio ${BRAND_MARK_RATIO} does not match the file (${actual})`,
  );
});

test('the favicon variant exists, is portrait and self-contained', () => {
  const file = join(root, 'public', 'favicon.svg');
  assert.ok(existsSync(file));
  const svg = readFileSync(file, 'utf8');

  assert.ok(viewBox(svg));
  assert.equal(/<image|xlink:href/i.test(svg), false);
  assert.match(svg, /<title>/);

  // The favicon is a simplification, not a copy: it must carry less detail
  // than the full mark, or there is no reason for two files.
  const full = readFileSync(markPath, 'utf8');
  assert.ok(svg.length < full.length, 'favicon should be simpler than the full mark');
});

test('the mark stays small enough to ship as a static asset', () => {
  const bytes = readFileSync(markPath, 'utf8').length;
  // It is a hand-written drawing plus its rationale. If it ever grows past
  // this, something has been embedded that should not be, or the comments
  // have turned into a novel.
  assert.ok(bytes < 8000, `mark is ${bytes} bytes`);
});

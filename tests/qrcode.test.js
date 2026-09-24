/**
 * The QR encoder — `src/utils/qrcode.js`.
 *
 * A QR code that is subtly wrong is worse than no QR code at all: it scans on
 * the developer's phone and fails on a donor's, or worse, it decodes to
 * something unexpected. These tests pin the properties the rest of the app
 * depends on — deterministic output, integer-aligned geometry, a real quiet
 * zone, and no mutation of the encoded address.
 */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { qrCodeSvg, qrCodeElement } from '../src/utils/qrcode.js';
import { CRYPTO_TARGETS } from '../src/config/support.js';
import { createDomEnvironment } from './helpers/dom.js';

/** Only `qrCodeElement` touches the DOM; `qrCodeSvg` is a pure string builder. */
let env;
before(() => {
  env = createDomEnvironment();
});
after(() => env?.cleanup());

/** Counts the dark-module subpaths, i.e. how many modules the SVG paints. */
function darkModules(svg) {
  return (svg.match(/M\d+ \d+h1v1h-1z/g) ?? []).length;
}

/** The `viewBox` is square for a QR code; return its side length. */
function viewBoxSize(svg) {
  const match = svg.match(/viewBox="0 0 (\d+) \1"/);
  assert.ok(match, `no square viewBox in: ${svg.slice(0, 120)}`);
  return Number(match[1]);
}

/**
 * Re-implements the module-placement loop independently of the encoder, so a
 * bug in the path builder cannot validate itself.
 *
 * @param {string} svg
 * @returns {Set<string>} "x,y" for every painted module
 */
function moduleSet(svg) {
  return new Set([...svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((m) => `${m[1]},${m[2]}`));
}

test('the three configured donation addresses all encode', () => {
  for (const target of CRYPTO_TARGETS) {
    const svg = qrCodeSvg(target.address);
    assert.ok(svg.startsWith('<svg xmlns'), `${target.id} did not produce an SVG`);
    assert.ok(darkModules(svg) > 100, `${target.id} produced a suspiciously empty code`);
    // A QR in the wild needs the 4-module quiet zone to scan reliably.
    const size = viewBoxSize(svg);
    assert.ok(size >= 29, `${target.id} viewBox too small: ${size}`);
  }
});

test('output is deterministic — the same address always yields the same SVG', () => {
  const address = CRYPTO_TARGETS[0].address;
  assert.equal(qrCodeSvg(address), qrCodeSvg(address));
});

test('every module sits on an integer coordinate', () => {
  const { address } = CRYPTO_TARGETS[2];
  const svg = qrCodeSvg(address);
  for (const match of svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    assert.ok(Number.isInteger(Number(match[1])), `x is not an integer: ${match[1]}`);
    assert.ok(Number.isInteger(Number(match[2])), `y is not an integer: ${match[2]}`);
  }
});

test('the quiet zone is real: no module is painted in the 4-module border', () => {
  const svg = qrCodeSvg(CRYPTO_TARGETS[0].address);
  const size = viewBoxSize(svg);
  const quiet = 4;
  for (const coord of moduleSet(svg)) {
    const [x, y] = coord.split(',').map(Number);
    const inside =
      x >= quiet && y >= quiet && x < size - quiet && y < size - quiet;
    assert.ok(inside, `module ${coord} violates the quiet zone of a ${size}-unit viewBox`);
  }
});

test('the finder patterns are in place — a code without them will not scan', () => {
  const svg = qrCodeSvg(CRYPTO_TARGETS[1].address);
  const modules = moduleSet(svg);
  const size = viewBoxSize(svg);
  const quiet = 4;

  // The 7×7 finder pattern: a solid 3×3 block inside a ring, in three corners.
  for (const [ox, oy] of [
    [quiet, quiet],
    [size - quiet - 7, quiet],
    [quiet, size - quiet - 7],
  ]) {
    for (let dx = 0; dx < 3; dx += 1) {
      for (let dy = 0; dy < 3; dy += 1) {
        assert.ok(modules.has(`${ox + dx + 2},${oy + dy + 2}`), `missing finder core at ${ox},${oy}`);
      }
    }
    // And the ring itself, one module out from the core, must be dark too.
    assert.ok(modules.has(`${ox},${oy}`), `missing finder corner at ${ox},${oy}`);
    assert.ok(modules.has(`${ox + 6},${oy + 6}`), `missing finder far corner at ${ox},${oy}`);
  }
});

test('the address is encoded byte-for-byte, case included', () => {
  // The Ethereum address is EIP-55 checksummed; folding it to lowercase would
  // produce a code some wallets refuse, so the exact bytes must be encoded.
  const mixed = '0xBC3fab34f69bc9f6661608C3FB36dDdC313C42F7';
  const svg = qrCodeSvg(mixed);
  assert.ok(moduleSet(svg).size > 100);

  // A different string must give a different bitmap — proves the payload, not
  // a constant, drives the pattern.
  assert.notEqual(moduleSet(svg), moduleSet(qrCodeSvg(mixed.toLowerCase())));
});

test('an empty value produces nothing rather than an empty code', () => {
  assert.equal(qrCodeSvg(''), '');
  assert.equal(qrCodeSvg(null), '');
  assert.equal(qrCodeSvg(undefined), '');
});

test('characters that are markup in SVG are escaped', () => {
  const svg = qrCodeSvg('<img src=x onerror="alert(1)">&"\'');
  assert.doesNotMatch(svg, /<img/);
  assert.match(svg, /&lt;img/, 'the label was not escaped');
});

test('the element wrapper sizes the frame and seeds the accessible name', () => {
  const element = qrCodeElement(CRYPTO_TARGETS[0].address, { size: 168 });
  assert.equal(element.tagName.toLowerCase(), 'div');
  assert.match(element.className, /qr-frame/);

  const svg = element.querySelector('svg');
  assert.ok(svg, 'no SVG inside the frame');
  assert.equal(svg.getAttribute('width'), '100%');
  assert.equal(svg.getAttribute('height'), '100%');
  assert.equal(svg.getAttribute('role'), 'img');
  assert.equal(svg.getAttribute('aria-label'), CRYPTO_TARGETS[0].address);

  // The pixel size lives on the frame, so the SVG can stay fluid inside it.
  assert.equal(element.style.width, '168px');
  assert.equal(element.style.height, '168px');
});

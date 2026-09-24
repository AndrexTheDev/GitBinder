/**
 * QR code generation.
 *
 * Wallet addresses are long, mixed-case and easy to mistype, so the donation
 * modal shows each one as a scannable code. Two constraints shaped this module:
 *
 *   • **No network.** An image API (goqr.me, api.qrserver.com, …) would send
 *     every visitor's page — and the intent to donate — to a third party, and
 *     would break the moment GitBooklet is opened offline. GitBooklet's whole
 *     pitch is "runs entirely in your browser", so the encoding happens here.
 *   • **No canvas.** SVG scales cleanly on a retina screen, stays crisp, and
 *     costs one DOM node instead of a bitmap.
 *
 * `qrcode-generator` is ~11 kB, MIT licensed and dependency-free — the smallest
 * well-tested Reed–Solomon implementation on npm. Re-implementing QR encoding
 * by hand is the kind of code that looks fine and fails on the one address a
 * donor actually tries to scan.
 *
 * @module utils/qrcode
 */

import qrcode from 'qrcode-generator';
import { escapeHtml } from './format.js';

/**
 * Quiet zone around the symbol, in modules.
 *
 * The QR specification asks for four; two is what most generators ship and it
 * usually scans. We follow the spec — it costs nothing but a wider viewBox, and
 * a donation code that fails to scan is worth nothing.
 */
export const QUIET_ZONE = 4;

/**
 * Encode `text` as a QR code.
 *
 * @param {string} text                    the wallet address (or anything else)
 * @param {object} [options]
 * @param {number} [options.margin=4]      quiet zone in modules
 * @param {'L'|'M'|'Q'|'H'} [options.level='M'] error correction level
 * @param {string} [options.dark]          foreground colour
 * @param {string} [options.light]         background colour
 * @param {string} [options.label]         accessible name; defaults to the text
 * @returns {string} a standalone `<svg>` string, or `''` for empty input
 */
export function qrCodeSvg(text, options = {}) {
  const {
    margin = QUIET_ZONE,
    level = 'M',
    dark = '#161b25',
    light = '#fdfbf7',
    label = null,
  } = options;

  const value = String(text ?? '').trim();
  if (!value) return '';

  // typeNumber 0 = "pick the smallest version that fits".
  const qr = qrcode(0, level);
  // Force byte mode: wallet addresses are mixed-case, which the numeric and
  // alphanumeric modes cannot represent.
  qr.addData(value, 'Byte');
  qr.make();

  const count = qr.getModuleCount();
  const extent = count + margin * 2;

  /** @type {string[]} */
  const modules = [];
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (!qr.isDark(row, col)) continue;
      // One subpath per dark module, drawn on integer coordinates so
      // `shape-rendering: crispEdges` keeps every edge sharp at any zoom.
      modules.push(`M${col + margin} ${row + margin}h1v1h-1z`);
    }
  }

  const accessibleName = escapeHtml(label ?? value);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${extent} ${extent}" ` +
    `width="100%" height="100%" role="img" aria-label="${accessibleName}" ` +
    `shape-rendering="crispEdges" class="qr-svg">` +
    `<rect width="${extent}" height="${extent}" fill="${escapeHtml(light)}"/>` +
    `<path d="${modules.join('')}" fill="${escapeHtml(dark)}"/>` +
    `</svg>`
  );
}

/**
 * The same code, wrapped in a fixed-size frame for layout stability.
 *
 * @param {string} text
 * @param {object} [options]  see {@link qrCodeSvg}, plus:
 * @param {number} [options.size=168]  rendered size in px
 * @param {string} [options.class]     extra classes for the wrapper
 * @returns {HTMLElement}
 */
export function qrCodeElement(text, options = {}) {
  const { size = 168, class: className = '' } = options;
  const svg = qrCodeSvg(text, options);

  // The SVG is generated from booleans and integers only — no user text ever
  // reaches the markup beyond the escaped `aria-label` above.
  const frame = document.createElement('div');
  frame.className = ['qr-frame', className].filter(Boolean).join(' ');
  frame.style.width = `${size}px`;
  frame.style.height = `${size}px`;
  if (svg) frame.innerHTML = svg;
  return frame;
}

/**
 * The donation configuration — `src/config/support.js`.
 *
 * These addresses are the one piece of the app where a silent typo costs
 * somebody real money, so they are pinned exactly as specified and checked
 * against the shape rules that catch the mistakes people actually make.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CRYPTO_TARGETS,
  SUPPORT_LINKS,
  isWellFormedAddress,
  isPlaceholderAddress,
  auditSupportConfig,
} from '../src/config/support.js';

/** The addresses exactly as specified. */
const EXPECTED = Object.freeze({
  sol: '79KsqtJJdhKFJ9woxnYgtf3nq7HxQveafWBCtC3mxWi8',
  btc: 'bc1qeqzrlfg3edrydk4s0hecakc82gp26n5p7hkc7f',
  eth: '0xBC3fab34f69bc9f6661608C3FB36dDdC313C42F7',
});

test('exposes the three configured networks, in the specified order', () => {
  assert.deepEqual(
    CRYPTO_TARGETS.map((target) => target.id),
    ['sol', 'btc', 'eth'],
  );
  assert.deepEqual(
    CRYPTO_TARGETS.map((target) => target.ticker),
    ['SOL', 'BTC', 'ETH'],
  );
});

test('every address matches the one that was specified, character for character', () => {
  for (const target of CRYPTO_TARGETS) {
    assert.equal(target.address, EXPECTED[target.id], `${target.id} address drifted`);
  }
});

test('the Ethereum address keeps its EIP-55 mixed-case checksum', () => {
  const eth = CRYPTO_TARGETS.find((target) => target.id === 'eth');
  assert.notEqual(eth.address, eth.address.toLowerCase(), 'address was lowercased at some point');
  assert.match(eth.address, /^0x[a-fA-F0-9]{40}$/);
});

test('no placeholder address ships', () => {
  assert.deepEqual(auditSupportConfig(), [], 'a placeholder address would silently eat donations');
});

test('every target has an explorer template with an {address} token', () => {
  for (const target of CRYPTO_TARGETS) {
    assert.ok(target.explorer, `${target.id} has no explorer`);
    assert.match(target.explorer, /\{address\}/, `${target.id} explorer has no token`);
    assert.match(target.explorer, /^https:\/\//, `${target.id} explorer is not https`);
  }
});

test('the shape checks accept the real addresses', () => {
  for (const target of CRYPTO_TARGETS) {
    assert.equal(isWellFormedAddress(target), true, `${target.id} rejected`);
    assert.equal(isPlaceholderAddress(target), false, `${target.id} flagged as placeholder`);
  }
});

test('a truncated address is rejected where the length is fixed', () => {
  // One dropped character: still plausible-looking, catastrophically wrong.
  assert.equal(isWellFormedAddress({ id: 'eth', address: '0xBC3fab34f69bc9f6661608C3FB36dDdC313C42F' }), false);
  assert.equal(isWellFormedAddress({ id: 'btc', address: 'bc1qeqzrlfg3edrydk4s0hecakc82gp26n5p7hkc7' }), false);
});

test('a truncated Solana address is NOT catchable by shape alone', () => {
  // Documented deliberately, because it is the limit of a shape check: Solana
  // pubkeys are base58 of *variable* length (32–44), so dropping a character
  // yields another perfectly plausible address. This is exactly why the
  // "every address matches the one that was specified" test exists — the
  // pinning test, not the shape test, is what protects the Solana address.
  assert.equal(isWellFormedAddress({ id: 'sol', address: '79KsqtJJdhKFJ9woxnYgtf3nq7HxQveafWBCtC3mxWi' }), true);
  // Bits outside the base58 alphabet are still caught, of course.
  assert.equal(isWellFormedAddress({ id: 'sol', address: '79KsqtJJdhKFJ9woxnYgtf3nq7HxQveafWBCtC3mxW0' }), false);
});

test('an address from the wrong network is rejected', () => {
  // Pasting the Bitcoin address into the Ethereum slot is the classic slip.
  assert.equal(isWellFormedAddress({ id: 'eth', address: EXPECTED.btc }), false);
  assert.equal(isWellFormedAddress({ id: 'btc', address: EXPECTED.sol }), false);
  // Base58 is explicitly alphabet-restricted, so these characters are invalid.
  assert.equal(isWellFormedAddress({ id: 'sol', address: '0OIl+/notbase58atall' }), false);
});

test('literal placeholders are recognised, whatever their shape', () => {
  const placeholders = [
    { id: 'btc', address: 'bc1q_example_replace_me_now_please_ok' },
    { id: 'eth', address: '0x0000000000000000000000000000000000000000' },
    { id: 'sol', address: 'ReplaceMeSolanaAddress' },
    { id: 'sol', address: '   ' },
    { id: 'sol', address: '' },
    { id: 'sol', address: null },
  ];
  for (const candidate of placeholders) {
    assert.equal(isPlaceholderAddress(candidate), true, `not flagged: ${candidate.address}`);
  }
});

test('an unrecognised asset is not second-guessed', () => {
  // A future coin with no documented shape must not be treated as broken.
  assert.equal(isWellFormedAddress({ id: 'doge', address: 'D7Y55Xa9m3hTqZ8VvN2pL1kR4sW6yB0cE3' }), true);
});

test('the free support links all point at the owner on GitHub', () => {
  for (const link of SUPPORT_LINKS) {
    const url = new URL(link.href);
    assert.equal(url.protocol, 'https:', `${link.id} is not https`);
    assert.equal(url.hostname, 'github.com', `${link.id} is not on GitHub`);
    assert.match(url.pathname, /AndrexTheDev/, `${link.id} does not reference the owner`);
  }
});

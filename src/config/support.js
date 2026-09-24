/**
 * Support / donation configuration rendered by the SupportModal.
 *
 * @module config/support
 */

/**
 * @typedef {object} CryptoTarget
 * @property {'sol'|'btc'|'eth'} id
 * @property {string} label      full coin name ("Solana")
 * @property {string} ticker     short badge ("SOL")
 * @property {string} network    human-readable chain name
 * @property {string} address    the receiving address, verbatim
 * @property {string} explorer   `{address}` is interpolated
 * @property {string} tone       badge colour key
 * @property {string} [note]     per-network warning shown under the address
 */

/** @type {CryptoTarget[]} */
export const CRYPTO_TARGETS = [
  {
    id: 'sol',
    label: 'Solana',
    ticker: 'SOL',
    network: 'Solana Mainnet',
    address: '79KsqtJJdhKFJ9woxnYgtf3nq7HxQveafWBCtC3mxWi8',
    explorer: 'https://solscan.io/account/{address}',
    tone: 'violet',
    note: 'Send only SOL and SPL tokens on Solana Mainnet.',
  },
  {
    id: 'btc',
    label: 'Bitcoin',
    ticker: 'BTC',
    network: 'Bitcoin (native SegWit · bech32)',
    address: 'bc1qeqzrlfg3edrydk4s0hecakc82gp26n5p7hkc7f',
    explorer: 'https://mempool.space/address/{address}',
    tone: 'brass',
    note: 'Native SegWit address. Do not send Ordinals or BRC-20 inscriptions.',
  },
  {
    id: 'eth',
    label: 'Ethereum',
    ticker: 'ETH',
    network: 'Ethereum Mainnet (ERC-20)',
    address: '0xBC3fab34f69bc9f6661608C3FB36dDdC313C42F7',
    explorer: 'https://etherscan.io/address/{address}',
    tone: 'azure',
    note: 'Ethereum Mainnet only. Layer-2 funds sent here cannot be recovered.',
  },
];

/** Non-crypto ways to support the project. */
export const SUPPORT_LINKS = [
  { id: 'star', href: 'https://github.com/AndrexTheDev/GitBinder', icon: 'star' },
  { id: 'sponsor', href: 'https://github.com/sponsors/AndrexTheDev', icon: 'heart' },
  { id: 'issue', href: 'https://github.com/AndrexTheDev/GitBinder/issues', icon: 'bug' },
];

/* -------------------------------------------------------------------------- *
 * Shape checks
 * -------------------------------------------------------------------------- */

/**
 * Deliberately loose: these confirm an address *looks* like the right asset,
 * which catches the two mistakes that actually happen — pasting the wrong
 * coin's address, and dropping a character. They are not checksum validators
 * (verifying EIP-55 needs keccak256, which is not worth shipping to a browser
 * for this), so a well-formed but wrong address still passes.
 *
 * @type {Record<string, RegExp>}
 */
const ADDRESS_SHAPES = Object.freeze({
  // bech32 SegWit (bc1…) or legacy/taproot base58
  btc: /^(bc1[a-z0-9]{39,59}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/,
  // 0x + 40 hex digits. Mixed case is meaningful: it is the EIP-55 checksum,
  // so this pattern must stay case-insensitive and the UI must never fold it.
  eth: /^0x[a-fA-F0-9]{40}$/,
  // base58, 32–44 characters (standard Solana pubkey)
  sol: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
});

/**
 * @param {CryptoTarget} target
 * @returns {boolean} false when the address cannot possibly be valid
 */
export function isWellFormedAddress(target) {
  const pattern = ADDRESS_SHAPES[target?.id];
  if (!pattern) return true; // unknown asset — no opinion
  return pattern.test(String(target?.address ?? '').trim());
}

/**
 * A placeholder is anything that fails its shape check, plus the obvious
 * literal placeholders left in the file during development.
 */
const PLACEHOLDER_HINTS = ['example', 'replaceme', 'youraddress', 'changeme'];
export function isPlaceholderAddress(target) {
  const address = String(target?.address ?? '').trim().toLowerCase();
  if (!address) return true;
  if (PLACEHOLDER_HINTS.some((hint) => address.includes(hint))) return true;
  if (/^0x0{40}$/.test(address)) return true;
  return !isWellFormedAddress(target);
}

/**
 * Warn loudly in the console if the shipped configuration is still a
 * placeholder. A donor sending funds to a dead address is the worst possible
 * outcome, and this is the cheapest place to catch it.
 */
export function auditSupportConfig() {
  return CRYPTO_TARGETS.filter(isPlaceholderAddress).map((target) => target.id);
}

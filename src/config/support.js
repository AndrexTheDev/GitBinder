/**
 * Support / donation configuration rendered by the SupportModal.
 *
 * ⚠️  PLACEHOLDER ADDRESSES — replace these with your real wallet addresses
 *     before deploying. They are intentionally kept in one file so nothing has
 *     to be hunted down through the component tree.
 *
 * @module config/support
 */

/** @typedef {{ id: string, label: string, address: string, network?: string, explorer?: string, tone?: string }} CryptoTarget */

/** @type {CryptoTarget[]} */
export const CRYPTO_TARGETS = [
  {
    id: 'btc',
    label: 'Bitcoin',
    network: 'BTC',
    address: 'bc1q_example_replace_me_000000000000000',
    explorer: 'https://mempool.space/address/{address}',
    tone: 'brass',
  },
  {
    id: 'eth',
    label: 'Ethereum',
    network: 'ERC-20',
    address: '0x0000000000000000000000000000000000000000',
    explorer: 'https://etherscan.io/address/{address}',
    tone: 'azure',
  },
  {
    id: 'sol',
    label: 'Solana',
    network: 'SOL',
    address: 'ReplaceMeSolanaAddress1111111111111111111',
    explorer: 'https://solscan.io/account/{address}',
    tone: 'violet',
  },
];

/** Non-crypto ways to support the project. */
export const SUPPORT_LINKS = [
  { id: 'star', href: 'https://github.com/AndrexTheDev/GitBinder', icon: 'star' },
  { id: 'sponsor', href: 'https://github.com/sponsors/AndrexTheDev', icon: 'heart' },
  { id: 'issue', href: 'https://github.com/AndrexTheDev/GitBinder/issues', icon: 'bug' },
];

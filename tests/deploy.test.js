/**
 * Deployment configuration.
 *
 * These tests are the release gate: everything that has to be true for
 * `git push` → Cloudflare Pages to produce a working site. They are the kind
 * of check that is easy to skip and expensive to skip wrongly, because a
 * mismatch between the project name, the canonical URL, the sitemap and the
 * attribution only shows up once the site is live.
 *
 * Nothing here needs the network or a built `dist/`; the checks that do read
 * `dist/` skip themselves when it is absent, so `npm test` stays fast.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { APP_NAME, LINKS } from '../src/config/app.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');
const has = (...parts) => existsSync(join(root, ...parts));

/** The deployment origin, normalised without a trailing slash. */
const ORIGIN = LINKS.deployed.replace(/\/$/, '');
const HOST = new URL(ORIGIN).host;

/* -------------------------------------------------------------------------- *
 * Node version
 * -------------------------------------------------------------------------- */

test('the Node version is pinned for the build image', () => {
  // Cloudflare's Pages build image defaults to Node 22.16.0, which satisfies
  // this project today — but the pin is what stops a default change or an
  // older v2 image from silently breaking the build. `.nvmrc` is also the
  // method that survives having a wrangler.toml: with that file present,
  // Cloudflare treats the config as the source of truth and ignores the
  // NODE_VERSION dashboard variable.
  assert.ok(has('.nvmrc'), 'no .nvmrc');
  const pinned = read('.nvmrc').trim();
  assert.match(pinned, /^\d+\.\d+\.\d+$/, `.nvmrc must be a bare version, got "${pinned}"`);

  const [major] = pinned.split('.').map(Number);
  assert.ok(major >= 20, `Node ${pinned} is too old`);

  // `.node-version` is the other filename Cloudflare recognises; if both
  // exist they must agree, or which one wins is anyone's guess.
  if (has('.node-version')) {
    assert.equal(read('.node-version').trim(), pinned, '.nvmrc and .node-version disagree');
  }
});

test('the pinned Node version satisfies every engine requirement', () => {
  const [major, minor] = read('.nvmrc').trim().split('.').map(Number);
  const pkg = JSON.parse(read('package.json'));

  assert.equal(pkg.engines?.node, '>=20.19.0');
  assert.ok(major > 20 || (major === 20 && minor >= 19), 'pin is below our own engines field');

  // Vite is the strictest dependency: `^20.19.0 || >=22.12.0`.
  const vite = JSON.parse(read('node_modules', 'vite', 'package.json'));
  const range = vite.engines.node;
  assert.match(range, /\^20\.19\.0/);
  assert.ok(major >= 22 && minor >= 12, `Node ${major}.${minor} does not satisfy Vite's ${range}`);
});

/* -------------------------------------------------------------------------- *
 * Build output
 * -------------------------------------------------------------------------- */

test('the build writes to dist/ and nothing else', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.build, 'vite build');

  // Vite's default output is dist/, and wrangler.toml points at it. Both
  // paths have to agree or the deploy uploads the wrong folder.
  const wrangler = read('wrangler.toml');
  assert.match(wrangler, /pages_build_output_dir\s*=\s*"dist"/);

  const viteConfig = read('vite.config.js');
  if (/build\s*:\s*\{[^}]*outDir/.test(viteConfig)) {
    assert.match(viteConfig, /outDir:\s*'dist'/, 'vite outDir is not dist');
  }
});

test('the deploy scripts name the production branch explicitly', () => {
  const { scripts } = JSON.parse(read('package.json'));

  for (const name of ['deploy', 'deploy:preview']) {
    assert.ok(scripts[name], `missing script: ${name}`);
    assert.match(scripts[name], /pages deploy dist/);
    assert.match(scripts[name], /--project-name=gitbinder/);
  }

  // Without `--branch`, wrangler deploys to whatever branch happens to be
  // checked out — which for this repository means a preview URL rather than
  // the production host that everything links to. This is the single easiest
  // way to "deploy successfully" and still see no change on the live site.
  assert.match(scripts.deploy, /--branch=main/, 'the production deploy must pin --branch=main');
  assert.equal(
    /--branch/.test(scripts['deploy:preview']),
    false,
    'the preview script should stay on the current branch',
  );
});

/* -------------------------------------------------------------------------- *
 * Naming consistency
 * -------------------------------------------------------------------------- */

test('the Pages project name matches the deployed origin', () => {
  const wrangler = read('wrangler.toml');
  const project = wrangler.match(/name\s*=\s*"([^"]+)"/)?.[1];
  assert.equal(project, 'gitbinder');

  // The project name is what produces <name>.pages.dev, and that host is what
  // the book's running footer prints. If they drift, every generated PDF
  // credits a URL that does not exist.
  assert.equal(project, HOST.split('.')[0], 'project name and LINKS.deployed disagree');
});

test('every absolute URL in the repo points at the same origin', () => {
  const urls = [
    read('index.html').match(/<link rel="canonical" href="([^"]+)"/)?.[1],
    read('index.html').match(/<meta property="og:url" content="([^"]+)"/)?.[1],
    read('index.html').match(/<meta property="og:image" content="([^"]+)"/)?.[1],
    read('public', 'robots.txt').match(/^Sitemap: (\S+)/m)?.[1],
    read('public', 'sitemap.xml').match(/<loc>([^<]+)<\/loc>/)?.[1],
    LINKS.deployed,
  ];

  for (const url of urls) {
    assert.ok(url, 'a deployment URL is missing');
    assert.equal(new URL(url).origin, ORIGIN, `${url} is not on ${ORIGIN}`);
  }
});

test('the app name the user sees matches the manifest name', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.name, 'gitbinder');
  assert.equal(APP_NAME, 'GitBinder');
  assert.match(read('index.html'), new RegExp(`<title>${APP_NAME}`));
});

/* -------------------------------------------------------------------------- *
 * Cloudflare Pages files
 * -------------------------------------------------------------------------- */

test('_headers ships a locked-down CSP', () => {
  const headers = read('public', '_headers');

  const csp = headers.match(/Content-Security-Policy: (.+)/)?.[1];
  assert.ok(csp, 'no Content-Security-Policy');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.match(csp, /form-action 'none'/);
  // The app talks to GitHub and nobody else.
  assert.match(csp, /connect-src 'self' https:\/\/api\.github\.com/);
  // No wildcard origins anywhere — that would defeat the point.
  assert.equal(/\*(?!\.)/.test(csp.replace(/[a-z-]+-src/g, '')), false, 'wildcard in the CSP');

  // HTTPS is the only transport Pages offers, so HSTS costs nothing.
  assert.match(headers, /Strict-Transport-Security: max-age=\d+/);

  // Hashed assets are immutable; the shell must revalidate so a deploy lands.
  assert.match(headers, /\/assets\/\*[\s\S]{0,120}max-age=31536000, immutable/);
  assert.match(headers, /Cache-Control: public, max-age=0, must-revalidate/);
});

test('the CSP is compatible with what index.html actually contains', () => {
  const html = read('index.html');

  // `script-src 'self'` with no `unsafe-inline`: any inline script would be
  // blocked in production, and only in production, which is the worst place
  // to find out.
  assert.equal(
    /<script(?![^>]*\ssrc=)[^>]*>/i.test(html),
    false,
    'index.html has an inline <script> that the CSP will block',
  );
  // Inline event handlers are blocked by the same directive.
  assert.equal(/\son[a-z]+\s*=/i.test(html), false, 'index.html has an inline event handler');

  // `style-src 'unsafe-inline'` is present, so the boot splash <style> is
  // fine — but it is worth asserting the exception is deliberate and narrow.
  assert.match(read('public', '_headers'), /style-src 'self' 'unsafe-inline'/);
});

test('_redirects provides the SPA fallback', () => {
  const redirects = read('public', '_redirects');
  assert.match(redirects, /^\s*\/\*\s+\/index\.html\s+200\s*$/m);

  // Cloudflare matches static assets before applying rules, so this only
  // catches paths that do not exist — shared links with a query string still
  // resolve to the real shell.
  assert.equal(/\b301\b|\b302\b/.test(redirects), false, 'a permanent redirect would be cached');
});

test('robots.txt invites crawlers and points at the sitemap', () => {
  const robots = read('public', 'robots.txt');
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.equal(/^Disallow: \/\S/m.test(robots), false, 'robots.txt blocks a path');
});

test('the sitemap is valid XML with the deployment origin', () => {
  const xml = read('public', 'sitemap.xml');
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, new RegExp(`<loc>${ORIGIN}/</loc>`));
  assert.match(xml, /<\/urlset>\s*$/);
});

/* -------------------------------------------------------------------------- *
 * Built output (only when dist/ exists)
 * -------------------------------------------------------------------------- */

test('the built site is entirely self-contained', { skip: !has('dist') ? 'no dist/ — run npm run build' : false }, () => {
  const html = read('dist', 'index.html');

  // One external URL is expected and fine: the canonical/OG origin. Anything
  // else would be an asset fetched from a third party, which breaks both the
  // CSP and the "no requests leave your browser" promise.
  const external = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
  for (const url of external) {
    assert.equal(new URL(url).origin, ORIGIN, `third-party asset in the build: ${url}`);
  }
});

test('the built site ships the deploy files and the brand assets', { skip: !has('dist') ? 'no dist/ — run npm run build' : false }, () => {
  for (const file of [
    '_headers',
    '_redirects',
    'robots.txt',
    'sitemap.xml',
    'favicon.svg',
    'og.png',
    'brand/mark.svg',
  ]) {
    assert.ok(has('dist', ...file.split('/')), `dist/${file} is missing`);
  }

  // Hashed, immutable asset names — the whole basis of the cache rule.
  const assets = read('dist', 'index.html').match(/\/assets\/[a-zA-Z0-9._-]+/g) ?? [];
  assert.ok(assets.length >= 3, 'expected at least a stylesheet and two scripts');
  for (const asset of assets) {
    assert.match(asset, /-[A-Za-z0-9_-]{8}\./, `${asset} does not look content-hashed`);
  }
});

test('og.png is the 1200x630 the meta tags claim', () => {
  // PNG header: 8-byte signature, then IHDR length+type, then width/height.
  const png = readFileSync(join(root, 'public', 'og.png'));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'not a PNG');
  assert.equal(png.subarray(12, 16).toString('ascii'), 'IHDR');
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);

  assert.equal(width, 1200);
  assert.equal(height, 630);

  const html = read('index.html');
  assert.match(html, /<meta property="og:image:width" content="1200" \/>/);
  assert.match(html, /<meta property="og:image:height" content="630" \/>/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image" \/>/);
});

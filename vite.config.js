import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

/**
 * GitBooklet is a static, zero-backend app.
 * `npm run build` emits a fully static bundle into `dist/`,
 * which is what Cloudflare Pages serves (Build command: `npm run build`, Output dir: `dist`).
 *
 * @see https://vite.dev/config/
 */
export default defineConfig({
  plugins: [tailwindcss()],

  // Repo root is the project root; index.html is the entry document.
  root: '.',
  publicDir: 'public',

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: false,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        // Keep third-party code in its own long-lived chunk so editing app
        // code does not invalidate the vendor cache entry.
        // Rolldown (Vite 8's bundler) requires the function form here.
        manualChunks: (id) => (id.includes('node_modules') ? 'vendor' : undefined),
      },
    },
  },

  // `lucide` re-exports ~2 000 icon modules; pre-bundling it keeps dev-server
  // cold starts and HMR responsive.
  optimizeDeps: {
    include: ['lucide'],
  },

  server: {
    host: '0.0.0.0',
    port: 5173,
    // Required so the app can be reached through reverse proxies / preview tunnels.
    allowedHosts: true,
  },

  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
});

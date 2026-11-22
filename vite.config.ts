/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleExtract } from './src/extract/handler';
import { handleTopic } from './src/extract/topicHandler';
import { handleDefine } from './src/extract/defineHandler';

/**
 * Dev-only: serves /api/extract, /api/topic and /api/define from `npm run dev` by calling the same handlers the
 * Cloudflare Pages Functions use. `apply: 'serve'` keeps it out of `vite build`, and
 * functions/api/extract.ts is untouched, so production behavior does not change.
 */
function devExtractApi(): Plugin {
  return {
    name: 'disclore-dev-extract-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? '';
        const path = rawUrl.split('?')[0];
        if (path !== '/api/extract' && path !== '/api/topic' && path !== '/api/define') {
          next();
          return;
        }
        try {
          const request = new Request(`http://${req.headers.host ?? 'localhost'}${rawUrl}`, {
            method: req.method ?? 'GET',
          });
          const deps = { fetch: (input: string, init?: RequestInit) => fetch(input, init) };
          const handler = path === '/api/topic' ? handleTopic : path === '/api/define' ? handleDefine : handleExtract;
          const response = await handler(request, deps);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        } catch {
          res.statusCode = 502;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'upstream-failed' }));
        }
      });
    },
  };
}

/**
 * Splits the production bundle so no chunk passes Vite's 500 kB warning: React and React DOM in one
 * vendor chunk, and the four built-in discs (pure data) in another. Build-only: Vitest does not bundle.
 */
function manualChunks(id: string): string | undefined {
  const path = id.replace(/\\/g, '/');
  if (/\/node_modules\/(react|react-dom|scheduler)\//.test(path)) return 'react-vendor';
  if (path.includes('/src/discs/')) return 'discs';
  return undefined;
}

export default defineConfig({
  plugins: [react(), devExtractApi()],
  build: {
    rollupOptions: {
      output: { manualChunks },
    },
  },
  test: {
    environment: 'jsdom',
    testTimeout: 15000,
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
});

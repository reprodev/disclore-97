/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleExtract } from './src/extract/handler';

/**
 * Dev-only: serves /api/extract from `npm run dev` by calling the same handler the
 * Cloudflare Pages Function uses. `apply: 'serve'` keeps it out of `vite build`, and
 * functions/api/extract.ts is untouched, so production behavior does not change.
 */
function devExtractApi(): Plugin {
  return {
    name: 'disclore-dev-extract-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? '';
        if (!rawUrl.startsWith('/api/extract')) {
          next();
          return;
        }
        try {
          const request = new Request(`http://${req.headers.host ?? 'localhost'}${rawUrl}`, {
            method: req.method ?? 'GET',
          });
          const response = await handleExtract(request, { fetch: (input, init) => fetch(input, init) });
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

export default defineConfig({
  plugins: [react(), devExtractApi()],
  test: {
    environment: 'jsdom',
    testTimeout: 15000,
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
});

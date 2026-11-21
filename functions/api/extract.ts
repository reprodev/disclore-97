/**
 * Cloudflare Pages Function for /api/extract.
 * Adapts the Pages request context to the testable handler in src/extract/handler.ts.
 */

import { handleExtract } from '../../src/extract/handler';

interface PagesContext {
  request: Request;
  env?: Record<string, string | undefined>;
}

export const onRequest = (context: PagesContext): Promise<Response> =>
  handleExtract(context.request, { fetch: (input, init) => fetch(input, init), env: context.env });

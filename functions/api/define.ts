/**
 * Cloudflare Pages Function for /api/define.
 * Adapts the Pages request context to the testable handler in src/extract/defineHandler.ts.
 */

import { handleDefine } from '../../src/extract/defineHandler';

interface PagesContext {
  request: Request;
}

export const onRequest = (context: PagesContext): Promise<Response> =>
  handleDefine(context.request, { fetch: (input, init) => fetch(input, init) });

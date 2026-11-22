/**
 * Cloudflare Pages Function for /api/topic.
 * Adapts the Pages request context to the testable handler in src/extract/topicHandler.ts.
 */

import { handleTopic } from '../../src/extract/topicHandler';

interface PagesContext {
  request: Request;
}

export const onRequest = (context: PagesContext): Promise<Response> =>
  handleTopic(context.request, { fetch: (input, init) => fetch(input, init) });

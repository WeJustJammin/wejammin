import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsRelatedContentMutation } from '../../../../../../server/cms-composition-platform-related';

export const prerender = false;

/** First-party related-content transport; the API Worker derives authority. */
export const POST: APIRoute = ({ request, params }) =>
  forwardCmsRelatedContentMutation(request, params.entryId, env.PLATFORM_API);

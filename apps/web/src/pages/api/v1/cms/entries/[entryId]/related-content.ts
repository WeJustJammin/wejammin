import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsRelatedContentMutation } from '../../../../../../server/cms-composition-platform-related';
import { readCmsRelatedContent } from '../../../../../../server/cms-composition-platform-related-read';

export const prerender = false;

/** First-party related-content transport; the API Worker derives authority. */
export const POST: APIRoute = ({ request, params }) =>
  forwardCmsRelatedContentMutation(request, params.entryId, env.PLATFORM_API);

/** `cmsRelatedContentRead` (DEC-195): the saved rule of the entry, for the curation form. */
export const GET: APIRoute = ({ request, params }) =>
  readCmsRelatedContent(request, params.entryId, env.PLATFORM_API);

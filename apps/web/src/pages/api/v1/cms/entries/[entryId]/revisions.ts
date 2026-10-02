import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsEditorialRevisionMutation } from '../../../../../../server/cms-editorial-platform-revision';

export const prerender = false;

/** First-party autosave transport; the protected API Worker derives authority. */
export const POST: APIRoute = ({ request, params }) =>
  forwardCmsEditorialRevisionMutation(
    request,
    params.entryId,
    env.PLATFORM_API,
  );

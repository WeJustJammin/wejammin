import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsEditorialConflictDetailRead } from '../../../../../../../server/cms-editorial-platform-reads';

export const prerender = false;

/** First-party CMS-03B-12 transport; the protected API Worker derives authority. */
export const GET: APIRoute = ({ request, params }) =>
  forwardCmsEditorialConflictDetailRead(
    request,
    params.entryId,
    params.conflictId,
    env.PLATFORM_API,
  );

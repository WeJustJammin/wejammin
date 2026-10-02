import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsEditorialConflictResolution } from '../../../../../../../../server/cms-editorial-platform-conflict';

export const prerender = false;

/** First-party conflict transport; the protected Worker chooses no winner. */
export const POST: APIRoute = ({ request, params }) =>
  forwardCmsEditorialConflictResolution(
    request,
    params.entryId,
    params.conflictId,
    env.PLATFORM_API,
  );

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsEditorialRevisionRestore } from '../../../../../../../../server/cms-editorial-platform-restore';

export const prerender = false;

/** First-party restore transport; the protected Worker verifies the chain. */
export const POST: APIRoute = ({ request, params }) =>
  forwardCmsEditorialRevisionRestore(
    request,
    params.entryId,
    params.revisionId,
    env.PLATFORM_API,
  );

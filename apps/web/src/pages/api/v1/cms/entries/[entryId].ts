import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsEditorialEntryDraftDetailRead } from '../../../../../server/cms-editorial-platform-reads';

export const prerender = false;

/**
 * First-party CMS-03B-11 draft-detail transport. The editor refetches the
 * authoritative draft here after a created revision or a 409; the protected API
 * Worker derives authority and the strong no-store ETag is preserved verbatim.
 */
export const GET: APIRoute = ({ request, params }) =>
  forwardCmsEditorialEntryDraftDetailRead(
    request,
    env.PLATFORM_API,
    params.entryId ?? '',
  );

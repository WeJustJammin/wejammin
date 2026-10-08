import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsEditorialAuthoringContextRead } from '../../../../../server/cms-editorial-platform-reads';

export const prerender = false;

/** First-party CMS-03B-14 transport; the protected API Worker derives authority. */
export const GET: APIRoute = ({ request }) =>
  forwardCmsEditorialAuthoringContextRead(request, env.PLATFORM_API);

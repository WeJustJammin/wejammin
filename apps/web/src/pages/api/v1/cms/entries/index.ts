import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsEditorialEntryCreateMutation } from '../../../../../server/cms-editorial-platform-mutation';

export const prerender = false;

/** First-party transport only; the protected API Worker derives authority. */
export const POST: APIRoute = ({ request }) =>
  forwardCmsEditorialEntryCreateMutation(request, env.PLATFORM_API);

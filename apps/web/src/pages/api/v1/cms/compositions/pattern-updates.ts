import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsCompositionPatternUpdate } from '../../../../../server/cms-composition-instances-update';

export const prerender = false;

/** CMS-03C-15: accept or detach a pattern update; the API Worker resolves editor authority. */
export const POST: APIRoute = ({ request }) =>
  forwardCmsCompositionPatternUpdate(request, env.PLATFORM_API);

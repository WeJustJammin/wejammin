import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsPatternInstanceMutation } from '../../../../../server/cms-composition-platform-pattern';

export const prerender = false;

/** Same-origin transport; the API Worker resolves editor authority. */
export const POST: APIRoute = ({ request }) =>
  forwardCmsPatternInstanceMutation(request, env.PLATFORM_API);

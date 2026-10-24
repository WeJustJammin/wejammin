import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsPatternVersionWrite } from '../../../../../server/cms-pattern-platform-write';

export const prerender = false;

/** Same-origin transport boundary for CMS-03C-12; the API Worker remains the authority. */
export const POST: APIRoute = ({ request }) =>
  forwardCmsPatternVersionWrite(request, env.PLATFORM_API);

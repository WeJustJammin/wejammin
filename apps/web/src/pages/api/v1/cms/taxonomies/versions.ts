import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsTaxonomyVersionWrite } from '../../../../../server/cms-taxonomy-platform-write';

export const prerender = false;

/** Same-origin transport boundary for CMS-03C-16; the API Worker remains the authority. */
export const POST: APIRoute = ({ request }) =>
  forwardCmsTaxonomyVersionWrite(request, env.PLATFORM_API);

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsTaxonomyTermAction } from '../../../../../../../server/cms-taxonomy-platform-term-action';

export const prerender = false;

/** Same-origin transport boundary for CMS-03C-03; the curator capability stays with the Worker. */
export const POST: APIRoute = ({ request, params }) =>
  forwardCmsTaxonomyTermAction(request, env.PLATFORM_API, params.taxonomyId);

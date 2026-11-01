import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { readCmsTaxonomySelector } from '../../../../../server/cms-taxonomy-platform-read';

export const prerender = false;

/** Same-origin projection of CMS-03C-17, the author-facing term selector. */
export const GET: APIRoute = ({ request }) =>
  readCmsTaxonomySelector(request, env.PLATFORM_API);

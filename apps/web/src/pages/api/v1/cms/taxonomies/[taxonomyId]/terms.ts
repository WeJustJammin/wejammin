import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { readCmsTaxonomyTerms } from '../../../../../../server/cms-taxonomy-platform-read';

export const prerender = false;

/** Same-origin projection of `cmsTaxonomyTermsRead`: the curator's term list, one keyset page. */
export const GET: APIRoute = ({ request, params }) =>
  readCmsTaxonomyTerms(request, env.PLATFORM_API, params.taxonomyId);

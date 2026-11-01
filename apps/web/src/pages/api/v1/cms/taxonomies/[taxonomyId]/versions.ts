import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { readCmsTaxonomyVersions } from '../../../../../../server/cms-taxonomy-platform-read';

export const prerender = false;

/** Same-origin projection of `cmsTaxonomyVersionsRead`: the versions of one vocabulary, newest first. */
export const GET: APIRoute = ({ request, params }) =>
  readCmsTaxonomyVersions(request, env.PLATFORM_API, params.taxonomyId);

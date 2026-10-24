import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { readCmsCompositionInstances } from '../../../../../../server/cms-composition-instances-list';

export const prerender = false;

/**
 * `cmsCompositionInstancesRead` (DEC-206): a page of the instances of the entry's current draft revision, for the
 * composition page; the API Worker derives session, capability and domain authority.
 */
export const GET: APIRoute = ({ request, params }) =>
  readCmsCompositionInstances(request, env.PLATFORM_API, params.entryId ?? '');

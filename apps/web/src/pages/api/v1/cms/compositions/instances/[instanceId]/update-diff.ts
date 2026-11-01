import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { readCmsCompositionUpdateDiff } from '../../../../../../../server/cms-composition-instances-diff';

export const prerender = false;

/** CMS-03C-14: the three-way diff of one pattern instance; the API Worker resolves editor authority. */
export const GET: APIRoute = ({ request, params }) =>
  readCmsCompositionUpdateDiff(request, params.instanceId, env.PLATFORM_API);

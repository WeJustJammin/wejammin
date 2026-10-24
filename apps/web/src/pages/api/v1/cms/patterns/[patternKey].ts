import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { readCmsPatternLatest } from '../../../../../server/cms-pattern-platform-latest';

export const prerender = false;

/**
 * Same-origin projection of `cmsPatternLatestRead`. The static `versions` route wins
 * over this one; `selector` (CMS-03C-13, not built) and the other reserved keys are
 * refused by the proxy as invalid keys, so they never reach the Worker.
 */
export const GET: APIRoute = ({ request, params }) =>
  readCmsPatternLatest(request, env.PLATFORM_API, params.patternKey);

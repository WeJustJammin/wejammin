import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { readCmsPatternNestable } from '../../../../../server/cms-pattern-nestable';

export const prerender = false;

/**
 * cmsPatternNestableRead (DEC-196): the designer-only list of nestable patterns for the pattern version designer. Static
 * route, so it wins over the dynamic `[patternKey]` route.
 */
export const GET: APIRoute = ({ request }) =>
  readCmsPatternNestable(request, env.PLATFORM_API);

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { readCmsPatternSelector } from '../../../../../server/cms-composition-instances-selector';

export const prerender = false;

/** CMS-03C-13: the author-facing pattern selector; `selector` is a reserved pattern key, so this static route wins. */
export const GET: APIRoute = ({ request }) =>
  readCmsPatternSelector(request, env.PLATFORM_API);

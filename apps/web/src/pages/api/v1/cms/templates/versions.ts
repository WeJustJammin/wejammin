import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsTemplateDefineMutation } from '../../../../../server/cms-composition-platform-mutation';

export const prerender = false;

/** Same-origin transport boundary; the API Worker remains the authority. */
export const POST: APIRoute = ({ request }) =>
  forwardCmsTemplateDefineMutation(request, env.PLATFORM_API);

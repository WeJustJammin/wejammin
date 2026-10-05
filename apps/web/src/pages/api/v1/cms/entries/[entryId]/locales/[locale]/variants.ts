import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsLocaleVariantMutation } from '../../../../../../../../server/cms-composition-platform-locale';

export const prerender = false;

/** First-party locale authoring transport; the API Worker derives authority. */
export const POST: APIRoute = ({ request, params }) =>
  forwardCmsLocaleVariantMutation(
    request,
    params.entryId,
    params.locale,
    env.PLATFORM_API,
  );

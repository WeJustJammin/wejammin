import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { readCmsLocaleVariant } from '../../../../../../../server/cms-composition-platform-locale-read';

export const prerender = false;

/** `cmsLocaleVariantRead` (DEC-205): the entry's locale variant, its resolutions and fallback order, for the translation form. */
export const GET: APIRoute = ({ request, params }) =>
  readCmsLocaleVariant(
    request,
    params.entryId,
    params.locale,
    env.PLATFORM_API,
  );

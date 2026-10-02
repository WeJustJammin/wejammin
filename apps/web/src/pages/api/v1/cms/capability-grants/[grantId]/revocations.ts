import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardContentSchemaRegistryMutation } from '../../../../../../server/content-schema-registry-platform-api';

export const prerender = false;

/** CMS-03A-17: revoke one owner grant; the grant id comes from the route only. */
export const POST: APIRoute = ({ request, params }) =>
  forwardContentSchemaRegistryMutation(request, env.PLATFORM_API, {
    operationId: 'CMS-03A-17',
    grantId: params.grantId ?? '',
  });

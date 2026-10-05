import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardContentSchemaRegistryMutation } from '../../../../../../server/content-schema-registry-platform-api';

export const prerender = false;

/** CMS-03A-12: one reviewer decision; the review id comes from the route only. */
export const POST: APIRoute = ({ request, params }) =>
  forwardContentSchemaRegistryMutation(request, env.PLATFORM_API, {
    operationId: 'CMS-03A-12',
    reviewId: params.reviewId ?? '',
  });

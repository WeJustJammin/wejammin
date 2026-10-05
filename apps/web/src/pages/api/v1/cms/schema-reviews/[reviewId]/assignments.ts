import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardContentSchemaRegistryMutation } from '../../../../../../server/content-schema-registry-platform-api';

export const prerender = false;

/** CMS-03A-14: owner create or revoke of one reviewer assignment. */
export const POST: APIRoute = ({ request, params }) =>
  forwardContentSchemaRegistryMutation(request, env.PLATFORM_API, {
    operationId: 'CMS-03A-14',
    reviewId: params.reviewId ?? '',
  });

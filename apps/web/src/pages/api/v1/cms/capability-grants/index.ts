import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsCapabilityGrantListRead } from '../../../../../server/cms-capability-grant-platform-api';
import { forwardContentSchemaRegistryMutation } from '../../../../../server/content-schema-registry-platform-api';

export const prerender = false;

/** CMS-03A-18: same-origin owner grant list read; the Worker decides ownership. */
export const GET: APIRoute = ({ request }) =>
  forwardCmsCapabilityGrantListRead(request, env.PLATFORM_API);

/** CMS-03A-15: same-origin owner grant command; the Worker decides ownership. */
export const POST: APIRoute = ({ request }) =>
  forwardContentSchemaRegistryMutation(request, env.PLATFORM_API, {
    operationId: 'CMS-03A-15',
  });

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsWorkflowRead } from '../../../../../server/cms-workflow-platform-reads';

export const prerender = false;

/** First-party CMS-03B-17 reviewer queue; scope and the signed cursor stay with the Worker. */
export const GET: APIRoute = ({ request }) =>
  forwardCmsWorkflowRead('CMS-03B-17', request, {}, env.PLATFORM_API);

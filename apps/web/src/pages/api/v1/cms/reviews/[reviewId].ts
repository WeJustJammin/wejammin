import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsWorkflowRead } from '../../../../../server/cms-workflow-platform-reads';

export const prerender = false;

/** First-party CMS-03B-16 review detail refetch; disclosure stays with the Worker. */
export const GET: APIRoute = ({ request, params }) =>
  forwardCmsWorkflowRead(
    'CMS-03B-16',
    request,
    { reviewId: params.reviewId },
    env.PLATFORM_API,
  );

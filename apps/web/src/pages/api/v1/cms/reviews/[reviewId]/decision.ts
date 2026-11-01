import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsWorkflowCommand } from '../../../../../../server/cms-workflow-platform-command';

export const prerender = false;

/** First-party CMS-03B-06 decision; step-up and separation of duties stay with the Worker. */
export const POST: APIRoute = ({ request, params }) =>
  forwardCmsWorkflowCommand(
    'CMS-03B-06',
    request,
    { reviewId: params.reviewId },
    env.PLATFORM_API,
  );

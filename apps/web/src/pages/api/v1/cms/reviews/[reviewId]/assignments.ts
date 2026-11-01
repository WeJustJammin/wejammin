import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsWorkflowCommand } from '../../../../../../server/cms-workflow-platform-command';

export const prerender = false;

/** First-party CMS-03B-18 reviewer assignment create or revoke; owner authority stays with the Worker. */
export const POST: APIRoute = ({ request, params }) =>
  forwardCmsWorkflowCommand(
    'CMS-03B-18',
    request,
    { reviewId: params.reviewId },
    env.PLATFORM_API,
  );

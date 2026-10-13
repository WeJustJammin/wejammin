import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsWorkflowCommand } from '../../../../../../server/cms-workflow-platform-command';

export const prerender = false;

/** First-party CMS-03B-05 review submission; the Worker derives every authority. */
export const POST: APIRoute = ({ request, params }) =>
  forwardCmsWorkflowCommand(
    'CMS-03B-05',
    request,
    { entryId: params.entryId },
    env.PLATFORM_API,
  );

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsWorkflowCommand } from '../../../../../server/cms-workflow-platform-command';

export const prerender = false;

/** First-party CMS-03B-08 preview mint; the token appears only in this response. */
export const POST: APIRoute = ({ request }) =>
  forwardCmsWorkflowCommand('CMS-03B-08', request, {}, env.PLATFORM_API);

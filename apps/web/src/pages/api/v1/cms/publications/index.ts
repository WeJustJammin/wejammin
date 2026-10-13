import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsWorkflowCommand } from '../../../../../server/cms-workflow-platform-command';

export const prerender = false;

/** First-party CMS-03B-09 immediate publication; a 202 is never proof of public visibility. */
export const POST: APIRoute = ({ request }) =>
  forwardCmsWorkflowCommand('CMS-03B-09', request, {}, env.PLATFORM_API);

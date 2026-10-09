import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsWorkflowCommand } from '../../../../../server/cms-workflow-platform-command';

export const prerender = false;

/** First-party CMS-03B-07 schedule; the Worker re-resolves the time and is authoritative. */
export const POST: APIRoute = ({ request }) =>
  forwardCmsWorkflowCommand('CMS-03B-07', request, {}, env.PLATFORM_API);

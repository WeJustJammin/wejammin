import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsWorkflowRead } from '../../../../../../server/cms-workflow-platform-reads';

export const prerender = false;

/**
 * First-party CMS-03B-15 workflow and preparation read. The islands refetch the
 * canonical workflow here after a command; the strong validator and no-store are
 * preserved and the frozen manifest is never cached.
 */
export const GET: APIRoute = ({ request, params }) =>
  forwardCmsWorkflowRead(
    'CMS-03B-15',
    request,
    { entryId: params.entryId },
    env.PLATFORM_API,
  );

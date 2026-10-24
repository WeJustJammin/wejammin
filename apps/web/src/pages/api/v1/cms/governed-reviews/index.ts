import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsGovernedReviewCommand } from '../../../../../server/cms-governed-review-platform-command';
import { forwardCmsGovernedReviewRead } from '../../../../../server/cms-governed-review-platform-reads';

export const prerender = false;

/** First-party CMS-03C-11 definition-review queue; scope and the signed cursor stay with the Worker. */
export const GET: APIRoute = ({ request }) =>
  forwardCmsGovernedReviewRead('CMS-03C-11', request, {}, env.PLATFORM_API);

/** First-party CMS-03C-06 submit; the subject, owner and capability are re-derived by the Worker. */
export const POST: APIRoute = ({ request }) =>
  forwardCmsGovernedReviewCommand('CMS-03C-06', request, {}, env.PLATFORM_API);

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsGovernedReviewCommand } from '../../../../../../server/cms-governed-review-platform-command';

export const prerender = false;

/** First-party CMS-03C-07 decision; step-up and separation of duties stay with the Worker. */
export const POST: APIRoute = ({ request, params }) =>
  forwardCmsGovernedReviewCommand(
    'CMS-03C-07',
    request,
    { reviewId: params.reviewId },
    env.PLATFORM_API,
  );

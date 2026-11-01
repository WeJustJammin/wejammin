import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsGovernedReviewCommand } from '../../../../../../server/cms-governed-review-platform-command';

export const prerender = false;

/** First-party CMS-03C-08 reviewer assignment create or revoke; owner authority stays with the Worker. */
export const POST: APIRoute = ({ request, params }) =>
  forwardCmsGovernedReviewCommand(
    'CMS-03C-08',
    request,
    { reviewId: params.reviewId },
    env.PLATFORM_API,
  );

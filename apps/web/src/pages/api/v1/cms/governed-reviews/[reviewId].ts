import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { forwardCmsGovernedReviewRead } from '../../../../../server/cms-governed-review-platform-reads';

export const prerender = false;

/** First-party CMS-03C-10 definition-review detail refetch; disclosure stays with the Worker. */
export const GET: APIRoute = ({ request, params }) =>
  forwardCmsGovernedReviewRead(
    'CMS-03C-10',
    request,
    { reviewId: params.reviewId },
    env.PLATFORM_API,
  );

import {
  CmsUuidSchema,
  GovernedReviewDetailResourceSchema,
  type GovernedReviewDetailResource,
} from '@wejammin/contracts';

import {
  cmsEditorialNoticeFor,
  cmsEditorialUnverifiedNotice,
} from '../cms-editorial-pages/cms-editorial-page-outcome';
import type { CmsEditorialPageOutcome } from '../cms-editorial-pages/cms-editorial-page-view';
import type { CmsGovernedPageReads } from './governed-review-page-reads';

export interface CmsGovernedDetailPageView {
  readonly review: GovernedReviewDetailResource;
  readonly reviewId: string;
  readonly routePath: string;
  /** When the server verified this read; the island's `lastVerifiedAt`. */
  readonly verifiedAt: string;
}

/**
 * The protected CMS-03C-10 review surface. The URL carries only the immutable
 * review id. A hidden, absent or cross-owner review is one identical 404; a 200
 * must be the strict detail for THIS review, so a body that leaks a person,
 * actor or party identifier (an unknown key) is refused, never rendered.
 */
export const loadGovernedDetailPage = async (input: {
  readonly request: Request;
  readonly reviewId: string;
  readonly reads: CmsGovernedPageReads;
}): Promise<CmsEditorialPageOutcome<CmsGovernedDetailPageView>> => {
  const url = new URL(input.request.url);
  if (!CmsUuidSchema.safeParse(input.reviewId).success)
    return {
      kind: 'notice',
      notice: {
        status: 400,
        title: 'Invalid request',
        heading: 'Invalid request',
        message:
          'This request could not be read. Check the address and try again.',
        retryHref: null,
        requestId: null,
      },
    };
  const response = await input.reads.reviewDetail(
    input.request,
    input.reviewId,
  );
  if (response.status !== 200)
    return cmsEditorialNoticeFor(response, {
      subject: 'review',
      returnTo: url.pathname,
      retryHref: url.pathname,
    });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return cmsEditorialUnverifiedNotice('Definition review');
  }
  const parsed = GovernedReviewDetailResourceSchema.safeParse(body);
  if (!parsed.success || parsed.data.id !== input.reviewId)
    return cmsEditorialUnverifiedNotice('Definition review');
  return {
    kind: 'view',
    status: 200,
    title: 'Definition review',
    heading: 'Definition review',
    description: 'Read the frozen version and record your decision.',
    view: {
      review: parsed.data,
      reviewId: input.reviewId,
      routePath: url.pathname,
      verifiedAt: new Date().toISOString(),
    },
  };
};

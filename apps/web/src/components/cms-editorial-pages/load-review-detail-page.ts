import {
  CmsUuidSchema,
  EditorialReviewDetailResourceSchema,
  type EditorialReviewDetailResource,
} from '@wejammin/contracts';

import {
  cmsEditorialNoticeFor,
  cmsEditorialUnverifiedNotice,
} from './cms-editorial-page-outcome';
import type { CmsEditorialPageReads } from './cms-editorial-page-reads';
import type { CmsEditorialPageOutcome } from './cms-editorial-page-view';

export interface CmsEditorialReviewDetailPageView {
  readonly review: EditorialReviewDetailResource;
  readonly reviewId: string;
  readonly routePath: string;
  /** When the server verified this read; the island's `lastVerifiedAt`. */
  readonly verifiedAt: string;
}

/**
 * The protected CMS-03B-16 review surface. The URL carries only the immutable
 * review id. A hidden, absent or cross-owner review is one identical 404; a 200
 * must be the strict detail for THIS review, so a body that leaks a person,
 * actor or party identifier (an unknown key) is refused, never rendered.
 */
export const loadReviewDetailPage = async (input: {
  readonly request: Request;
  readonly reviewId: string;
  readonly reads: CmsEditorialPageReads;
}): Promise<CmsEditorialPageOutcome<CmsEditorialReviewDetailPageView>> => {
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
    return cmsEditorialUnverifiedNotice('Review');
  }
  const parsed = EditorialReviewDetailResourceSchema.safeParse(body);
  if (!parsed.success || parsed.data.id !== input.reviewId)
    return cmsEditorialUnverifiedNotice('Review');
  return {
    kind: 'view',
    status: 200,
    title: 'Review',
    heading: 'Review',
    description: 'Read the frozen candidate and record your decision.',
    view: {
      review: parsed.data,
      reviewId: input.reviewId,
      routePath: url.pathname,
      verifiedAt: new Date().toISOString(),
    },
  };
};

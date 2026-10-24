import { forwardCmsGovernedReviewRead } from '../../server/cms-governed-review-platform-reads';

/**
 * The protected first-party reads a definition-review page performs, behind one
 * seam. The Astro pages build it from the PLATFORM_API binding; the loaders take
 * it as a parameter, so a loader test drives the real parsing and view logic with
 * only the proxy edge replaced.
 */
export interface CmsGovernedPageReads {
  /** CMS-03C-10: the review detail; the detail address accepts no query. */
  readonly reviewDetail: (
    request: Request,
    reviewId: string,
  ) => Promise<Response>;
  /** CMS-03C-11: the review queue with its typed query. */
  readonly reviewQueue: (request: Request) => Promise<Response>;
}

/**
 * A GET with only the session headers of the page request and a path of its
 * own: the page's URL-owned state never leaks into a read that does not own it.
 */
const derivedRead = (request: Request, path: string): Request =>
  new Request(new URL(path, request.url), {
    method: 'GET',
    headers: request.headers,
  });

export const createCmsGovernedPageReads = (
  binding: unknown,
): CmsGovernedPageReads => ({
  reviewDetail: (request, reviewId) =>
    forwardCmsGovernedReviewRead(
      'CMS-03C-10',
      derivedRead(
        request,
        `/api/v1/cms/governed-reviews/${encodeURIComponent(reviewId)}`,
      ),
      { reviewId },
      binding,
    ),
  reviewQueue: (request) =>
    forwardCmsGovernedReviewRead('CMS-03C-11', request, {}, binding),
});

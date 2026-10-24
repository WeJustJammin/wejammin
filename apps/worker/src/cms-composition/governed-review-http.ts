import type { CmsGovernedReviewDependencies } from './governed-review-ports';

/** No-store, request id and the credentialed CORS echo of an allowlisted human origin. */
export const governedHeaders = (
  request: Request,
  dependencies: CmsGovernedReviewDependencies,
  requestId: string,
): Headers => {
  const headers = new Headers({
    'cache-control': 'no-store',
    'x-request-id': requestId,
  });
  const origin = request.headers.get('origin');
  if (origin !== null && dependencies.humanOrigins.includes(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
    headers.set('vary', 'Origin');
  }
  return headers;
};

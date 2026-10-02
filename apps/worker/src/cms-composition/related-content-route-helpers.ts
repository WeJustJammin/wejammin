import { ApiErrorSchema } from '@wejammin/contracts';

import type {
  CmsRelatedContentDependencies,
  CmsRelatedContentError,
} from './related-content-types';
import { safeDetails } from './related-content-details';
import { ERROR_CODES, statusOf } from './related-content-response';

export const commonHeaders = (
  request: Request,
  dependencies: CmsRelatedContentDependencies,
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

export const errorResponse = (
  request: Request,
  dependencies: CmsRelatedContentDependencies,
  requestId: string,
  error: CmsRelatedContentError,
  extra?: Headers,
): Response => {
  const status = statusOf(error.status);
  const headers = commonHeaders(request, dependencies, requestId);
  headers.set('content-type', 'application/json; charset=UTF-8');
  if (
    (status === 429 || status === 503 || status === 504) &&
    typeof error.retryAfterSeconds === 'number' &&
    Number.isSafeInteger(error.retryAfterSeconds) &&
    error.retryAfterSeconds > 0
  )
    headers.set('retry-after', String(error.retryAfterSeconds));
  extra?.forEach((value, key) => headers.set(key, value));
  const code = ERROR_CODES[status];
  return new Response(
    JSON.stringify(
      ApiErrorSchema.parse({
        code,
        message: `${code}: related-content operation rejected or unavailable.`,
        requestId,
        details: safeDetails(status, error.details),
      }),
    ),
    { status, headers },
  );
};

import { ApiErrorSchema } from '@wejammin/contracts';

import {
  ERROR_CODES,
  statusOf,
  type CmsTaxonomyDependencies,
  type CmsTaxonomyError,
} from './taxonomy-contracts';
import { noteRefusal } from './observability-facts';
import { taxonomyTermDetails } from './taxonomy-term-details';

export { safeDetails } from './taxonomy-safe-details';

export const commonHeaders = (
  request: Request,
  dependencies: CmsTaxonomyDependencies,
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
  dependencies: CmsTaxonomyDependencies,
  requestId: string,
  error: CmsTaxonomyError,
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
  const details = taxonomyTermDetails(status, error.details);
  // BE03c Observability: the published refusal, reduced to its catalog code and closed members.
  noteRefusal(request, status, details, code);
  return new Response(
    JSON.stringify(
      ApiErrorSchema.parse({
        code,
        message: `${code}: taxonomy operation rejected or unavailable.`,
        requestId,
        details,
      }),
    ),
    { status, headers },
  );
};

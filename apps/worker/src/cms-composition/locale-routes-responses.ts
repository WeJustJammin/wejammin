import { ApiErrorSchema } from '@wejammin/contracts';

import { noteRefusal } from './observability-facts';
import { ERROR_CODES, safeDetails, statusOf } from './locale-routes-support';
import type {
  CmsLocaleDependencies,
  CmsLocaleError,
} from './locale-routes-types';

export const commonHeaders = (
  request: Request,
  dependencies: CmsLocaleDependencies,
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
  dependencies: CmsLocaleDependencies,
  requestId: string,
  error: CmsLocaleError,
  extra?: Headers,
): Response => {
  const status = statusOf(error.status);
  const headers = commonHeaders(request, dependencies, requestId);
  headers.set('content-type', 'application/json; charset=UTF-8');
  const retryAfter = error.retryAfterSeconds;
  if (
    (status === 429 || status === 503 || status === 504) &&
    typeof retryAfter === 'number' &&
    Number.isSafeInteger(retryAfter) &&
    retryAfter > 0
  )
    headers.set('retry-after', String(retryAfter));
  extra?.forEach((value, key) => headers.set(key, value));
  const code = ERROR_CODES[status];
  const details = safeDetails(status, error.details);
  // BE03c Observability: the published refusal, reduced to its catalog code and closed members.
  noteRefusal(request, status, details, code);
  return new Response(
    JSON.stringify(
      ApiErrorSchema.parse({
        code,
        message: `${code}: locale operation rejected or unavailable.`,
        requestId,
        details,
      }),
    ),
    { status, headers },
  );
};

/**
 * The first-party relay of a pattern-definition error. The code and the message
 * must be the composition catalog's for the upstream status (BE03c "Normative
 * application error catalog"); the details are rebuilt by
 * `cms-pattern-platform-details`.
 */
import {
  ApiErrorSchema,
  cmsCompositionCatalogCode,
  cmsCompositionCatalogMessage,
  createRequestId,
} from '@wejammin/contracts';

import { cmsEditorialBoundedResponseJson } from './cms-editorial-platform-bounded';
import { cmsEditorialCopyResponseHeaders } from './cms-editorial-platform-shared';
import {
  PATTERN_DECLARED_STATUSES,
  projectPatternErrorDetails,
  type Details,
  type PatternProxyOperation,
} from './cms-pattern-platform-details';

/** A relay-local refusal in the catalog's exact shape; `details` are already safe. */
export const patternLocalError = (
  request: Request,
  operation: PatternProxyOperation,
  status: number,
  details?: Details,
): Response => {
  const code = cmsCompositionCatalogCode(operation, status) as string;
  const requestId = createRequestId(
    request.headers.get('x-request-id') ?? undefined,
  );
  const headers = new Headers({
    'cache-control': 'no-store',
    'x-request-id': requestId,
  });
  if (status === 429 || status === 503 || status === 504)
    headers.set('retry-after', '5');
  return Response.json(
    ApiErrorSchema.parse({
      code,
      message: cmsCompositionCatalogMessage('composition', code),
      details: details ?? projectPatternErrorDetails(operation, status, {}),
      requestId,
    }),
    { status, headers },
  );
};

/**
 * Relay an upstream error only when it is a real ApiError of the catalog code
 * and message for its status; anything else collapses to a local 502.
 */
export const relayPatternError = async (
  request: Request,
  upstream: Response,
  operation: PatternProxyOperation,
): Promise<Response> => {
  const status = upstream.status;
  if (!PATTERN_DECLARED_STATUSES[operation].has(status))
    return patternLocalError(request, operation, 502);
  const body = await cmsEditorialBoundedResponseJson(upstream);
  if (!body.ok) return patternLocalError(request, operation, 502);
  const parsed = ApiErrorSchema.safeParse(body.value);
  const code = cmsCompositionCatalogCode(operation, status);
  if (
    !parsed.success ||
    code === null ||
    parsed.data.code !== code ||
    parsed.data.message !== cmsCompositionCatalogMessage('composition', code)
  )
    return patternLocalError(request, operation, 502);
  const headers = cmsEditorialCopyResponseHeaders(upstream);
  headers.set('x-request-id', parsed.data.requestId);
  headers.delete('location');
  headers.delete('etag');
  const retryAfter = headers.get('retry-after');
  if (
    retryAfter !== null &&
    (!/^[1-9]\d{0,4}$/u.test(retryAfter) || ![429, 503, 504].includes(status))
  )
    headers.delete('retry-after');
  if (status !== 429)
    for (const name of [
      'ratelimit-limit',
      'ratelimit-remaining',
      'ratelimit-reset',
    ])
      headers.delete(name);
  return new Response(
    JSON.stringify(
      ApiErrorSchema.parse({
        code,
        message: parsed.data.message,
        details: projectPatternErrorDetails(
          operation,
          status,
          parsed.data.details,
        ),
        requestId: parsed.data.requestId,
      }),
    ),
    { status, headers },
  );
};

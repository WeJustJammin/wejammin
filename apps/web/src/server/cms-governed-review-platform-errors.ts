/**
 * The first-party relay of a governed-review error. The code and the message must
 * be the catalog's for the upstream status (BE03c "Normative application error
 * catalog"); the details are rebuilt by `cms-governed-review-platform-error-details`.
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
  GOVERNED_DECLARED_STATUSES,
  STEP_UP_CODE,
  isGovernedStepUp,
  projectGovernedErrorDetails,
  violation,
  type Details,
  type GovernedProxyOperation,
} from './cms-governed-review-platform-error-details';

/**
 * A local refusal in the catalog's exact shape. `violations` are already-safe
 * request pointers; the dependency class is added for 502/503/504.
 */
export const governedLocalError = (
  request: Request,
  operation: GovernedProxyOperation,
  status: number,
  extra: Readonly<{
    violations?: readonly { path: string; code: string }[];
  }> = {},
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
  const details: Details =
    status === 415
      ? { allowedMediaTypes: ['application/json'] }
      : status >= 502 && status <= 504
        ? { dependencyClass: 'cms_composition', retryable: true }
        : extra.violations === undefined || extra.violations.length === 0
          ? {}
          : {
              violations: extra.violations.map((entry) =>
                violation(entry.path, entry.code),
              ),
            };
  return Response.json(
    ApiErrorSchema.parse({
      code,
      message: cmsCompositionCatalogMessage('governedReview', code),
      details,
      requestId,
    }),
    { status, headers },
  );
};

/**
 * Relay an upstream error only when it is a real ApiError of the catalog code
 * and message for its status; anything else collapses to a local 502.
 */
export const relayGovernedError = async (
  request: Request,
  upstream: Response,
  operation: GovernedProxyOperation,
): Promise<Response> => {
  const status = upstream.status;
  if (!GOVERNED_DECLARED_STATUSES[operation].has(status))
    return governedLocalError(request, operation, 502);
  const body = await cmsEditorialBoundedResponseJson(upstream);
  if (!body.ok) return governedLocalError(request, operation, 502);
  const parsed = ApiErrorSchema.safeParse(body.value);
  if (!parsed.success) return governedLocalError(request, operation, 502);
  const code = isGovernedStepUp(operation, status, parsed.data.code)
    ? STEP_UP_CODE
    : cmsCompositionCatalogCode(operation, status);
  if (
    code === null ||
    parsed.data.code !== code ||
    parsed.data.message !== cmsCompositionCatalogMessage('governedReview', code)
  )
    return governedLocalError(request, operation, 502);
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
        details: projectGovernedErrorDetails(
          operation,
          status,
          code,
          parsed.data.details,
        ),
        requestId: parsed.data.requestId,
      }),
    ),
    { status, headers },
  );
};

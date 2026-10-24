/**
 * The first-party relay of a vocabulary error. The code and the message must be the
 * taxonomy catalog's for the upstream status (BE03c "Normative application error
 * catalog", `cms.03c.taxonomy.v1`); the details are rebuilt by
 * `cms-taxonomy-platform-details`.
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
  TAXONOMY_DECLARED_STATUSES,
  projectTaxonomyErrorDetails,
  type Details,
  type TaxonomyProxyOperation,
} from './cms-taxonomy-platform-details';

/** A relay-local refusal in the catalog's exact shape; `details` are already safe. */
export const taxonomyLocalError = (
  request: Request,
  operation: TaxonomyProxyOperation,
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
      message: cmsCompositionCatalogMessage('taxonomy', code),
      details: details ?? projectTaxonomyErrorDetails(operation, status, {}),
      requestId,
    }),
    { status, headers },
  );
};

/**
 * Relay an upstream error only when it is a real ApiError of the catalog code and
 * message for its status; anything else collapses to a local 502.
 */
export const relayTaxonomyError = async (
  request: Request,
  upstream: Response,
  operation: TaxonomyProxyOperation,
): Promise<Response> => {
  const status = upstream.status;
  if (!TAXONOMY_DECLARED_STATUSES[operation].has(status))
    return taxonomyLocalError(request, operation, 502);
  const body = await cmsEditorialBoundedResponseJson(upstream);
  if (!body.ok) return taxonomyLocalError(request, operation, 502);
  const parsed = ApiErrorSchema.safeParse(body.value);
  const code = cmsCompositionCatalogCode(operation, status);
  if (
    !parsed.success ||
    code === null ||
    parsed.data.code !== code ||
    parsed.data.message !== cmsCompositionCatalogMessage('taxonomy', code)
  )
    return taxonomyLocalError(request, operation, 502);
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
        details: projectTaxonomyErrorDetails(
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

import {
  CmsUuidSchema,
  cmsEditorialIfMatchEqualsExpectedVersion,
} from '@wejammin/contracts';

import {
  GOVERNED_PROXY_SPECS,
  type CmsGovernedCommandOperationId,
  type GovernedCommandSpec,
} from './cms-governed-review-platform-command-specs';
import { governedViolationsOf } from './cms-governed-review-platform-error-details';
import {
  governedLocalError,
  relayGovernedError,
} from './cms-governed-review-platform-errors';
import {
  cmsEditorialBoundedRequestJson,
  cmsEditorialBoundedResponseJson,
} from './cms-editorial-platform-bounded';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialCopyResponseHeaders,
  cmsEditorialCsrfCookie,
  cmsEditorialForwardHeaders,
  cmsEditorialOutcomeUnknown,
  cmsEditorialPrintableToken,
  cmsEditorialSameOriginRequest,
  isCmsEditorialPlatformBinding,
  type CmsEditorialPlatformApiBinding,
} from './cms-editorial-platform-shared';

/**
 * Server-only first-party proxy for the three governed-review browser commands:
 * CMS-03C-06 submit, -07 decision, -08 reviewer assignment and -09
 * activation, scheduling or retirement (BE03c rows 168 to 171). The proxy owns transport hygiene only: same-origin, the CSRF double
 * submit, a bounded printable `Idempotency-Key`, the exact strong `If-Match`
 * (none on a submission), JSON media and a locally validated strict body. It
 * never mints or rewrites a key, a version or an authority value; the Worker
 * re-derives all of them. A 2xx it cannot verify is an unknown outcome, so the
 * browser keeps its key and replays the identical request (BE03c 1502).
 */
export type { CmsGovernedCommandOperationId };

export type CmsGovernedCommandParams = Readonly<{
  reviewId?: string | undefined;
}>;

const unknownOutcome = (response: Response): Response =>
  cmsEditorialOutcomeUnknown(response);

const JSON_MEDIA = 'application/json';

const dispatch = async (
  request: Request,
  operation: CmsGovernedCommandOperationId,
  binding: CmsEditorialPlatformApiBinding,
  route: string,
  headers: Headers,
  body: string,
): Promise<Response> => {
  try {
    const upstream = await binding.fetch(
      new Request(`${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${route}`, {
        method: 'POST',
        headers,
        body,
        signal: request.signal,
      }),
    );
    if (upstream instanceof Response) return upstream;
  } catch {
    // A transport loss is an unknown outcome: the command may have committed.
  }
  return unknownOutcome(governedLocalError(request, operation, 503));
};

const forward = async <Body extends object, Resource>(
  spec: GovernedCommandSpec<Body, Resource>,
  request: Request,
  params: CmsGovernedCommandParams,
  binding: unknown,
): Promise<Response> => {
  const operation = spec.operationId;
  if (!isCmsEditorialPlatformBinding(binding) || request.method !== 'POST')
    return governedLocalError(request, operation, 503);
  if (!cmsEditorialSameOriginRequest(request))
    return governedLocalError(request, operation, 403);
  let reviewId: string | null = null;
  if (spec.needsReview) {
    const path = CmsUuidSchema.safeParse(params.reviewId);
    if (!path.success) return governedLocalError(request, operation, 400);
    reviewId = path.data;
  }
  if (new URL(request.url).search !== '')
    return governedLocalError(request, operation, 400);
  const csrf = request.headers.get('x-csrf-token');
  if (
    !cmsEditorialPrintableToken(csrf, 512) ||
    cmsEditorialCsrfCookie(request) !== csrf
  )
    return governedLocalError(request, operation, 403);
  const media = request.headers.get('content-type')?.split(';')[0]?.trim();
  if (media !== JSON_MEDIA) return governedLocalError(request, operation, 415);
  // A submission names its subject by id and hash: any If-Match is a malformed request.
  if (!spec.takesIfMatch && request.headers.has('if-match'))
    return governedLocalError(request, operation, 400);
  const headers = spec.parseHeaders({
    contentType: media,
    idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
    ifMatch: request.headers.get('if-match') ?? undefined,
  });
  if (!headers.success || headers.data === undefined)
    return governedLocalError(request, operation, 400);

  const read = await cmsEditorialBoundedRequestJson(request);
  if (!read.ok) return governedLocalError(request, operation, 400);
  const body = spec.requestSchema.safeParse(read.value);
  if (!body.success)
    return governedLocalError(request, operation, 422, {
      violations: governedViolationsOf(operation, body.error.issues),
    });
  if (!spec.agrees(reviewId, body.data))
    return governedLocalError(request, operation, 422, {
      violations: [{ path: '/reviewId', code: 'mismatch' }],
    });
  const expected = spec.expectedVersion(body.data);
  if (
    expected !== null &&
    !cmsEditorialIfMatchEqualsExpectedVersion(
      headers.data.ifMatch ?? '',
      expected,
    )
  )
    return governedLocalError(request, operation, 400, {
      violations: [{ path: '/expectedVersion', code: 'mismatch' }],
    });

  const forwarded = cmsEditorialForwardHeaders(request);
  forwarded.set('content-type', JSON_MEDIA);
  forwarded.set('x-csrf-token', csrf as string);
  forwarded.set('idempotency-key', headers.data.idempotencyKey);
  if (spec.takesIfMatch && headers.data.ifMatch !== undefined)
    forwarded.set('if-match', headers.data.ifMatch);

  const upstream = await dispatch(
    request,
    operation,
    binding,
    spec.route(reviewId),
    forwarded,
    JSON.stringify(body.data),
  );
  if (upstream.headers.has('x-cms-editorial-outcome')) return upstream;
  if (!upstream.ok) {
    const failure = await relayGovernedError(request, upstream, operation);
    return failure.status >= 500 ? unknownOutcome(failure) : failure;
  }
  const unverified = (): Response =>
    unknownOutcome(governedLocalError(request, operation, 502));
  const answer = await cmsEditorialBoundedResponseJson(upstream);
  if (!answer.ok || upstream.status !== spec.successStatus(body.data))
    return unverified();
  const committed = spec.bound(answer.value, reviewId, body.data);
  if (
    committed === null ||
    upstream.headers.get('etag') !== `"${spec.etagVersion(committed)}"`
  )
    return unverified();
  const location = spec.location(reviewId, body.data, committed);
  if (upstream.headers.get('location') !== location) return unverified();
  const responseHeaders = cmsEditorialCopyResponseHeaders(upstream);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(committed), {
    status: upstream.status,
    headers: responseHeaders,
  });
};

/** Browser-facing transport for a governed-review command; the Worker owns authorization. */
export const forwardCmsGovernedReviewCommand = (
  operationId: CmsGovernedCommandOperationId,
  request: Request,
  params: CmsGovernedCommandParams,
  binding: unknown,
): Promise<Response> =>
  // The four specs share the generic shape; the table picks the one for the operation.
  forward(
    GOVERNED_PROXY_SPECS[operationId] as GovernedCommandSpec<object, object>,
    request,
    params,
    binding,
  );

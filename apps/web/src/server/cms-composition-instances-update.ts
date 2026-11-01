import {
  CompositionUpdateHeadersSchema,
  CompositionUpdateRequestSchema,
  CompositionUpdateResourceSchema,
  createRequestId,
} from '@wejammin/contracts';

import {
  compositionInstancesError,
  forwardedCompositionInstancesError,
} from './cms-composition-instances-errors';
import { answersUpdateRequest } from './cms-composition-instances-update-answer';
import {
  cmsEditorialBoundedRequestJson,
  cmsEditorialBoundedResponseJson,
} from './cms-editorial-platform-bounded';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialCsrfCookie,
  cmsEditorialForwardHeaders,
  cmsEditorialOutcomeUnknown,
  cmsEditorialPrintableToken,
  cmsEditorialSameOriginRequest,
  isCmsEditorialPlatformBinding,
} from './cms-editorial-platform-shared';

const PATH = '/api/v1/cms/compositions/pattern-updates';

/**
 * Server-only first-party proxy for CMS-03C-15 (`POST /api/v1/cms/compositions/pattern-updates`, BE03c 179, DEC-193):
 * accept a pattern update or detach, for 1-32 instances, all or nothing. Transport hygiene only: origin, CSRF, JSON
 * media, an `Idempotency-Key`, the strict request, and an `If-Match` that is the entry `version` the body names.
 * Assignment and edit authority, collision coverage and the all-or-nothing write stay in the Worker. A success the
 * proxy cannot verify against the request may still have committed (BE03c 1502), so it is a local 502 marked as an
 * unknown outcome and the browser replays the identical request under the same key.
 */
export const forwardCmsCompositionPatternUpdate = async (
  request: Request,
  binding: unknown,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding))
    return compositionInstancesError(request, 503);
  if (request.method !== 'POST' || new URL(request.url).search !== '')
    return compositionInstancesError(request, 400);
  if (!cmsEditorialSameOriginRequest(request))
    return compositionInstancesError(request, 403);
  const csrfToken = request.headers.get('x-csrf-token');
  if (
    !cmsEditorialPrintableToken(csrfToken, 512) ||
    cmsEditorialCsrfCookie(request) !== csrfToken
  )
    return compositionInstancesError(request, 403);
  const media = request.headers.get('content-type')?.split(';')[0]?.trim();
  if (media !== 'application/json')
    return compositionInstancesError(request, 415);
  const headers = CompositionUpdateHeadersSchema.safeParse({
    contentType: media,
    idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
    ifMatch: request.headers.get('if-match') ?? undefined,
  });
  if (!headers.success) return compositionInstancesError(request, 400);
  const read = await cmsEditorialBoundedRequestJson(request);
  if (!read.ok) return compositionInstancesError(request, 400);
  const body = CompositionUpdateRequestSchema.safeParse(read.value);
  if (!body.success) return compositionInstancesError(request, 422);
  if (headers.data.ifMatch !== `"${body.data.expectedVersion}"`)
    return compositionInstancesError(request, 400);

  const forwardHeaders = cmsEditorialForwardHeaders(request);
  forwardHeaders.set('content-type', 'application/json');
  forwardHeaders.set('x-csrf-token', csrfToken as string);
  forwardHeaders.set('idempotency-key', headers.data.idempotencyKey);
  forwardHeaders.set('if-match', headers.data.ifMatch);
  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(`${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${PATH}`, {
        method: 'POST',
        headers: forwardHeaders,
        body: JSON.stringify(body.data),
      }),
    );
  } catch {
    return cmsEditorialOutcomeUnknown(compositionInstancesError(request, 503));
  }
  if (!(upstream instanceof Response))
    return cmsEditorialOutcomeUnknown(compositionInstancesError(request, 503));
  if (!upstream.ok)
    return forwardedCompositionInstancesError(request, upstream, 'CMS-03C-15');
  const unverified = (): Response =>
    cmsEditorialOutcomeUnknown(compositionInstancesError(request, 502));
  if (upstream.status !== 200) return unverified();
  const answer = await cmsEditorialBoundedResponseJson(upstream);
  const resource = answer.ok
    ? CompositionUpdateResourceSchema.safeParse(answer.value)
    : null;
  if (
    resource === null ||
    !resource.success ||
    !answersUpdateRequest(
      resource.data,
      upstream.headers.get('etag'),
      body.data,
    )
  )
    return unverified();
  return new Response(JSON.stringify(resource.data), {
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=UTF-8',
      etag: `"${BigInt(body.data.expectedVersion) + 1n}"`,
      'x-request-id': createRequestId(
        upstream.headers.get('x-request-id') ?? undefined,
      ),
    },
  });
};

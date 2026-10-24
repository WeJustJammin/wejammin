import {
  CmsUuidSchema,
  CompositionUpdateDiffResourceSchema,
  createRequestId,
} from '@wejammin/contracts';

import {
  compositionInstancesError,
  forwardedCompositionInstancesError,
} from './cms-composition-instances-errors';
import { cmsEditorialBoundedResponseJson } from './cms-editorial-platform-bounded';
import { readAdmissionStatus } from './cms-editorial-platform-read-admission';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialForwardHeaders,
  cmsEditorialSameOriginRequest,
  isCmsEditorialPlatformBinding,
} from './cms-editorial-platform-shared';

/** BE03c error matrix, CMS-03C-14: a bounded read declares no 409. */
const UNDECLARED: ReadonlySet<number> = new Set([409]);

/**
 * Server-only first-party proxy for CMS-03C-14
 * (`GET /api/v1/cms/compositions/instances/{instanceId}/update-diff`, BE03c 176, DEC-193): the three-way diff of one
 * pattern instance. The instance is addressed by its UUID path alone, so a query (even an empty one), a body, an
 * `Idempotency-Key`, an `If-Match`, a media type and a malformed id never reach the Worker. A 200 is relayed only as
 * the strict resource (which also bounds the diff to 128 paths and 256 KiB) of THIS instance whose strong ETag is the
 * instance `version`. The diff is never cached: every open is a fresh read.
 */
export const readCmsCompositionUpdateDiff = async (
  request: Request,
  instanceId: string | undefined,
  binding: unknown,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding))
    return compositionInstancesError(request, 503);
  if (request.method !== 'GET' || request.url.includes('?'))
    return compositionInstancesError(request, 400);
  const admission = readAdmissionStatus(request);
  if (admission !== null) return compositionInstancesError(request, admission);
  const id = CmsUuidSchema.safeParse(instanceId);
  if (!id.success) return compositionInstancesError(request, 400);
  if (!cmsEditorialSameOriginRequest(request))
    return compositionInstancesError(request, 403);

  let upstream: Response;
  try {
    const answer = await binding.fetch(
      new Request(
        `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}/api/v1/cms/compositions/instances/${id.data}/update-diff`,
        {
          method: 'GET',
          headers: cmsEditorialForwardHeaders(request),
          signal: request.signal,
        },
      ),
    );
    if (!(answer instanceof Response))
      return compositionInstancesError(request, 503);
    upstream = answer;
  } catch {
    return compositionInstancesError(request, 503);
  }
  if (upstream.status !== 200)
    return UNDECLARED.has(upstream.status)
      ? compositionInstancesError(request, 502)
      : forwardedCompositionInstancesError(request, upstream, 'CMS-03C-14');

  const body = await cmsEditorialBoundedResponseJson(upstream);
  const diff = body.ok
    ? CompositionUpdateDiffResourceSchema.safeParse(body.value)
    : null;
  if (
    diff === null ||
    !diff.success ||
    diff.data.instance.id.toLowerCase() !== id.data.toLowerCase() ||
    upstream.headers.get('etag') !== `"${diff.data.instance.version}"`
  )
    return compositionInstancesError(request, 502);
  return new Response(JSON.stringify(diff.data), {
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=UTF-8',
      etag: `"${diff.data.instance.version}"`,
      'x-request-id': createRequestId(
        upstream.headers.get('x-request-id') ?? undefined,
      ),
    },
  });
};

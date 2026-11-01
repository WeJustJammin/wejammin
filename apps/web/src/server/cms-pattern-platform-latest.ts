import {
  CmsPatternKeySchema,
  PatternVersionDetailSchema,
} from '@wejammin/contracts';

import { cmsEditorialBoundedResponseJson } from './cms-editorial-platform-bounded';
import { readAdmissionStatus } from './cms-editorial-platform-read-admission';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialCopyResponseHeaders,
  cmsEditorialForwardHeaders,
  cmsEditorialSameOriginRequest,
  isCmsEditorialPlatformBinding,
} from './cms-editorial-platform-shared';
import {
  patternLocalError,
  relayPatternError,
} from './cms-pattern-platform-errors';

const OPERATION = 'cmsPatternLatestRead';

/**
 * Server-only first-party proxy for `cmsPatternLatestRead`
 * (`GET /api/v1/cms/patterns/{patternKey}`, BE03c): the owner's latest version of
 * the key in any state. The key is addressed by path only, so a query, a body, an
 * `Idempotency-Key`, an `If-Match`, a media type, a malformed key and the reserved
 * keys (`context`, `versions`, `selector`, `new`) are refused here and never reach
 * the Worker. A 200 is relayed only as the strict detail of THIS key whose strong
 * ETag is its version. The Worker owns capability and concealment.
 */
export const readCmsPatternLatest = async (
  request: Request,
  binding: unknown,
  patternKey: string | undefined,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding))
    return patternLocalError(request, OPERATION, 503);
  if (request.method !== 'GET' || new URL(request.url).search !== '')
    return patternLocalError(request, OPERATION, 400);
  const admission = readAdmissionStatus(request);
  if (admission !== null)
    return patternLocalError(request, OPERATION, admission);
  const key = CmsPatternKeySchema.safeParse(patternKey);
  if (!key.success) return patternLocalError(request, OPERATION, 400);
  if (!cmsEditorialSameOriginRequest(request))
    return patternLocalError(request, OPERATION, 403);

  let upstream: Response;
  try {
    const answer = await binding.fetch(
      new Request(
        `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}/api/v1/cms/patterns/${key.data}`,
        {
          method: 'GET',
          headers: cmsEditorialForwardHeaders(request),
          signal: request.signal,
        },
      ),
    );
    if (!(answer instanceof Response))
      return patternLocalError(request, OPERATION, 503);
    upstream = answer;
  } catch {
    return patternLocalError(request, OPERATION, 503);
  }
  if (upstream.status !== 200)
    return relayPatternError(request, upstream, OPERATION);
  const body = await cmsEditorialBoundedResponseJson(upstream);
  const detail = body.ok
    ? PatternVersionDetailSchema.safeParse(body.value)
    : null;
  if (
    detail === null ||
    !detail.success ||
    detail.data.patternKey !== key.data ||
    detail.data.version !== String(detail.data.patternVersion) ||
    upstream.headers.get('etag') !== `"${detail.data.version}"`
  )
    return patternLocalError(request, OPERATION, 502);
  const headers = cmsEditorialCopyResponseHeaders(upstream);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(detail.data), { status: 200, headers });
};

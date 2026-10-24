import {
  createRequestId,
  RelatedContentReadApiRequestSchema,
  RelatedContentRuleReadSchema,
  relatedRuleReadAnswersEntry,
} from '@wejammin/contracts';

import {
  forwardedRelatedContentError,
  relatedContentError,
} from './cms-composition-platform-related';
import { cmsEditorialBoundedResponseJson } from './cms-editorial-platform-bounded';
import { readAdmissionStatus } from './cms-editorial-platform-read-admission';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialForwardHeaders,
  cmsEditorialSameOriginRequest,
  isCmsEditorialPlatformBinding,
} from './cms-editorial-platform-shared';

/**
 * BE03c error matrix, `cmsRelatedContentRead`: a bounded read declares 400, 401, 403, 404, 415, 429, 500 and the
 * dependency statuses. 409 and 422 are "not applicable", so an upstream answer on either has broken its contract.
 */
const UNDECLARED: ReadonlySet<number> = new Set([409, 422]);

/**
 * Server-only first-party proxy for `cmsRelatedContentRead` (`GET /api/v1/cms/entries/{entryId}/related-content`,
 * DEC-195, BE03c): the source entry's current related-content rule, for the curation form. The entry is addressed by
 * path only, so a query (even an empty one), a body, an `Idempotency-Key`, an `If-Match`, a media type and a malformed
 * id are refused here and never reach the Worker; the forwarded headers are the session allowlist, so a browser's
 * conditional headers cannot turn the read into a 304. A 200 is relayed only as the strict `{ rule }` of THIS entry:
 * an `active` rule whose strong ETag is its version, or an explicit null. The Worker owns capability (403, a visible
 * source without edit) and concealment (404).
 */
export const readCmsRelatedContent = async (
  request: Request,
  entryId: string | undefined,
  binding: unknown,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding))
    return relatedContentError(request, 503);
  if (request.method !== 'GET' || request.url.includes('?'))
    return relatedContentError(request, 400);
  const admission = readAdmissionStatus(request);
  if (admission !== null) return relatedContentError(request, admission);
  const path = RelatedContentReadApiRequestSchema.safeParse({ entryId });
  if (!path.success) return relatedContentError(request, 400);
  if (!cmsEditorialSameOriginRequest(request))
    return relatedContentError(request, 403);

  let upstream: Response;
  try {
    const answer = await binding.fetch(
      new Request(
        `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}/api/v1/cms/entries/${path.data.entryId}/related-content`,
        {
          method: 'GET',
          headers: cmsEditorialForwardHeaders(request),
          signal: request.signal,
        },
      ),
    );
    if (!(answer instanceof Response)) return relatedContentError(request, 503);
    upstream = answer;
  } catch {
    return relatedContentError(request, 503);
  }
  if (upstream.status !== 200)
    return UNDECLARED.has(upstream.status)
      ? relatedContentError(request, 502)
      : forwardedRelatedContentError(request, upstream);

  const body = await cmsEditorialBoundedResponseJson(upstream);
  const read = body.ok
    ? RelatedContentRuleReadSchema.safeParse(body.value)
    : null;
  if (read === null || !read.success) return relatedContentError(request, 502);
  const rule = read.data.rule;
  if (
    !relatedRuleReadAnswersEntry(read.data, path.data.entryId) ||
    (rule !== null && upstream.headers.get('etag') !== `"${rule.version}"`)
  )
    return relatedContentError(request, 502);
  const headers = new Headers({
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=UTF-8',
    'x-request-id': createRequestId(
      upstream.headers.get('x-request-id') ?? undefined,
    ),
  });
  if (rule !== null) headers.set('etag', `"${rule.version}"`);
  return new Response(JSON.stringify(read.data), { status: 200, headers });
};

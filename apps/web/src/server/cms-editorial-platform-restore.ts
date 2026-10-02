import {
  EntryRevisionResourceSchema,
  RevisionRestoreHeadersSchema,
  RevisionRestorePathParamsSchema,
  RevisionRestoreRequestSchema,
  editorialRestoreErrors,
} from '@wejammin/contracts';

import {
  cmsEditorialBoundedRequestJson,
  cmsEditorialBoundedResponseJson,
  cmsEditorialForwardedError,
} from './cms-editorial-platform-bounded';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialCopyResponseHeaders,
  cmsEditorialCsrfCookie,
  cmsEditorialForwardHeaders,
  cmsEditorialLocalError,
  cmsEditorialPrintableToken,
  cmsEditorialSameOriginRequest,
  isCmsEditorialPlatformBinding,
} from './cms-editorial-platform-shared';

/** Browser-facing transport for CMS-03B-04; the Worker owns restore authority. */
export const forwardCmsEditorialRevisionRestore = async (
  request: Request,
  entryId: string | undefined,
  revisionId: string | undefined,
  binding: unknown,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding) || request.method !== 'POST')
    return cmsEditorialLocalError(request, 503);
  if (!cmsEditorialSameOriginRequest(request))
    return cmsEditorialLocalError(request, 403);

  const path = RevisionRestorePathParamsSchema.safeParse({
    entryId,
    revisionId,
  });
  if (!path.success || new URL(request.url).search !== '')
    return cmsEditorialLocalError(request, 400);
  const csrfToken = request.headers.get('x-csrf-token');
  if (
    !cmsEditorialPrintableToken(csrfToken, 512) ||
    cmsEditorialCsrfCookie(request) !== csrfToken
  )
    return cmsEditorialLocalError(request, 403);

  const media = request.headers.get('content-type')?.split(';')[0]?.trim();
  if (media !== 'application/json') return cmsEditorialLocalError(request, 415);
  const headers = RevisionRestoreHeadersSchema.safeParse({
    contentType: media,
    idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
    ifMatch: request.headers.get('if-match') ?? undefined,
  });
  if (!headers.success) return cmsEditorialLocalError(request, 400);

  const body = await cmsEditorialBoundedRequestJson(request);
  if (!body.ok) return cmsEditorialLocalError(request, 400);
  const parsed = RevisionRestoreRequestSchema.safeParse(body.value);
  if (
    !parsed.success ||
    parsed.data.entryId !== path.data.entryId ||
    parsed.data.revisionId !== path.data.revisionId
  )
    return cmsEditorialLocalError(request, 422);
  if (headers.data.ifMatch !== `"${parsed.data.expectedVersion}"`)
    return cmsEditorialLocalError(request, 400);

  const route = `/api/v1/cms/entries/${path.data.entryId}/revisions/${path.data.revisionId}/restore`;
  const forwardedHeaders = cmsEditorialForwardHeaders(request);
  forwardedHeaders.set('content-type', 'application/json');
  forwardedHeaders.set('x-csrf-token', csrfToken as string);
  forwardedHeaders.set('idempotency-key', headers.data.idempotencyKey);
  forwardedHeaders.set('if-match', headers.data.ifMatch);

  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(`${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${route}`, {
        method: 'POST',
        headers: forwardedHeaders,
        body: JSON.stringify(parsed.data),
      }),
    );
  } catch {
    return cmsEditorialLocalError(request, 503);
  }
  if (!(upstream instanceof Response))
    return cmsEditorialLocalError(request, 503);
  if (!upstream.ok)
    return cmsEditorialForwardedError(
      request,
      upstream,
      editorialRestoreErrors,
    );
  if (upstream.status !== 201) return cmsEditorialLocalError(request, 502);

  const resource = await cmsEditorialBoundedResponseJson(upstream);
  if (!resource.ok) return cmsEditorialLocalError(request, 502);
  const validated = EntryRevisionResourceSchema.safeParse(resource.value);
  if (!validated.success) return cmsEditorialLocalError(request, 502);
  const revisionRoute = `/api/v1/cms/entries/${path.data.entryId}/revisions/${validated.data.id}`;
  if (
    validated.data.entryId !== path.data.entryId ||
    validated.data.id === path.data.revisionId ||
    validated.data.state !== 'draft' ||
    validated.data.conflictId !== null ||
    upstream.headers.get('etag') !== `"${validated.data.version}"` ||
    upstream.headers.get('location') !== revisionRoute
  )
    return cmsEditorialLocalError(request, 502);
  return new Response(JSON.stringify(validated.data), {
    status: 201,
    statusText: upstream.statusText,
    headers: cmsEditorialCopyResponseHeaders(upstream),
  });
};

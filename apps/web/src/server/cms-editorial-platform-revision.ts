import {
  EntryRevisionHeadersSchema,
  EntryRevisionPathParamsSchema,
  EntryRevisionRequestSchema,
  EntryRevisionResourceSchema,
  editorialRevisionErrors,
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

/** Browser-facing transport for CMS-03B-01; the Worker owns authorization. */
export const forwardCmsEditorialRevisionMutation = async (
  request: Request,
  entryId: string | undefined,
  binding: unknown,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding) || request.method !== 'POST')
    return cmsEditorialLocalError(request, 503);
  if (!cmsEditorialSameOriginRequest(request))
    return cmsEditorialLocalError(request, 403);

  const path = EntryRevisionPathParamsSchema.safeParse({ entryId });
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
  const headers = EntryRevisionHeadersSchema.safeParse({
    contentType: media,
    idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
    ifMatch: request.headers.get('if-match') ?? undefined,
  });
  if (!headers.success) return cmsEditorialLocalError(request, 400);

  const body = await cmsEditorialBoundedRequestJson(request);
  if (!body.ok) return cmsEditorialLocalError(request, 400);
  const parsed = EntryRevisionRequestSchema.safeParse(body.value);
  if (!parsed.success || parsed.data.entryId !== path.data.entryId)
    return cmsEditorialLocalError(request, 422);
  if (headers.data.ifMatch !== `"${parsed.data.expectedVersion}"`)
    return cmsEditorialLocalError(request, 400);

  const route = `/api/v1/cms/entries/${path.data.entryId}/revisions`;
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
      editorialRevisionErrors,
    );

  if (upstream.status !== 201) return cmsEditorialLocalError(request, 502);
  const resource = await cmsEditorialBoundedResponseJson(upstream);
  if (!resource.ok) return cmsEditorialLocalError(request, 502);
  const validated = EntryRevisionResourceSchema.safeParse(resource.value);
  if (
    !validated.success ||
    validated.data.entryId !== path.data.entryId ||
    upstream.headers.get('etag') !== `"${validated.data.version}"` ||
    upstream.headers.get('location') !== `${route}/${validated.data.id}`
  )
    return cmsEditorialLocalError(request, 502);
  return new Response(JSON.stringify(validated.data), {
    status: 201,
    statusText: upstream.statusText,
    headers: cmsEditorialCopyResponseHeaders(upstream),
  });
};

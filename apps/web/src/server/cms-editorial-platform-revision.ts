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
} from './cms-editorial-platform-bounded';
import { CMS_EDITORIAL_DETAIL_POLICIES } from './cms-editorial-platform-error-details';
import {
  cmsEditorialCopyResponseHeaders,
  cmsEditorialForwardHeaders,
  cmsEditorialLocalError,
  cmsEditorialMismatchError,
  cmsEditorialValidationError,
} from './cms-editorial-platform-shared';
import {
  admitCmsEditorialWrite,
  cmsEditorialCsrfToken,
  cmsEditorialJsonMedia,
  cmsEditorialUnverifiedSuccess,
  dispatchCmsEditorialWrite,
  relayCmsEditorialWriteFailure,
} from './cms-editorial-platform-write';

/** Browser-facing transport for CMS-03B-01; the Worker owns authorization. */
export const forwardCmsEditorialRevisionMutation = async (
  request: Request,
  entryId: string | undefined,
  binding: unknown,
): Promise<Response> => {
  const admitted = admitCmsEditorialWrite(request, binding);
  if (admitted instanceof Response) return admitted;

  const path = EntryRevisionPathParamsSchema.safeParse({ entryId });
  if (!path.success)
    return cmsEditorialValidationError(request, 400, path.error.issues);
  if (new URL(request.url).search !== '')
    return cmsEditorialLocalError(request, 400);
  const csrfToken = cmsEditorialCsrfToken(request);
  if (csrfToken instanceof Response) return csrfToken;
  const media = cmsEditorialJsonMedia(request);
  if (media instanceof Response) return media;
  const headers = EntryRevisionHeadersSchema.safeParse({
    contentType: media,
    idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
    ifMatch: request.headers.get('if-match') ?? undefined,
  });
  if (!headers.success)
    return cmsEditorialValidationError(request, 400, headers.error.issues);

  const body = await cmsEditorialBoundedRequestJson(request);
  if (!body.ok) return cmsEditorialLocalError(request, 400);
  const parsed = EntryRevisionRequestSchema.safeParse(body.value);
  if (!parsed.success)
    return cmsEditorialValidationError(request, 422, parsed.error.issues);
  if (parsed.data.entryId !== path.data.entryId)
    return cmsEditorialMismatchError(request, 'entryId');
  if (headers.data.ifMatch !== `"${parsed.data.expectedVersion}"`)
    return cmsEditorialMismatchError(request, 'expectedVersion');

  const route = `/api/v1/cms/entries/${path.data.entryId}/revisions`;
  const forwardedHeaders = cmsEditorialForwardHeaders(request);
  forwardedHeaders.set('content-type', 'application/json');
  forwardedHeaders.set('x-csrf-token', csrfToken);
  forwardedHeaders.set('idempotency-key', headers.data.idempotencyKey);
  forwardedHeaders.set('if-match', headers.data.ifMatch);

  const sent = await dispatchCmsEditorialWrite(
    request,
    admitted.binding,
    route,
    forwardedHeaders,
    JSON.stringify(parsed.data),
  );
  if (sent instanceof Response) return sent;
  const { upstream } = sent;
  if (!upstream.ok)
    return relayCmsEditorialWriteFailure(
      request,
      upstream,
      editorialRevisionErrors,
      CMS_EDITORIAL_DETAIL_POLICIES.valueWrite,
    );

  if (upstream.status !== 201) return cmsEditorialUnverifiedSuccess(request);
  const resource = await cmsEditorialBoundedResponseJson(upstream);
  if (!resource.ok) return cmsEditorialUnverifiedSuccess(request);
  const validated = EntryRevisionResourceSchema.safeParse(resource.value);
  if (
    !validated.success ||
    validated.data.entryId !== path.data.entryId ||
    upstream.headers.get('etag') !== `"${validated.data.entryVersion}"` ||
    upstream.headers.get('location') !== `${route}/${validated.data.id}`
  )
    return cmsEditorialUnverifiedSuccess(request);
  return new Response(JSON.stringify(validated.data), {
    status: 201,
    statusText: upstream.statusText,
    headers: cmsEditorialCopyResponseHeaders(upstream),
  });
};

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

/** Browser-facing transport for CMS-03B-04; the Worker owns restore authority. */
export const forwardCmsEditorialRevisionRestore = async (
  request: Request,
  entryId: string | undefined,
  revisionId: string | undefined,
  binding: unknown,
): Promise<Response> => {
  const admitted = admitCmsEditorialWrite(request, binding);
  if (admitted instanceof Response) return admitted;

  const path = RevisionRestorePathParamsSchema.safeParse({
    entryId,
    revisionId,
  });
  if (!path.success)
    return cmsEditorialValidationError(request, 400, path.error.issues);
  if (new URL(request.url).search !== '')
    return cmsEditorialLocalError(request, 400);
  const csrfToken = cmsEditorialCsrfToken(request);
  if (csrfToken instanceof Response) return csrfToken;
  const media = cmsEditorialJsonMedia(request);
  if (media instanceof Response) return media;
  const headers = RevisionRestoreHeadersSchema.safeParse({
    contentType: media,
    idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
    ifMatch: request.headers.get('if-match') ?? undefined,
  });
  if (!headers.success)
    return cmsEditorialValidationError(request, 400, headers.error.issues);

  const body = await cmsEditorialBoundedRequestJson(request);
  if (!body.ok) return cmsEditorialLocalError(request, 400);
  const parsed = RevisionRestoreRequestSchema.safeParse(body.value);
  if (!parsed.success)
    return cmsEditorialValidationError(request, 422, parsed.error.issues);
  if (parsed.data.entryId !== path.data.entryId)
    return cmsEditorialMismatchError(request, 'entryId');
  if (parsed.data.revisionId !== path.data.revisionId)
    return cmsEditorialMismatchError(request, 'revisionId');
  if (headers.data.ifMatch !== `"${parsed.data.expectedVersion}"`)
    return cmsEditorialMismatchError(request, 'expectedVersion');

  const route = `/api/v1/cms/entries/${path.data.entryId}/revisions/${path.data.revisionId}/restore`;
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
      editorialRestoreErrors,
      CMS_EDITORIAL_DETAIL_POLICIES.restore,
    );
  if (upstream.status !== 201) return cmsEditorialUnverifiedSuccess(request);

  const resource = await cmsEditorialBoundedResponseJson(upstream);
  if (!resource.ok) return cmsEditorialUnverifiedSuccess(request);
  const validated = EntryRevisionResourceSchema.safeParse(resource.value);
  if (!validated.success) return cmsEditorialUnverifiedSuccess(request);
  const revisionRoute = `/api/v1/cms/entries/${path.data.entryId}/revisions/${validated.data.id}`;
  if (
    validated.data.entryId !== path.data.entryId ||
    validated.data.id === path.data.revisionId ||
    validated.data.state !== 'draft' ||
    validated.data.conflictId !== null ||
    upstream.headers.get('etag') !== `"${validated.data.entryVersion}"` ||
    upstream.headers.get('location') !== revisionRoute
  )
    return cmsEditorialUnverifiedSuccess(request);
  return new Response(JSON.stringify(validated.data), {
    status: 201,
    statusText: upstream.statusText,
    headers: cmsEditorialCopyResponseHeaders(upstream),
  });
};

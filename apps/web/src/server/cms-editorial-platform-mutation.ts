import {
  EntryCreateRequestSchema,
  EntryCreateResourceSchema,
  editorialEntryCreateErrors,
} from '@wejammin/contracts';

import {
  cmsEditorialBoundedRequestJson,
  cmsEditorialBoundedResponseJson,
} from './cms-editorial-platform-bounded';
import { CMS_EDITORIAL_DETAIL_POLICIES } from './cms-editorial-platform-error-details';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialCopyResponseHeaders,
  cmsEditorialForwardHeaders,
  cmsEditorialLocalError,
  cmsEditorialPrintableToken,
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

/**
 * Server-only first-party proxy for the locked CMS-03B-10 entry create.
 *
 * Source of truth: apps/web/src/pages/app/cms-content-modeling/index.astro,
 * which forwards CMS-03A-01 through the private `PLATFORM_API` binding, and
 * packages/contracts/src/cms-editorial/routes.ts (CMS-03B-10 policy row).
 *
 * The proxy owns transport hygiene only: same-origin, CSRF cookie/header
 * match, a bounded `Idempotency-Key`, and a locally validated body. It never
 * adds `If-Match` (CMS-03B-10 requires none), never invents authority
 * fields, and never becomes a second authorization layer — the API Worker
 * still verifies the session and derives every authority value.
 *
 * The Astro endpoint at pages/api/v1/cms/entries/index.ts calls this proxy;
 * the protected Worker route remains authoritative and can refuse a missing
 * or mismatched owner-controlled workflow policy.
 */

export const CMS_EDITORIAL_ENTRY_CREATE_PATH = '/api/v1/cms/entries';

const hasNoStore = (response: Response): boolean =>
  response.headers
    .get('cache-control')
    ?.split(',')
    .some((token) => token.trim().toLowerCase() === 'no-store') ?? false;

export const forwardCmsEditorialEntryCreateMutation = async (
  request: Request,
  binding: unknown,
): Promise<Response> => {
  const admitted = admitCmsEditorialWrite(request, binding);
  if (admitted instanceof Response) return admitted;

  // CMS-03B-10 declares no query member, so an undeclared query is refused
  // here rather than dropped on the way to the protected Worker.
  if (new URL(request.url).search !== '')
    return cmsEditorialLocalError(request, 400);

  const csrfToken = cmsEditorialCsrfToken(request);
  if (csrfToken instanceof Response) return csrfToken;
  // The Worker answers valid JSON sent under another media type with a 415; the
  // proxy re-stamps JSON on the way upstream, so it must refuse it here or the
  // Worker's check would be bypassed (AC049).
  const media = cmsEditorialJsonMedia(request);
  if (media instanceof Response) return media;

  const idempotencyKey = request.headers.get('idempotency-key');
  // CMS-03B-10 requires no If-Match and does not include the header in its
  // accepted tuple at all. A caller that supplies one is asking for a
  // semantics this route does not have, so it is refused rather than
  // silently dropped.
  if (request.headers.get('if-match') !== null)
    return cmsEditorialLocalError(request, 400);

  if (
    !cmsEditorialPrintableToken(idempotencyKey, 128) ||
    (idempotencyKey?.length ?? 0) < 8
  )
    return cmsEditorialLocalError(request, 400, undefined, undefined, {
      violations: [
        {
          path: '/idempotencyKey',
          code: 'invalid_value',
          message: 'The value is invalid.',
        },
      ],
    });

  // The body is read under the locked 256 KiB cap before any contract parse,
  // so an oversize payload is refused without being buffered in full.
  const body = await cmsEditorialBoundedRequestJson(request);
  if (!body.ok) return cmsEditorialLocalError(request, 400);
  const parsed = EntryCreateRequestSchema.safeParse(body.value);
  if (!parsed.success)
    return cmsEditorialValidationError(request, 422, parsed.error.issues);

  const headers = cmsEditorialForwardHeaders(request);
  headers.set('content-type', 'application/json');
  headers.set('x-csrf-token', csrfToken);
  headers.set('idempotency-key', idempotencyKey as string);

  const sent = await dispatchCmsEditorialWrite(
    request,
    admitted.binding,
    CMS_EDITORIAL_ENTRY_CREATE_PATH,
    headers,
    JSON.stringify(parsed.data),
  );
  if (sent instanceof Response) return sent;
  const { upstream } = sent;

  if (!upstream.ok)
    return relayCmsEditorialWriteFailure(
      request,
      upstream,
      editorialEntryCreateErrors,
      CMS_EDITORIAL_DETAIL_POLICIES.valueWrite,
    );

  // A create is only a create at 201. The body must be the strict create
  // resource and the Location must resolve to the entry the resource itself
  // names; otherwise this is not the create the contract promises and it must
  // never be relayed as one.
  if (upstream.status !== 201) return cmsEditorialUnverifiedSuccess(request);
  const location = upstream.headers.get('location');
  if (location === null || location.length === 0 || location.length > 2_048)
    return cmsEditorialUnverifiedSuccess(request);
  const resource = await cmsEditorialBoundedResponseJson(upstream);
  if (!resource.ok) return cmsEditorialUnverifiedSuccess(request);
  const parsedResource = EntryCreateResourceSchema.safeParse(resource.value);
  if (!parsedResource.success) return cmsEditorialUnverifiedSuccess(request);
  const expectedLocation = `${CMS_EDITORIAL_ENTRY_CREATE_PATH}/${parsedResource.data.entry.id}`;
  const locationIsCanonical = (() => {
    try {
      const target = new URL(location, CMS_EDITORIAL_PLATFORM_API_ORIGIN);
      return (
        target.origin === CMS_EDITORIAL_PLATFORM_API_ORIGIN &&
        target.pathname === expectedLocation &&
        target.search === '' &&
        target.hash === ''
      );
    } catch {
      return false;
    }
  })();
  if (
    !locationIsCanonical ||
    upstream.headers.get('etag') !== `"${parsedResource.data.entry.version}"` ||
    !hasNoStore(upstream)
  )
    return cmsEditorialUnverifiedSuccess(request);
  return new Response(JSON.stringify(parsedResource.data), {
    status: 201,
    statusText: upstream.statusText,
    headers: cmsEditorialCopyResponseHeaders(upstream),
  });
};

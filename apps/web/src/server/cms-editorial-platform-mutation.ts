import {
  EntryCreateRequestSchema,
  EntryCreateResourceSchema,
  editorialEntryCreateErrors,
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

export const forwardCmsEditorialEntryCreateMutation = async (
  request: Request,
  binding: unknown,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding) || request.method !== 'POST')
    return cmsEditorialLocalError(request, 503);
  if (!cmsEditorialSameOriginRequest(request))
    return cmsEditorialLocalError(request, 403);

  // CMS-03B-10 declares no query member, so an undeclared query is refused
  // here rather than dropped on the way to the protected Worker.
  if (new URL(request.url).search !== '')
    return cmsEditorialLocalError(request, 400);

  const csrfToken = request.headers.get('x-csrf-token');
  if (
    !cmsEditorialPrintableToken(csrfToken, 512) ||
    cmsEditorialCsrfCookie(request) !== csrfToken
  )
    return cmsEditorialLocalError(request, 403);

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
    return cmsEditorialLocalError(request, 400);

  // The body is read under the locked 256 KiB cap before any contract parse,
  // so an oversize payload is refused without being buffered in full.
  const body = await cmsEditorialBoundedRequestJson(request);
  if (!body.ok) return cmsEditorialLocalError(request, 400);
  const parsed = EntryCreateRequestSchema.safeParse(body.value);
  if (!parsed.success) return cmsEditorialLocalError(request, 422);

  const headers = cmsEditorialForwardHeaders(request);
  headers.set('content-type', 'application/json');
  headers.set('x-csrf-token', csrfToken as string);
  headers.set('idempotency-key', idempotencyKey as string);

  let upstream: Response;
  try {
    upstream = await binding.fetch(
      new Request(
        `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${CMS_EDITORIAL_ENTRY_CREATE_PATH}`,
        { method: 'POST', headers, body: JSON.stringify(parsed.data) },
      ),
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
      editorialEntryCreateErrors,
    );

  // A create is only a create at 201. The body must be the strict create
  // resource and the Location must resolve to the entry the resource itself
  // names; otherwise this is not the create the contract promises and it must
  // never be relayed as one.
  if (upstream.status !== 201) return cmsEditorialLocalError(request, 502);
  const location = upstream.headers.get('location');
  if (location === null || location.length === 0 || location.length > 2_048)
    return cmsEditorialLocalError(request, 502);
  const resource = await cmsEditorialBoundedResponseJson(upstream);
  if (!resource.ok) return cmsEditorialLocalError(request, 502);
  const parsedResource = EntryCreateResourceSchema.safeParse(resource.value);
  if (!parsedResource.success) return cmsEditorialLocalError(request, 502);
  const locationTarget = location.split('?')[0] ?? '';
  if (!locationTarget.endsWith('/' + parsedResource.data.entry.id))
    return cmsEditorialLocalError(request, 502);
  return new Response(JSON.stringify(parsedResource.data), {
    status: 201,
    statusText: upstream.statusText,
    headers: cmsEditorialCopyResponseHeaders(upstream),
  });
};

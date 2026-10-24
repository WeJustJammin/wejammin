import {
  TaxonomyVersionHeadersSchema,
  TaxonomyVersionRequestSchema,
  TaxonomyVersionResourceSchema,
  type TaxonomyVersionRequest,
} from '@wejammin/contracts';

import {
  cmsEditorialBoundedRequestJson,
  cmsEditorialBoundedResponseJson,
} from './cms-editorial-platform-bounded';
import {
  CMS_EDITORIAL_PLATFORM_API_ORIGIN,
  cmsEditorialCopyResponseHeaders,
  cmsEditorialCsrfCookie,
  cmsEditorialForwardHeaders,
  cmsEditorialOutcomeUnknown,
  cmsEditorialPrintableToken,
  cmsEditorialSameOriginRequest,
  isCmsEditorialPlatformBinding,
} from './cms-editorial-platform-shared';
import { taxonomyViolationsOf } from './cms-taxonomy-platform-details';
import {
  relayTaxonomyError,
  taxonomyLocalError,
} from './cms-taxonomy-platform-errors';

/**
 * Server-only first-party proxy for CMS-03C-16 (`POST /api/v1/cms/taxonomies/versions`,
 * BE03c). It owns transport hygiene only: same-origin, the CSRF double submit, JSON
 * media, a bounded printable `Idempotency-Key`, the exact strong `If-Match` that names
 * `expectedVersion` (none on a first version) and a locally validated strict body. It
 * never mints or rewrites a key, a version or an authority value; the Worker re-derives
 * all of them. A 2xx it cannot bind to this request, a 5xx and a transport loss are an
 * unknown outcome: the browser keeps its key and replays the identical request
 * (BE03c 1502).
 */
const OPERATION = 'CMS-03C-16';
const PATH = '/api/v1/cms/taxonomies/versions';
const JSON_MEDIA = 'application/json';

const sameList = (left: readonly string[], right: readonly string[]): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/** The draft that answers THIS request: its key, its parent + 1, its rules exactly as written. */
const answers = (
  body: TaxonomyVersionRequest,
  resource: ReturnType<typeof TaxonomyVersionResourceSchema.parse>,
): boolean =>
  resource.state === 'draft' &&
  resource.taxonomyKey === body.taxonomyKey &&
  resource.version === String(resource.taxonomyVersion) &&
  BigInt(resource.version) === BigInt(body.expectedVersion ?? '0') + 1n &&
  resource.shape === body.shape &&
  sameList(resource.allowedTypeKeys, body.allowedTypeKeys) &&
  sameList(resource.allowedFieldKeys, body.allowedFieldKeys) &&
  sameList(resource.canonicalOverlapDomains, body.canonicalOverlapDomains);

/** Browser-facing transport for CMS-03C-16; the Worker owns authorization. */
export const forwardCmsTaxonomyVersionWrite = async (
  request: Request,
  binding: unknown,
): Promise<Response> => {
  const refuse = (status: number, details?: Record<string, unknown>) =>
    taxonomyLocalError(request, OPERATION, status, details);
  if (!isCmsEditorialPlatformBinding(binding)) return refuse(503);
  if (request.method !== 'POST' || new URL(request.url).search !== '')
    return refuse(400);
  if (!cmsEditorialSameOriginRequest(request)) return refuse(403);
  const csrf = request.headers.get('x-csrf-token');
  if (
    !cmsEditorialPrintableToken(csrf, 512) ||
    cmsEditorialCsrfCookie(request) !== csrf
  )
    return refuse(403);
  const media = request.headers.get('content-type')?.split(';')[0]?.trim();
  if (media !== JSON_MEDIA) return refuse(415);
  const headers = TaxonomyVersionHeadersSchema.safeParse({
    contentType: media,
    idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
    ifMatch: request.headers.get('if-match') ?? undefined,
  });
  if (!headers.success) return refuse(400);
  const read = await cmsEditorialBoundedRequestJson(request);
  if (!read.ok) return refuse(400);
  const body = TaxonomyVersionRequestSchema.safeParse(read.value);
  if (!body.success)
    return refuse(422, {
      violations: taxonomyViolationsOf(OPERATION, body.error.issues),
    });
  const ifMatch = headers.data.ifMatch?.slice(1, -1) ?? null;
  if (
    (body.data.expectedVersion === null) !== (ifMatch === null) ||
    (ifMatch !== null && ifMatch !== body.data.expectedVersion)
  )
    return refuse(400);

  const forwarded = cmsEditorialForwardHeaders(request);
  forwarded.set('content-type', JSON_MEDIA);
  forwarded.set('x-csrf-token', csrf as string);
  forwarded.set('idempotency-key', headers.data.idempotencyKey);
  if (headers.data.ifMatch !== undefined)
    forwarded.set('if-match', headers.data.ifMatch);
  const unverified = (): Response => cmsEditorialOutcomeUnknown(refuse(502));
  let upstream: Response;
  try {
    const answer = await binding.fetch(
      new Request(`${CMS_EDITORIAL_PLATFORM_API_ORIGIN}${PATH}`, {
        method: 'POST',
        headers: forwarded,
        body: JSON.stringify(body.data),
        signal: request.signal,
      }),
    );
    if (!(answer instanceof Response))
      return cmsEditorialOutcomeUnknown(refuse(503));
    upstream = answer;
  } catch {
    // A transport loss is an unknown outcome: the command may have committed.
    return cmsEditorialOutcomeUnknown(refuse(503));
  }
  if (!upstream.ok) {
    const failure = await relayTaxonomyError(request, upstream, OPERATION);
    return failure.status >= 500
      ? cmsEditorialOutcomeUnknown(failure)
      : failure;
  }
  if (upstream.status !== 201) return unverified();
  const answer = await cmsEditorialBoundedResponseJson(upstream);
  if (!answer.ok) return unverified();
  const resource = TaxonomyVersionResourceSchema.safeParse(answer.value);
  if (
    !resource.success ||
    !answers(body.data, resource.data) ||
    upstream.headers.get('etag') !== `"${resource.data.version}"`
  )
    return unverified();
  const responseHeaders = cmsEditorialCopyResponseHeaders(upstream);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  responseHeaders.delete('location');
  return new Response(JSON.stringify(resource.data), {
    status: 201,
    headers: responseHeaders,
  });
};

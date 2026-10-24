import {
  CmsLineageIdSchema,
  TaxonomyTermActionHeadersSchema,
  TaxonomyTermActionRequestSchema,
  TaxonomyTermResourceSchema,
  type TaxonomyTermActionRequest,
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
 * Server-only first-party proxy for CMS-03C-03 (`POST /api/v1/cms/taxonomies/{taxonomyId}/
 * terms/actions`, BE03c). It owns transport hygiene only: same-origin, the CSRF double
 * submit, JSON media, a bounded `Idempotency-Key`, the exact strong `If-Match` that names
 * `expectedVersion` (the vocabulary's active version) and a locally validated strict body
 * that names the same vocabulary as the path. The Worker owns the curator capability, the
 * active-version rule, the canonical overlap check and the term locks. A 2xx it cannot
 * bind to this request, a 5xx and a transport loss are an unknown outcome.
 */
const OPERATION = 'CMS-03C-03';
const JSON_MEDIA = 'application/json';

/**
 * The term the Worker's own binding accepts for THIS action (BE03c 1377): the term row's
 * own version (1 on create, later after any other action), the stored lifecycle, the
 * requested parent only on create and rename (the other actions keep the stored one) and
 * the survivor as the successor of a merge, nothing else.
 */
const answers = (
  body: TaxonomyTermActionRequest,
  term: ReturnType<typeof TaxonomyTermResourceSchema.parse>,
): boolean => {
  const first = body.action === 'create';
  const lifecycles: readonly string[] =
    body.action === 'merge'
      ? ['merged']
      : body.action === 'deprecate'
        ? ['deprecated']
        : first
          ? ['active']
          : ['active', 'deprecated'];
  return (
    term.taxonomyId === body.taxonomyId &&
    term.id === term.termId &&
    term.termKey === body.termKey &&
    (first || body.action === 'rename'
      ? term.parentId === body.parentId
      : true) &&
    term.successorId === (body.action === 'merge' ? body.survivorId : null) &&
    lifecycles.includes(term.lifecycle) &&
    (first ? term.version === '1' : BigInt(term.version) >= 2n)
  );
};

/** Browser-facing transport for CMS-03C-03; the Worker owns authorization. */
export const forwardCmsTaxonomyTermAction = async (
  request: Request,
  binding: unknown,
  taxonomyId: string | undefined,
): Promise<Response> => {
  const refuse = (status: number, details?: Record<string, unknown>) =>
    taxonomyLocalError(request, OPERATION, status, details);
  if (!isCmsEditorialPlatformBinding(binding)) return refuse(503);
  if (request.method !== 'POST' || new URL(request.url).search !== '')
    return refuse(400);
  const lineage = CmsLineageIdSchema.safeParse(taxonomyId);
  if (!lineage.success) return refuse(400);
  if (!cmsEditorialSameOriginRequest(request)) return refuse(403);
  const csrf = request.headers.get('x-csrf-token');
  if (
    !cmsEditorialPrintableToken(csrf, 512) ||
    cmsEditorialCsrfCookie(request) !== csrf
  )
    return refuse(403);
  const media = request.headers.get('content-type')?.split(';')[0]?.trim();
  if (media !== JSON_MEDIA) return refuse(415);
  const headers = TaxonomyTermActionHeadersSchema.safeParse({
    contentType: media,
    idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
    ifMatch: request.headers.get('if-match') ?? undefined,
  });
  if (!headers.success) return refuse(400);
  const read = await cmsEditorialBoundedRequestJson(request);
  if (!read.ok) return refuse(400);
  const body = TaxonomyTermActionRequestSchema.safeParse(read.value);
  if (!body.success)
    return refuse(422, {
      violations: taxonomyViolationsOf(OPERATION, body.error.issues),
    });
  if (
    body.data.taxonomyId !== lineage.data ||
    headers.data.ifMatch.slice(1, -1) !== body.data.expectedVersion
  )
    return refuse(400);

  const forwarded = cmsEditorialForwardHeaders(request);
  forwarded.set('content-type', JSON_MEDIA);
  forwarded.set('x-csrf-token', csrf as string);
  forwarded.set('idempotency-key', headers.data.idempotencyKey);
  forwarded.set('if-match', headers.data.ifMatch);
  const unverified = (): Response => cmsEditorialOutcomeUnknown(refuse(502));
  let upstream: Response;
  try {
    const answer = await binding.fetch(
      new Request(
        `${CMS_EDITORIAL_PLATFORM_API_ORIGIN}/api/v1/cms/taxonomies/${lineage.data}/terms/actions`,
        {
          method: 'POST',
          headers: forwarded,
          body: JSON.stringify(body.data),
          signal: request.signal,
        },
      ),
    );
    if (!(answer instanceof Response))
      return cmsEditorialOutcomeUnknown(refuse(503));
    upstream = answer;
  } catch {
    // A transport loss is an unknown outcome: the action may have committed.
    return cmsEditorialOutcomeUnknown(refuse(503));
  }
  if (!upstream.ok) {
    const failure = await relayTaxonomyError(request, upstream, OPERATION);
    return failure.status >= 500
      ? cmsEditorialOutcomeUnknown(failure)
      : failure;
  }
  if (upstream.status !== 200) return unverified();
  const answer = await cmsEditorialBoundedResponseJson(upstream);
  if (!answer.ok) return unverified();
  const term = TaxonomyTermResourceSchema.safeParse(answer.value);
  if (
    !term.success ||
    !answers(body.data, term.data) ||
    upstream.headers.get('etag') !== `"${term.data.version}"`
  )
    return unverified();
  const responseHeaders = cmsEditorialCopyResponseHeaders(upstream);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  responseHeaders.delete('location');
  return new Response(JSON.stringify(term.data), {
    status: 200,
    headers: responseHeaders,
  });
};

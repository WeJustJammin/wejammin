import {
  PatternVersionHeadersSchema,
  PatternVersionRequestSchema,
  PatternVersionResourceSchema,
  countPatternNodes,
  type PatternVersionRequest,
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
import {
  PATTERN_KEY_POINTER,
  patternViolationsOf,
  reservedKeyDetails,
} from './cms-pattern-platform-details';
import {
  patternLocalError,
  relayPatternError,
} from './cms-pattern-platform-errors';

/**
 * Server-only first-party proxy for CMS-03C-12 (`POST /api/v1/cms/patterns/versions`,
 * BE03c). It owns transport hygiene only: same-origin, the CSRF double submit, JSON
 * media, a bounded printable `Idempotency-Key`, the exact strong `If-Match` that
 * names `expectedVersion` (none on a first version) and a locally validated strict
 * body. It never mints or rewrites a key, a version, a digest or an authority
 * value; the Worker re-derives all of them. A 2xx it cannot bind to this request,
 * and a transport loss, are an unknown outcome: the browser keeps its key and
 * replays the identical request (BE03c 1502).
 */
const OPERATION = 'CMS-03C-12';
const PATH = '/api/v1/cms/patterns/versions';
const JSON_MEDIA = 'application/json';

const unknownOutcome = (response: Response): Response =>
  cmsEditorialOutcomeUnknown(response);

/** The draft that answers THIS request: its key, its parent + 1, its types, a tree no smaller than written. */
const answers = (
  body: PatternVersionRequest,
  resource: ReturnType<typeof PatternVersionResourceSchema.parse>,
): boolean =>
  resource.state === 'draft' &&
  resource.patternKey === body.patternKey &&
  resource.version === String(resource.patternVersion) &&
  BigInt(resource.version) === BigInt(body.expectedVersion ?? '0') + 1n &&
  resource.compatibleTypeIds.join('\u0000') ===
    body.compatibleTypeIds.join('\u0000') &&
  resource.nodeCount >= countPatternNodes(body.blockTree) &&
  (body.blockRegistryDigest === undefined ||
    resource.blockRegistryDigest === body.blockRegistryDigest);

/** Browser-facing transport for CMS-03C-12; the Worker owns authorization. */
export const forwardCmsPatternVersionWrite = async (
  request: Request,
  binding: unknown,
): Promise<Response> => {
  if (!isCmsEditorialPlatformBinding(binding))
    return patternLocalError(request, OPERATION, 503);
  if (request.method !== 'POST' || new URL(request.url).search !== '')
    return patternLocalError(request, OPERATION, 400);
  if (!cmsEditorialSameOriginRequest(request))
    return patternLocalError(request, OPERATION, 403);
  const csrf = request.headers.get('x-csrf-token');
  if (
    !cmsEditorialPrintableToken(csrf, 512) ||
    cmsEditorialCsrfCookie(request) !== csrf
  )
    return patternLocalError(request, OPERATION, 403);
  const media = request.headers.get('content-type')?.split(';')[0]?.trim();
  if (media !== JSON_MEDIA) return patternLocalError(request, OPERATION, 415);
  const headers = PatternVersionHeadersSchema.safeParse({
    contentType: media,
    idempotencyKey: request.headers.get('idempotency-key') ?? undefined,
    ifMatch: request.headers.get('if-match') ?? undefined,
  });
  if (!headers.success) return patternLocalError(request, OPERATION, 400);
  const read = await cmsEditorialBoundedRequestJson(request);
  if (!read.ok) return patternLocalError(request, OPERATION, 400);
  const body = PatternVersionRequestSchema.safeParse(read.value);
  if (!body.success) {
    const reserved = body.error.issues.some(
      (issue) =>
        issue.message === 'key_reserved' &&
        issue.path.length === 1 &&
        issue.path[0] === PATTERN_KEY_POINTER.slice(1),
    );
    return patternLocalError(
      request,
      OPERATION,
      422,
      reserved
        ? reservedKeyDetails()
        : { violations: patternViolationsOf(OPERATION, body.error.issues) },
    );
  }
  const ifMatch = headers.data.ifMatch?.slice(1, -1) ?? null;
  if (
    (body.data.expectedVersion === null) !== (ifMatch === null) ||
    (ifMatch !== null && ifMatch !== body.data.expectedVersion)
  )
    return patternLocalError(request, OPERATION, 400);

  const forwarded = cmsEditorialForwardHeaders(request);
  forwarded.set('content-type', JSON_MEDIA);
  forwarded.set('x-csrf-token', csrf as string);
  forwarded.set('idempotency-key', headers.data.idempotencyKey);
  if (headers.data.ifMatch !== undefined)
    forwarded.set('if-match', headers.data.ifMatch);
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
      return unknownOutcome(patternLocalError(request, OPERATION, 503));
    upstream = answer;
  } catch {
    // A transport loss is an unknown outcome: the command may have committed.
    return unknownOutcome(patternLocalError(request, OPERATION, 503));
  }
  if (!upstream.ok) {
    const failure = await relayPatternError(request, upstream, OPERATION);
    return failure.status >= 500 ? unknownOutcome(failure) : failure;
  }
  const unverified = (): Response =>
    unknownOutcome(patternLocalError(request, OPERATION, 502));
  if (upstream.status !== 201) return unverified();
  const answer = await cmsEditorialBoundedResponseJson(upstream);
  if (!answer.ok) return unverified();
  const resource = PatternVersionResourceSchema.safeParse(answer.value);
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

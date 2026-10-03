import {
  EntryDraftDetailQuerySchema,
  EntryDraftDetailResourceSchema,
  cmsEditorialRoutePolicies,
  createRequestId,
} from '@wejammin/contracts';
import { type Env, Hono } from 'hono';

import { parseRequestPathId } from './admission-body';
import { invalid, issues, unsupportedMediaType } from './admission-common';
import {
  dependencyDeadline,
  dependencyUnavailable,
  dependencyTimedOut,
} from './admission-deadline';
import { checkOrigin } from './admission-headers';
import {
  requireEditorialCapability,
  validHumanSession,
} from './admission-identity';
import { emitTelemetry, rateCheck } from './route-execution';
import { commonHeaders, errorResponse } from './routes';
import {
  CMS_EDITORIAL_DRAFT_DETAIL_OPERATION_ID,
  CMS_EDITORIAL_RUNBOOK,
  type CmsEditorialDependencies,
  type CmsEditorialDraftPortInput,
  type CmsEditorialError,
  type CmsEditorialResult,
} from './types';

const PATH = '/api/v1/cms/entries/:entryId';
const policy = cmsEditorialRoutePolicies.find(
  (item) => item.operationId === CMS_EDITORIAL_DRAFT_DETAIL_OPERATION_ID,
) as (typeof cmsEditorialRoutePolicies)[number];

const parseDraftQuery = (request: Request, entryId: string) => {
  const query: Record<string, unknown> = { entryId };
  for (const [key, value] of new URL(request.url).searchParams) {
    if (key !== 'locale' || Object.hasOwn(query, key))
      return invalid('The draft-detail query is invalid.');
    query[key] = value;
  }
  // BE03b binds the 03b-11 `malformed path/query` class to 400 and reserves
  // 422 for `response/field bounds`; the only addressable query member is a
  // bounded BCP 47 `locale`, so a failed parse here is structural input, not a
  // semantic lookup failure. `invalid` therefore keeps its 400 default, which
  // matches the sibling CMS-03B-03 read under one shared locale grammar.
  const parsed = EntryDraftDetailQuerySchema.safeParse(query);
  return parsed.success
    ? { ok: true as const, value: parsed.data }
    : invalid(
        'The draft-detail query failed validation.',
        issues(parsed.error),
      );
};

/** BE00 step 2: a read accepts no request media, so the allowlist is empty. */
const readMediaError = (request: Request): CmsEditorialError | null =>
  request.headers.has('content-type') ? unsupportedMediaType([]) : null;

const readHeadersError = (request: Request): CmsEditorialError | null => {
  if (request.headers.has('idempotency-key') || request.headers.has('if-match'))
    return invalid('The draft-detail request headers are invalid.');
  const contentLength = request.headers.get('content-length');
  if (
    request.body !== null ||
    request.headers.has('transfer-encoding') ||
    (contentLength !== null && contentLength !== '0')
  )
    return invalid('A draft-detail read has no request body.');
  return null;
};

/** CMS-03B-11 is a read-only boundary; the private RPC validates active-schema
 * fields and relation visibility, refusing unsupported projections. */
export const registerCmsEditorialDetailRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void => {
  app.options(PATH, (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const originError = checkOrigin(request, dependencies.humanOrigins);
    if (originError !== null || request.headers.get('origin') === null)
      return errorResponse(
        request,
        dependencies,
        requestId,
        originError ?? {
          ok: false,
          status: 403,
          code: 'FORBIDDEN',
          message: 'A request origin is required.',
        },
      );
    const headers = commonHeaders(request, dependencies, requestId);
    headers.set('access-control-allow-methods', 'GET, OPTIONS');
    headers.set('access-control-allow-headers', 'Authorization, X-Request-Id');
    return new Response(null, { status: 204, headers });
  });

  app.get(PATH, async (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const startedAt = dependencies.now?.() ?? Date.now();
    const deadlineAt =
      performance.now() + (dependencies.deadlineMs ?? policy.timeoutMs);
    const withinDeadline = <T>(
      invoke: (signal: AbortSignal) => Promise<CmsEditorialResult<T>>,
    ): Promise<CmsEditorialResult<T>> => {
      const remainingMs = Math.ceil(deadlineAt - performance.now());
      return remainingMs <= 0
        ? Promise.resolve(dependencyTimedOut())
        : dependencyDeadline(invoke, remainingMs);
    };
    const finish = async (response: Response): Promise<Response> => {
      void emitTelemetry(dependencies, {
        operationId: CMS_EDITORIAL_DRAFT_DETAIL_OPERATION_ID,
        requestId,
        outcome:
          response.status < 400
            ? 'success'
            : response.status < 500
              ? 'rejected'
              : 'failure',
        status: response.status,
        durationMs: Math.max(
          0,
          (dependencies.now?.() ?? Date.now()) - startedAt,
        ),
        actorClass: 'human',
        runbook: CMS_EDITORIAL_RUNBOOK,
      });
      return response;
    };
    const fail = (error: CmsEditorialError, headers?: Headers) =>
      finish(errorResponse(request, dependencies, requestId, error, headers));

    // BE00 step 2: CORS origin and request media.
    const originError = checkOrigin(request, dependencies.humanOrigins);
    if (originError !== null) return fail(originError);
    const mediaError = readMediaError(request);
    if (mediaError !== null) return fail(mediaError);
    // BE00 steps 4 and 5: verified session, then acting context.
    const identity = await withinDeadline((signal) =>
      dependencies.resolveSession(request, signal),
    );
    if (!identity.ok) return fail(identity);
    const invalidSession = validHumanSession(identity.value);
    if (invalidSession !== null) return fail(invalidSession);
    // BE00 step 6: strict path, headers, body absence and query.
    const path = parseRequestPathId(context.req.param('entryId'));
    if (!path.ok) return fail(path);
    const headersError = readHeadersError(request);
    if (headersError !== null) return fail(headersError);
    const query = parseDraftQuery(request, path.value);
    if (!query.ok) return fail(query);
    // BE00 step 7: capability, then quota.
    const capabilityError = requireEditorialCapability(
      identity.value,
      policy.capabilities,
      policy.capabilityMode,
    );
    if (capabilityError !== null) return fail(capabilityError);
    const rate = await rateCheck(
      request,
      dependencies,
      identity.value,
      policy,
      deadlineAt,
    );
    if (!rate.ok) {
      const rateHeaders = new Headers();
      if (rate.status === 429) {
        const limit = rate.details?.limit;
        rateHeaders.set(
          'ratelimit-limit',
          String(typeof limit === 'number' ? limit : policy.rateLimit),
        );
        rateHeaders.set('ratelimit-remaining', '0');
      }
      return fail(rate, rateHeaders);
    }

    const getEntryDraft = dependencies.ports.getEntryDraft;
    if (typeof getEntryDraft !== 'function')
      return fail(dependencyUnavailable());
    const input: CmsEditorialDraftPortInput = {
      operationId: CMS_EDITORIAL_DRAFT_DETAIL_OPERATION_ID,
      requestId,
      request,
      session: identity.value,
      path: { entryId: path.value },
      query: query.value,
    };
    const result = await withinDeadline((signal) =>
      getEntryDraft(input, signal),
    );
    if (!result.ok) return fail(result);
    const parsed = EntryDraftDetailResourceSchema.safeParse(result.value);
    if (
      !parsed.success ||
      parsed.data.entry.id !== path.value ||
      parsed.data.lifecycle !== 'active' ||
      parsed.data.state !== 'draft' ||
      (query.value.locale !== undefined &&
        parsed.data.locale !== query.value.locale)
    )
      return fail({
        ok: false,
        status: 502,
        code: 'BAD_GATEWAY',
        message: 'The CMS editorial dependency returned invalid data.',
      });
    const resource = parsed.data;
    const body = JSON.stringify(resource);
    let representationHash: string;
    try {
      const preimage = JSON.stringify({
        actorId: identity.value.userId,
        actingPartyId: identity.value.actingPartyId,
        body,
      });
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(preimage),
      );
      representationHash = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      return fail({
        ok: false,
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'The CMS editorial response could not be prepared.',
      });
    }
    const headers = commonHeaders(request, dependencies, requestId);
    headers.set('content-type', 'application/json; charset=UTF-8');
    headers.set(
      'etag',
      `"${resource.entry.id}:${resource.entry.version}:${resource.revision.id}:${resource.revision.version}:${representationHash}"`,
    );
    return finish(new Response(body, { status: 200, headers }));
  });
};

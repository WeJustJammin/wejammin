import {
  ConflictResolutionHeadersSchema,
  ConflictResolutionRequestSchema,
  EntryRevisionResourceSchema,
  cmsEditorialRoutePolicies,
  createRequestId,
} from '@wejammin/contracts';
import { Hono, type Env } from 'hono';

import { invalid, rejectCommandQuery } from './admission-common';
import {
  decodeJsonBody,
  jsonBodyPreflight,
  parseRequestPathId,
  readBytes,
} from './admission-body';
import {
  checkOrigin,
  csrfErrorIfCookie,
  parseEditorialHeaders,
} from './admission-headers';
import {
  requireEditorialCapability,
  validHumanSession,
} from './admission-identity';
import {
  dependencyDeadline,
  dependencyTimedOut,
  dependencyUnavailable,
} from './admission-deadline';
import { emitTelemetry, rateCheck } from './route-execution';
import { commonHeaders, errorResponse } from './routes';
import {
  CMS_EDITORIAL_CONFLICT_OPERATION_ID,
  CMS_EDITORIAL_RUNBOOK,
  type CmsEditorialConflictPortInput,
  type CmsEditorialDependencies,
  type CmsEditorialError,
  type CmsEditorialResult,
} from './types';

const PATH = '/api/v1/cms/entries/:entryId/conflicts/:conflictId/resolve';
const policy = cmsEditorialRoutePolicies.find(
  (item) => item.operationId === CMS_EDITORIAL_CONFLICT_OPERATION_ID,
) as (typeof cmsEditorialRoutePolicies)[number];

/**
 * HTTP admission provides a coarse author/editor gate. The named RPC is the
 * authority for tenant visibility, entry assignment, open conflict state, each
 * choice's source and schema typing, and the atomic two-parent CAS commit.
 */
export const registerCmsEditorialConflictRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void => {
  app.options(PATH, (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const origin = request.headers.get('origin');
    if (origin === null || !dependencies.humanOrigins.includes(origin))
      return errorResponse(request, dependencies, requestId, {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'The request origin is not allowed.',
      });
    const headers = commonHeaders(request, dependencies, requestId);
    headers.set('access-control-allow-methods', 'POST, OPTIONS');
    headers.set(
      'access-control-allow-headers',
      'Content-Type, Idempotency-Key, If-Match, X-CSRF-Token, X-Request-Id',
    );
    return new Response(null, { status: 204, headers });
  });

  app.post(PATH, async (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
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
    const startedAt = dependencies.now?.() ?? Date.now();
    const finish = async (response: Response): Promise<Response> => {
      void emitTelemetry(dependencies, {
        operationId: CMS_EDITORIAL_CONFLICT_OPERATION_ID,
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

    // BE00 step 2: CORS origin, body ceiling, content type, session-bound CSRF.
    const originError = checkOrigin(request, dependencies.humanOrigins);
    if (originError !== null) return fail(originError);
    const preflight = jsonBodyPreflight(request);
    if (preflight !== null) return fail(preflight);
    const csrfError = csrfErrorIfCookie(request);
    if (csrfError !== null) return fail(csrfError);
    const bytes = await withinDeadline((signal) => readBytes(request, signal));
    if (!bytes.ok) return fail(bytes);
    // BE00 steps 4 and 5: verified session, then acting context.
    const identity = await withinDeadline((signal) =>
      dependencies.resolveSession(request, signal),
    );
    if (!identity.ok) return fail(identity);
    const invalidSession = validHumanSession(identity.value);
    if (invalidSession !== null) return fail(invalidSession);
    // BE00 step 6: strict query, paths and body.
    const queryError = rejectCommandQuery(request);
    if (queryError !== null) return fail(queryError);
    const entryId = parseRequestPathId(context.req.param('entryId'));
    if (!entryId.ok) return fail(entryId);
    const conflictId = parseRequestPathId(context.req.param('conflictId'));
    if (!conflictId.ok) return fail(conflictId);
    const body = decodeJsonBody<
      ReturnType<typeof ConflictResolutionRequestSchema.parse>
    >(bytes.value, ConflictResolutionRequestSchema);
    if (!body.ok) return fail(body);
    if (
      body.value.entryId !== entryId.value ||
      body.value.conflictId !== conflictId.value
    )
      return fail(
        invalid(
          'The conflict path and body do not match.',
          {
            violations: [
              {
                path:
                  body.value.entryId !== entryId.value
                    ? '/entryId'
                    : '/conflictId',
                code: 'mismatch',
                message: 'The value is invalid.',
              },
            ],
          },
          422,
        ),
      );
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
        rateHeaders.set('ratelimit-limit', String(policy.rateLimit));
        rateHeaders.set('ratelimit-remaining', '0');
      }
      return fail(rate, rateHeaders);
    }
    // BE00 step 8: exact Idempotency-Key and quoted If-Match.
    const headers = parseEditorialHeaders(
      request,
      ConflictResolutionHeadersSchema,
    );
    if (!headers.ok) return fail(headers);
    if (body.value.expectedVersion !== headers.value.ifMatch)
      return fail(
        invalid('The expected version does not match If-Match.', {}, 422),
      );
    const resolveConflict = dependencies.ports.resolveConflict;
    if (typeof resolveConflict !== 'function')
      return fail(dependencyUnavailable());
    const input: CmsEditorialConflictPortInput = {
      operationId: CMS_EDITORIAL_CONFLICT_OPERATION_ID,
      requestId,
      request,
      session: identity.value,
      path: { entryId: entryId.value, conflictId: conflictId.value },
      body: body.value,
      idempotencyKey: headers.value.idempotencyKey,
      ifMatch: headers.value.ifMatch,
    };
    const result = await withinDeadline((signal) =>
      resolveConflict(input, signal),
    );
    if (!result.ok) return fail(result);
    const parsed = EntryRevisionResourceSchema.safeParse(result.value);
    if (
      !parsed.success ||
      parsed.data.entryId !== entryId.value ||
      parsed.data.conflictId !== conflictId.value ||
      parsed.data.parentRevisionIds.length !== 2 ||
      parsed.data.parentRevisionIds[0] === parsed.data.parentRevisionIds[1]
    )
      return fail({
        ok: false,
        status: 502,
        code: 'BAD_GATEWAY',
        message: 'The CMS editorial dependency returned invalid data.',
      });

    const responseHeaders = commonHeaders(request, dependencies, requestId);
    responseHeaders.set('content-type', 'application/json; charset=UTF-8');
    responseHeaders.set('etag', `"${parsed.data.version}"`);
    responseHeaders.set(
      'location',
      `/api/v1/cms/entries/${entryId.value}/revisions/${parsed.data.id}`,
    );
    return finish(
      new Response(JSON.stringify(parsed.data), {
        status: 201,
        headers: responseHeaders,
      }),
    );
  });
};

import {
  EntryRevisionRequestSchema,
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
  versionDisagreement,
} from './admission-headers';
import {
  requireEditorialCapability,
  validHumanSession,
} from './admission-identity';
import {
  dependencyUnavailable,
  createRouteDeadline,
} from './admission-deadline';
import { commonHeaders, errorResponse, publishedError } from './route-errors';
import { rateCheck } from './route-execution';
import { createRouteFinish, entryFacts } from './route-telemetry';
import {
  CMS_EDITORIAL_REVISION_OPERATION_ID,
  type CmsEditorialDependencies,
  type CmsEditorialError,
  type CmsEditorialPortInput,
} from './types';

export {
  commonHeaders,
  errorResponse,
  publishedError,
  sanitizeReadError,
} from './route-errors';

const PATH = '/api/v1/cms/entries/:entryId/revisions';
const policy = cmsEditorialRoutePolicies.find(
  (item) => item.operationId === CMS_EDITORIAL_REVISION_OPERATION_ID,
) as (typeof cmsEditorialRoutePolicies)[number];

export const registerCmsEditorialRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void => {
  app.options(PATH, (context) => {
    const request = context.req.raw;
    const origin = request.headers.get('origin');
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    if (origin === null || !dependencies.humanOrigins.includes(origin))
      return errorResponse(request, dependencies, requestId, {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'The request origin is not allowed.',
      });
    const headers = commonHeaders(request, dependencies, requestId);
    headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
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
    const { deadlineAt, withinDeadline } = createRouteDeadline(
      request,
      dependencies.deadlineMs,
      policy.timeoutMs,
    );
    const startedAt = dependencies.now?.() ?? Date.now();
    const finish = createRouteFinish(
      dependencies,
      request,
      requestId,
      policy,
      startedAt,
    );
    const fail = (error: CmsEditorialError, headers?: Headers) =>
      finish(errorResponse(request, dependencies, requestId, error, headers), {
        error: publishedError(error),
      });

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
    // BE00 step 6: strict query, path and body.
    const queryError = rejectCommandQuery(request);
    if (queryError !== null) return fail(queryError);
    const path = parseRequestPathId(context.req.param('entryId'));
    if (!path.ok) return fail(path);
    const body = decodeJsonBody<
      ReturnType<typeof EntryRevisionRequestSchema.parse>
    >(bytes.value, EntryRevisionRequestSchema);
    if (!body.ok) return fail(body);
    if (body.value.entryId !== path.value)
      return fail(
        invalid(
          'The entry path and body do not match.',
          {
            violations: [
              {
                path: '/entryId',
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
    const headers = parseEditorialHeaders(request);
    if (!headers.ok) return fail(headers);
    const disagreement = versionDisagreement(
      body.value.expectedVersion,
      headers.value.ifMatch,
    );
    if (disagreement !== null) return fail(disagreement);
    if (typeof dependencies.ports.appendRevision !== 'function')
      return fail(dependencyUnavailable());
    const input: CmsEditorialPortInput = {
      operationId: CMS_EDITORIAL_REVISION_OPERATION_ID,
      requestId,
      request,
      session: identity.value,
      path: { entryId: path.value },
      body: body.value,
      idempotencyKey: headers.value.idempotencyKey,
      ifMatch: headers.value.ifMatch,
    };
    const result = await withinDeadline((signal) =>
      dependencies.ports.appendRevision(input, signal),
    );
    if (!result.ok) return fail(result);
    const parsed = EntryRevisionResourceSchema.safeParse(result.value);
    if (!parsed.success)
      return fail({
        ok: false,
        status: 502,
        code: 'BAD_GATEWAY',
        message: 'The CMS editorial dependency returned invalid data.',
      });
    const responseBody = JSON.stringify(parsed.data);
    // The strong ETag is the committed entry aggregate version, the only valid
    // next If-Match (EntryRevisionResource.entryVersion, lane G contract).
    const etag = `"${parsed.data.entryVersion}"`;
    const location = `/api/v1/cms/entries/${path.value}/revisions/${parsed.data.id}`;
    const responseHeaders = commonHeaders(request, dependencies, requestId);
    responseHeaders.set('content-type', 'application/json; charset=UTF-8');
    responseHeaders.set('etag', etag);
    responseHeaders.set('location', location);
    return finish(
      new Response(responseBody, { status: 201, headers: responseHeaders }),
      {
        counts: { changed_paths: body.value.changedPaths.length },
        entry: await entryFacts(path.value, parsed.data.entryVersion),
        replayed: result.replayed === true,
      },
    );
  });
};

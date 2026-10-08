import {
  ConflictDetailResourceSchema,
  cmsEditorialRoutePolicies,
  createRequestId,
} from '@wejammin/contracts';
import { type Env, Hono } from 'hono';

import { invalid, unsupportedMediaType } from './admission-common';
import { parseRequestPathId } from './admission-body';
import {
  dependencyUnavailable,
  createRouteDeadline,
} from './admission-deadline';
import { checkOrigin } from './admission-headers';
import {
  requireEditorialCapability,
  validHumanSession,
} from './admission-identity';
import { rateCheck } from './route-execution';
import { createRouteFinish, entryFacts } from './route-telemetry';
import {
  commonHeaders,
  errorResponse,
  publishedError,
  sanitizeReadError,
} from './routes';
import {
  CMS_EDITORIAL_CONFLICT_DETAIL_OPERATION_ID,
  type CmsEditorialConflictDetailPortInput,
  type CmsEditorialDependencies,
  type CmsEditorialError,
} from './types';

const PATH = '/api/v1/cms/entries/:entryId/conflicts/:conflictId';
const policy = cmsEditorialRoutePolicies.find(
  (item) => item.operationId === CMS_EDITORIAL_CONFLICT_DETAIL_OPERATION_ID,
) as (typeof cmsEditorialRoutePolicies)[number];

const pointer = (key: string): string =>
  `/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;

/** CMS-03B-12 declares no filter parameters, so any query is caller input. */
const queryError = (request: Request): CmsEditorialError | null => {
  const params = new URL(request.url).searchParams;
  if (params.size === 0) return null;
  // `params.size > 0` above guarantees a first key.
  const key = [...params.keys()][0] as string;
  return invalid('The conflict-detail query is invalid.', {
    violations: [
      {
        path: pointer(key),
        code: 'unknown_field',
        message: 'The value is invalid.',
      },
    ],
  });
};

/** BE00 step 2: a read accepts no request media, so the allowlist is empty. */
const readMediaError = (request: Request): CmsEditorialError | null =>
  request.headers.has('content-type') ? unsupportedMediaType([]) : null;

const readHeadersError = (request: Request): CmsEditorialError | null => {
  if (request.headers.has('idempotency-key') || request.headers.has('if-match'))
    return invalid('The conflict-detail request headers are invalid.');
  const contentLength = request.headers.get('content-length');
  if (
    request.body !== null ||
    request.headers.has('transfer-encoding') ||
    (contentLength !== null && contentLength !== '0')
  )
    return invalid('A conflict-detail read has no request body.');
  return null;
};

/**
 * CMS-03B-12 three-way conflict-detail read. The private RPC owns assignment,
 * tenant visibility, and open-conflict state; a hidden or absent record is
 * concealed as an identical empty-detail 404 and a visible-but-unassigned
 * record is 403. An open conflict must carry divergent paths; a closed record
 * must not, and the strict envelope refuses any ownership or resolver id.
 */
export const registerCmsEditorialConflictDetailRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void => {
  app.get(PATH, async (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const startedAt = dependencies.now?.() ?? Date.now();
    const { deadlineAt, withinDeadline } = createRouteDeadline(
      request,
      dependencies.deadlineMs,
      policy.timeoutMs,
    );
    const finish = createRouteFinish(
      dependencies,
      request,
      requestId,
      policy,
      startedAt,
    );
    const fail = (error: CmsEditorialError, headers?: Headers) =>
      finish(
        errorResponse(request, dependencies, requestId, error, headers, policy),
        { error: publishedError(error, policy) },
      );

    // BE00 step 2: CORS origin and request media.
    const originFailure = checkOrigin(request, dependencies.humanOrigins);
    if (originFailure !== null) return fail(originFailure);
    const mediaError = readMediaError(request);
    if (mediaError !== null) return fail(mediaError);
    // BE00 step 6: reject structural input before session/dependency work.
    const entryId = parseRequestPathId(context.req.param('entryId'));
    if (!entryId.ok) return fail(entryId);
    const conflictId = parseRequestPathId(context.req.param('conflictId'));
    if (!conflictId.ok) return fail(conflictId);
    const headersFailure = readHeadersError(request);
    if (headersFailure !== null) return fail(headersFailure);
    const queryFailure = queryError(request);
    if (queryFailure !== null) return fail(queryFailure);
    // BE00 steps 4 and 5: verified session, then acting context.
    const identity = await withinDeadline((signal) =>
      dependencies.resolveSession(request, signal),
    );
    if (!identity.ok) return fail(identity);
    const invalidSession = validHumanSession(identity.value);
    if (invalidSession !== null) return fail(invalidSession);
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

    const getConflictDetail = dependencies.ports.getConflictDetail;
    if (typeof getConflictDetail !== 'function')
      return fail(dependencyUnavailable());
    const input: CmsEditorialConflictDetailPortInput = {
      operationId: CMS_EDITORIAL_CONFLICT_DETAIL_OPERATION_ID,
      requestId,
      request,
      session: identity.value,
      path: { entryId: entryId.value, conflictId: conflictId.value },
    };
    const result = await withinDeadline((signal) =>
      getConflictDetail(input, signal),
    );
    if (!result.ok) return fail(sanitizeReadError(result, policy));
    // The contract enforces DEC-139: only an open conflict with paths is served.
    const parsed = ConflictDetailResourceSchema.safeParse(result.value);
    if (
      !parsed.success ||
      parsed.data.entry.id !== entryId.value ||
      parsed.data.conflict.id !== conflictId.value
    )
      return fail({
        ok: false,
        status: 502,
        code: 'BAD_GATEWAY',
        message: 'The CMS editorial dependency returned invalid data.',
      });
    const resource = parsed.data;
    const headers = commonHeaders(request, dependencies, requestId);
    headers.set('content-type', 'application/json; charset=UTF-8');
    headers.set(
      'etag',
      `"${resource.conflict.id}:${resource.conflict.version}:${resource.entry.version}:${resource.conflict.conflictHash}"`,
    );
    return finish(
      new Response(JSON.stringify(resource), { status: 200, headers }),
      {
        counts: { paths_returned: resource.paths.length },
        entry: await entryFacts(resource.entry.id, resource.entry.version),
      },
    );
  });
};

import {
  EntryListPageSchema,
  EntryListQuerySchema,
  cmsEditorialRoutePolicies,
  createRequestId,
} from '@wejammin/contracts';
import { type Env, Hono } from 'hono';

import { invalid, issues, unsupportedMediaType } from './admission-common';
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
import { createRouteFinish } from './route-telemetry';
import {
  commonHeaders,
  errorResponse,
  publishedError,
  sanitizeReadError,
} from './routes';
import {
  CMS_EDITORIAL_ENTRY_LIST_OPERATION_ID,
  type CmsEditorialDependencies,
  type CmsEditorialEntryListPortInput,
  type CmsEditorialError,
} from './types';

const PATH = '/api/v1/cms/entries';
const policy = cmsEditorialRoutePolicies.find(
  (item) => item.operationId === CMS_EDITORIAL_ENTRY_LIST_OPERATION_ID,
) as (typeof cmsEditorialRoutePolicies)[number];

const QUERY_KEYS = new Set(['cursor', 'limit', 'state', 'contentTypeId']);

const queryViolation = (key: string, code = 'invalid_value') => ({
  violations: [
    {
      path: `/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`,
      code,
      message: 'The value is invalid.',
    },
  ],
});

/** CMS-03B-13 is a closed keyset read: only cursor/limit/state/contentTypeId. */
const parseListQuery = (request: Request) => {
  const query: Record<string, unknown> = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    if (!QUERY_KEYS.has(key))
      return invalid(
        'The entry-list query is invalid.',
        queryViolation(key, 'unknown_field'),
      );
    if (Object.hasOwn(query, key))
      return invalid(
        'The entry-list query is invalid.',
        queryViolation(key, 'duplicate_field'),
      );
    query[key] = value;
  }
  if (
    typeof query.cursor === 'string' &&
    (query.cursor.length === 0 || query.cursor.length > 512)
  )
    return invalid(
      'The entry-list cursor is invalid.',
      queryViolation('cursor'),
    );
  if (typeof query.limit === 'string') {
    if (!/^[1-9][0-9]?$/u.test(query.limit) || Number(query.limit) > 50)
      return invalid(
        'The entry-list limit is invalid.',
        queryViolation('limit'),
      );
    query.limit = Number(query.limit);
  }
  const parsed = EntryListQuerySchema.safeParse(query);
  return parsed.success
    ? { ok: true as const, value: parsed.data }
    : invalid('The entry-list query failed validation.', issues(parsed.error));
};

/** BE00 step 2: a read accepts no request media, so the allowlist is empty. */
const readMediaError = (request: Request): CmsEditorialError | null =>
  request.headers.has('content-type') ? unsupportedMediaType([]) : null;

const readHeadersError = (request: Request): CmsEditorialError | null => {
  if (request.headers.has('idempotency-key') || request.headers.has('if-match'))
    return invalid('The entry-list request headers are invalid.');
  const contentLength = request.headers.get('content-length');
  if (
    request.body !== null ||
    request.headers.has('transfer-encoding') ||
    (contentLength !== null && contentLength !== '0')
  )
    return invalid('An entry-list read has no request body.');
  return null;
};

/**
 * CMS-03B-13 assigned-entry keyset list. The private RPC derives ownership and
 * acting scope from the authenticated principal and signs the next cursor; the
 * route never accepts an ownership selector and only forwards the closed
 * filters. An expired or foreign cursor is an indistinguishable typed conflict.
 */
export const registerCmsEditorialListRoutes = <E extends Env>(
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
    const headersFailure = readHeadersError(request);
    if (headersFailure !== null) return fail(headersFailure);
    const query = parseListQuery(request);
    if (!query.ok) return fail(query);
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

    const listEntries = dependencies.ports.listEntries;
    if (typeof listEntries !== 'function') return fail(dependencyUnavailable());
    const input: CmsEditorialEntryListPortInput = {
      operationId: CMS_EDITORIAL_ENTRY_LIST_OPERATION_ID,
      requestId,
      request,
      session: identity.value,
      query: query.value,
    };
    const result = await withinDeadline((signal) => listEntries(input, signal));
    if (!result.ok) return fail(sanitizeReadError(result, policy));
    const parsed = EntryListPageSchema.safeParse(result.value);
    if (!parsed.success || parsed.data.nextCursor === '')
      return fail({
        ok: false,
        status: 502,
        code: 'BAD_GATEWAY',
        message: 'The CMS editorial dependency returned invalid data.',
      });
    const headers = commonHeaders(request, dependencies, requestId);
    headers.set('content-type', 'application/json; charset=UTF-8');
    headers.set('etag', `"${parsed.data.pageVersion}"`);
    return finish(
      new Response(JSON.stringify(parsed.data), { status: 200, headers }),
      { counts: { items_returned: parsed.data.items.length } },
    );
  });
};

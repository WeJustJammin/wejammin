import {
  RevisionHistoryPageSchema,
  RevisionHistoryQuerySchema,
  cmsEditorialRoutePolicies,
  createRequestId,
} from '@wejammin/contracts';
import { type Env, Hono } from 'hono';

import { invalid, issues, unsupportedMediaType } from './admission-common';
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
  CMS_EDITORIAL_HISTORY_OPERATION_ID,
  type CmsEditorialDependencies,
  type CmsEditorialError,
  type CmsEditorialHistoryPortInput,
} from './types';

const PATH = '/api/v1/cms/entries/:entryId/revisions';
const policy = cmsEditorialRoutePolicies.find(
  (item) => item.operationId === CMS_EDITORIAL_HISTORY_OPERATION_ID,
) as (typeof cmsEditorialRoutePolicies)[number];

const QUERY_KEYS = new Set([
  'cursor',
  'limit',
  'state',
  'compareRevisionId',
  'locale',
]);

const queryViolation = (key: string, code = 'invalid_value') => ({
  violations: [
    {
      path: `/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`,
      code,
      message: 'The value is invalid.',
    },
  ],
});

const parseHistoryQuery = (request: Request, entryId: string) => {
  const url = new URL(request.url);
  const query: Record<string, unknown> = { entryId };
  for (const [key, value] of url.searchParams) {
    if (!QUERY_KEYS.has(key))
      return invalid(
        'The history query is invalid.',
        queryViolation(key, 'unknown_field'),
      );
    if (Object.hasOwn(query, key))
      return invalid(
        'The history query is invalid.',
        queryViolation(key, 'duplicate_field'),
      );
    query[key] = value;
  }
  if (
    typeof query.cursor === 'string' &&
    (query.cursor.length === 0 || query.cursor.length > 512)
  )
    return invalid('The history cursor is invalid.', queryViolation('cursor'));
  if (typeof query.limit === 'string') {
    if (!/^[1-9][0-9]?$/.test(query.limit) || Number(query.limit) > 50)
      return invalid('The history limit is invalid.', queryViolation('limit'));
    query.limit = Number(query.limit);
  }
  const parsed = RevisionHistoryQuerySchema.safeParse(query);
  const validationStatus = parsed.success
    ? 422
    : parsed.error.issues.some((issue) =>
          ['cursor', 'limit', 'compareRevisionId', 'locale'].includes(
            String(issue.path[0]),
          ),
        )
      ? 400
      : 422;
  return parsed.success
    ? { ok: true as const, value: parsed.data }
    : invalid(
        'The history query failed validation.',
        issues(parsed.error),
        validationStatus,
      );
};

/** BE00 step 2: a read accepts no request media, so the allowlist is empty. */
const readMediaError = (request: Request): CmsEditorialError | null =>
  request.headers.has('content-type') ? unsupportedMediaType([]) : null;

const readHeadersError = (request: Request): CmsEditorialError | null => {
  if (request.headers.has('idempotency-key') || request.headers.has('if-match'))
    return invalid('The history request headers are invalid.');
  const contentLength = request.headers.get('content-length');
  if (
    request.body !== null ||
    request.headers.has('transfer-encoding') ||
    (contentLength !== null && contentLength !== '0')
  )
    return invalid('A history read has no request body.');
  return null;
};

/** GET is a safe, authenticated read; no request body or CSRF mutation token. */
export const registerCmsEditorialHistoryRoutes = <E extends Env>(
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
    const query = parseHistoryQuery(request, path.value);
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

    const listRevisions = dependencies.ports.listRevisions;
    if (typeof listRevisions !== 'function')
      return fail(dependencyUnavailable());
    const input: CmsEditorialHistoryPortInput = {
      operationId: CMS_EDITORIAL_HISTORY_OPERATION_ID,
      requestId,
      request,
      session: identity.value,
      path: { entryId: path.value },
      query: query.value,
    };
    const result = await withinDeadline((signal) =>
      listRevisions(input, signal),
    );
    if (!result.ok) return fail(sanitizeReadError(result, policy));
    const parsed = RevisionHistoryPageSchema.safeParse(result.value);
    if (!parsed.success)
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
      {
        counts: {
          items_returned: parsed.data.items.length,
          changes_returned: parsed.data.compare?.changes.length ?? 0,
        },
        entry: await entryFacts(path.value),
      },
    );
  });
};

import {
  CmsUuidSchema,
  createRequestId,
  GovernedReviewQueueQuerySchema,
  type GovernedReviewDetailResource,
  type GovernedReviewQueuePage,
  type GovernedReviewQueueQuery,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';
import { checkOrigin } from '../cms-editorial/admission-headers';
import { policyOf } from './governed-review-policy';
import {
  failure,
  governedQuota,
  governedSession,
  validEnvelope,
  type CmsGovernedReviewDependencies,
  type GovernedError,
  type GovernedPortContext,
  type GovernedResult,
} from './governed-review-ports';
import {
  governedErrorResponse,
  governedSuccess,
  runGovernedRoute,
} from './governed-review-response';
import {
  validGovernedDetail,
  validGovernedPage,
} from './governed-review-validate';
import {
  templateReadHeadersError,
  templateReadMediaError,
} from './template-shared';

type Parsed<T> = Readonly<{ ok: true; value: T }> | GovernedError;

type ReadSpec<Path, Query, Resource, Input> = Readonly<{
  operation: 'CMS-03C-10' | 'CMS-03C-11';
  /** The strict path and query; a fault is 400 (malformed) or 422 (out of bounds). */
  parse: (context: {
    param: (name: string) => string | undefined;
    request: Request;
  }) => Parsed<{ path: Path; query: Query }>;
  build: (base: GovernedPortContext, path: Path, query: Query) => Input;
  port: (
    dependencies: CmsGovernedReviewDependencies,
  ) => (input: Input, signal: AbortSignal) => Promise<GovernedResult<Resource>>;
  /** The validator operand (ETag) when the answer honours this request, else null (502). */
  accept: (resource: unknown, path: Path, query: Query) => string | null;
}>;

/**
 * One governed safe read (BE00 order): origin, request media, session, headers and body
 * absence, strict path and query, quota, then the port. The read scope itself (404
 * hidden, 403 without scope) is the database's, so there is no Worker capability gate.
 */
const registerRead = <E extends Env, Path, Query, Resource, Input>(
  app: Hono<E>,
  dependencies: CmsGovernedReviewDependencies,
  spec: ReadSpec<Path, Query, Resource, Input>,
): void => {
  const { operation } = spec;
  const path = policyOf(operation).honoPath;
  app.get(path, (context) => {
    const request = context.req.raw;
    const requestId = createRequestId(
      request.headers.get('x-request-id') ?? undefined,
    );
    const reject = (error: GovernedError): Response =>
      governedErrorResponse(request, dependencies, requestId, operation, error);
    return runGovernedRoute(
      request,
      dependencies,
      requestId,
      operation,
      async (signal) => {
        const origin = checkOrigin(request, dependencies.humanOrigins);
        if (origin !== null)
          return governedErrorResponse(
            request,
            dependencies,
            requestId,
            operation,
            origin,
            true,
          );
        const media = templateReadMediaError(request);
        if (media !== null) return reject(media);
        const session = await governedSession(dependencies, request, signal);
        if (!session.ok) return reject(session);
        const headersError = templateReadHeadersError(request);
        if (headersError !== null) return reject(headersError);
        const parsed = spec.parse({
          param: (name) => context.req.param(name),
          request,
        });
        if (!parsed.ok) return reject(parsed);
        const quota = await governedQuota(
          dependencies,
          operation,
          request,
          session.value,
          signal,
        );
        if (quota !== null) return reject(quota);
        if (signal.aborted) return reject(failure(504, {}, 15));
        let result: GovernedResult<Resource>;
        try {
          result = await spec.port(dependencies)(
            spec.build(
              { request, requestId, session: session.value },
              parsed.value.path,
              parsed.value.query,
            ),
            signal,
          );
        } catch {
          return reject(failure(503, {}, 15));
        }
        if (!validEnvelope<Resource>(result)) return reject(failure(502));
        if (!result.ok) return reject(result);
        const etag = spec.accept(
          result.value,
          parsed.value.path,
          parsed.value.query,
        );
        if (etag === null) return reject(failure(502));
        return governedSuccess(
          request,
          dependencies,
          requestId,
          operation,
          result.value as { version?: string },
          { status: 200, etag },
        );
      },
    );
  });
};

const MAX_CURSOR = 512;
const LIMIT_SYNTAX = /^[0-9]{1,6}$/u;
const QUERY_KEYS: ReadonlySet<string> = new Set([
  'cursor',
  'limit',
  'scope',
  'state',
  'subjectKind',
]);

/** Pointer-carrying 422 for an in-grammar but out-of-bounds query member. */
const outOfBounds = (member: string): GovernedError =>
  failure(422, { violations: [{ path: `/${member}`, code: 'invalid' }] });

/** Unknown or duplicated keys and unusable cursor or limit syntax are 400; bounds are 422. */
const parseQueue = (request: Request): Parsed<GovernedReviewQueueQuery> => {
  const members: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    if (!QUERY_KEYS.has(key) || Object.hasOwn(members, key))
      return failure(400);
    members[key] = value;
  }
  const { cursor, limit, ...filters } = members;
  if (cursor !== undefined && (cursor === '' || cursor.length > MAX_CURSOR))
    return failure(400);
  if (limit !== undefined && !LIMIT_SYNTAX.test(limit)) return failure(400);
  const parsed = GovernedReviewQueueQuerySchema.safeParse({
    ...filters,
    ...(cursor === undefined ? {} : { cursor }),
    ...(limit === undefined ? {} : { limit: Number(limit) }),
  });
  if (parsed.success) return { ok: true, value: parsed.data };
  // The schema is a strict object over exactly QUERY_KEYS and unknown keys were refused above, so a failed
  // parse always carries a first issue whose path starts at one of those members.
  return outOfBounds(String(parsed.error.issues[0]!.path[0]));
};

/** CMS-03C-10 and CMS-03C-11 (BE03c rows 172, 173). */
export const registerGovernedReadRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsGovernedReviewDependencies,
): void => {
  registerRead<
    E,
    string,
    null,
    GovernedReviewDetailResource,
    Parameters<CmsGovernedReviewDependencies['readReview']>[0]
  >(app, dependencies, {
    operation: 'CMS-03C-10',
    parse: ({ param, request }) => {
      const reviewId = CmsUuidSchema.safeParse(param('reviewId'));
      return reviewId.success && new URL(request.url).search === ''
        ? { ok: true, value: { path: reviewId.data, query: null } }
        : failure(400);
    },
    build: (base, reviewId) => ({
      ...base,
      operationId: 'CMS-03C-10',
      reviewId,
    }),
    port: (deps) => deps.readReview,
    accept: (resource, reviewId) =>
      validGovernedDetail(resource, reviewId) ? resource.version : null,
  });
  registerRead<
    E,
    null,
    GovernedReviewQueueQuery,
    GovernedReviewQueuePage,
    Parameters<CmsGovernedReviewDependencies['listReviews']>[0]
  >(app, dependencies, {
    operation: 'CMS-03C-11',
    parse: ({ request }) => {
      const query = parseQueue(request);
      return query.ok
        ? { ok: true, value: { path: null, query: query.value } }
        : query;
    },
    build: (base, _path, query) => ({
      ...base,
      operationId: 'CMS-03C-11',
      query,
    }),
    port: (deps) => deps.listReviews,
    accept: (resource, _path, query) =>
      validGovernedPage(resource, query) ? resource.pageVersion : null,
  });
};

import {
  MembershipReadQuerySchema,
  type RelationshipOperationId,
  relationshipRoutePolicies,
} from '@wejammin/contracts';

import type { WorkerContext, WorkerDependencies } from '../index';
import {
  applyRateHeaders,
  authError,
  parseJsonBody,
  responseForAuthError,
  type JsonMutationTransport,
} from '../authentication/boundary';
import type {
  AuthenticationError,
  AuthenticationResult,
  AuthenticationSession,
} from '../authentication/types';
import { requireIdentitySession, setIdentityAuth } from './route-support';
import { parseIdentityCommandHeaders } from './route-parse';

export const relationshipPolicy = (operationId: RelationshipOperationId) => {
  const policy = relationshipRoutePolicies.find(
    (item) => item.operationId === operationId,
  );
  if (policy === undefined)
    throw new Error(`Missing relationship policy ${operationId}`);
  return policy;
};

export const configureRelationshipRoute = (
  context: WorkerContext,
  operationId: RelationshipOperationId,
): void => {
  const policy = relationshipPolicy(operationId);
  context.set('operation', operationId);
  context.header('cache-control', policy.cacheControl);
  context.header('vary', 'Origin');
};

export const relationshipError = (
  status: AuthenticationError['status'],
  code: string,
  message: string,
  details: AuthenticationError['details'] = {},
): AuthenticationError => authError(status, code, message, details);

const invalidQuery = (): AuthenticationError =>
  relationshipError(400, 'INVALID_REQUEST', 'Query parameters are invalid.', {
    violations: [
      {
        path: '/query',
        code: 'unknown_field',
        message: 'The value is invalid.',
      },
    ],
  });

/** BE00 step 6: strict relationship body on the transport read at step 2. */
export const decodeRelationshipBody = <T>(
  transport: JsonMutationTransport,
  schema: Parameters<typeof parseJsonBody<T>>[1],
): AuthenticationResult<T> =>
  mapRelationshipBodyError(transport.decode(schema));

const mapRelationshipBodyError = <T>(
  parsed: AuthenticationResult<T>,
): AuthenticationResult<T> => {
  if (parsed.ok) return parsed;
  if (parsed.code === 'VALIDATION_FAILED' || parsed.code === 'INVALID_REQUEST')
    return relationshipError(
      400,
      'INVALID_REQUEST',
      'The request contains an invalid value.',
      parsed.details,
    );
  return parsed;
};

export const parseRelationshipJsonBody = async <T>(
  request: Request,
  schema: Parameters<typeof parseJsonBody<T>>[1],
): Promise<AuthenticationResult<T>> =>
  mapRelationshipBodyError(await parseJsonBody(request, schema));

export const parseRelationshipCommandHeaders = (
  request: Request,
  ifMatch: boolean,
) => parseIdentityCommandHeaders(request, ifMatch);

export const rejectRelationshipQuery = (
  request: Request,
  allowMembershipFilters = false,
): AuthenticationResult<Readonly<{ cursor: string | null; limit: number }>> => {
  const entries = [...new URL(request.url).searchParams.entries()];
  const allowed = allowMembershipFilters
    ? new Set(['cursor', 'limit'])
    : new Set<string>();
  if (
    entries.some(([key]) => !allowed.has(key)) ||
    new Set(entries.map(([key]) => key)).size !== entries.length
  )
    return invalidQuery();
  const parsed = MembershipReadQuerySchema.safeParse(
    Object.fromEntries(entries),
  );
  if (!parsed.success)
    return relationshipError(
      400,
      'INVALID_REQUEST',
      'Query parameters are invalid.',
      {
        violations: parsed.error.issues.slice(0, 16).map((issue) => ({
          path: `/query/${issue.path.join('/')}`,
          code: issue.message,
          message: 'The value is invalid.',
        })),
      },
    );
  return {
    ok: true,
    value: {
      cursor: parsed.data.cursor ?? null,
      limit: parsed.data.limit ?? 25,
    },
  };
};

export const relationshipPathError = (path: string): AuthenticationError =>
  relationshipError(
    400,
    'INVALID_REQUEST',
    'The resource identifier is invalid.',
    {
      violations: [
        {
          path: `/path/${path}`,
          code: 'path_invalid',
          message: 'The value is invalid.',
        },
      ],
    },
  );

export const resolveRelationshipSession = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
): Promise<AuthenticationResult<AuthenticationSession>> => {
  if (dependencies.auth === undefined)
    return relationshipError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Authentication is temporarily unavailable.',
    );
  setIdentityAuth(context, dependencies.auth);
  return requireIdentitySession(context);
};

const hasCredentials = (request: Request): boolean =>
  request.headers.get('cookie')?.includes('wj_session_ref=') === true ||
  request.headers.get('authorization') !== null;

export const resolveOptionalRelationshipSession = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
): Promise<AuthenticationResult<AuthenticationSession | null>> => {
  if (!hasCredentials(context.req.raw)) return { ok: true, value: null };
  return resolveRelationshipSession(context, dependencies);
};

export const enforceRelationshipRate = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  operationId: RelationshipOperationId,
  session: AuthenticationSession | null,
): Promise<Response | null> => {
  const auth = dependencies.auth;
  if (auth === undefined) return null;
  const policy = relationshipPolicy(operationId);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, policy.timeoutMs);
  try {
    const result = await auth.rateLimit(
      {
        operationId,
        request: context.req.raw,
        authUserId: session?.authUserId ?? null,
        identifierDigest: null,
        limit: policy.rateLimit,
        windowSeconds: policy.rateWindowSeconds,
      },
      context.env,
      controller.signal,
    );
    if (timedOut)
      return responseForAuthError(
        context,
        relationshipError(
          504,
          'DEPENDENCY_TIMEOUT',
          'Identity rate limiting timed out.',
        ),
      );
    if (!result.ok) return responseForAuthError(context, result);
    if (
      typeof result.value.allowed !== 'boolean' ||
      !Number.isInteger(result.value.limit) ||
      result.value.limit < 1 ||
      !Number.isInteger(result.value.remaining) ||
      result.value.remaining < 0 ||
      !Number.isInteger(result.value.resetAt) ||
      result.value.resetAt < 0
    )
      return responseForAuthError(
        context,
        relationshipError(
          502,
          'DEPENDENCY_INVALID_RESPONSE',
          'Identity rate limiting returned an invalid response.',
        ),
      );
    applyRateHeaders(context, result.value);
    if (result.value.allowed) return null;
    return responseForAuthError(
      context,
      relationshipError(429, 'RATE_LIMITED', 'Too many requests.'),
    );
  } catch (error) {
    if (
      timedOut ||
      (error instanceof DOMException && error.name === 'AbortError')
    )
      return responseForAuthError(
        context,
        relationshipError(
          504,
          'DEPENDENCY_TIMEOUT',
          'Identity rate limiting timed out.',
        ),
      );
    if (
      typeof error === 'object' &&
      error !== null &&
      'ok' in error &&
      error.ok === false
    )
      return responseForAuthError(context, error as AuthenticationError);
    return responseForAuthError(
      context,
      relationshipError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Identity rate limiting is temporarily unavailable.',
      ),
    );
  } finally {
    clearTimeout(timer);
  }
};

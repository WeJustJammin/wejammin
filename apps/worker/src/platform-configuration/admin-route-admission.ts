import {
  Cfg05b01InboxQuerySchema,
  RequestContextSchema,
  type ApiError,
  type Cfg05b01InboxQuery,
  type RequestContext,
} from '@wejammin/contracts';

import type { WorkerContext, WorkerDependencies } from '../index';
import {
  authError,
  responseForAuthError,
  type JsonMutationTransport,
} from '../authentication/boundary';
import type {
  AuthenticationResult,
  AuthenticationSession,
} from '../authentication/types';
import {
  parseConfigurationBody,
  requireConfigurationSession,
  type SchemaLike,
} from './route-support';
import type { AdminOperationId } from './types';

/** Admin routes that share admission; 06 and 07 have no legacy port name. */
export type AdminRouteOperationId =
  AdminOperationId | 'CFG-05B-06' | 'CFG-05B-07';

/**
 * The route capability of every admin route that names one. CFG-05B-07 names
 * none: any admitted session may read its own projection.
 */
type CapabilityOperationId = Exclude<AdminRouteOperationId, 'CFG-05B-07'>;
const requiredCapability: Readonly<Record<CapabilityOperationId, string>> = {
  'CFG-05B-01': 'admin.inbox.read',
  'CFG-05B-04': 'admin.capability.grant',
  'CFG-05B-05': 'admin.audit.read',
  'CFG-05B-06': 'admin.identity.mfa_reset',
};

const deadlines: Readonly<Record<AdminRouteOperationId, number>> = {
  'CFG-05B-01': 8_000,
  'CFG-05B-04': 15_000,
  'CFG-05B-05': 8_000,
  'CFG-05B-06': 15_000,
  'CFG-05B-07': 8_000,
};

type TimedAdminHandler = (signal: AbortSignal) => Promise<Response>;

export const withDeadline = async (
  context: WorkerContext,
  operationId: AdminRouteOperationId,
  handler: TimedAdminHandler,
): Promise<Response> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Response>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      const response = responseForAuthError(
        context,
        authError(504, 'UPSTREAM_TIMEOUT', 'Admin workspace timed out.'),
      );
      context.res = response;
      resolve(response);
    }, deadlines[operationId]);
  });
  try {
    return await Promise.race([handler(controller.signal), timeout]);
  } catch {
    const response = responseForAuthError(
      context,
      authError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Admin workspace is temporarily unavailable.',
        { dependencyClass: 'admin_workspace', retryable: true },
      ),
    );
    context.res = response;
    return response;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

const invalid = (
  message: string,
  details: ApiError['details'] = {},
): AuthenticationResult<never> =>
  authError(400, 'INVALID_REQUEST', message, details);

export const parseQuery = async (
  request: Request,
): Promise<AuthenticationResult<Cfg05b01InboxQuery>> => {
  const params = new URL(request.url).searchParams;
  const allowed = new Set([
    'cursor',
    'limit',
    'taskClasses',
    'states',
    'staleAfter',
  ]);
  const value: Record<string, unknown> = {};
  for (const key of new Set(params.keys())) {
    if (!allowed.has(key) || params.getAll(key).length !== 1)
      return invalid('The query parameters are invalid.');
    const raw = params.get(key);
    if (raw === null) return invalid('The query parameters are invalid.');
    if (key === 'limit') {
      const limit = Number(raw);
      if (!Number.isInteger(limit))
        return invalid('The query parameters are invalid.');
      value.limit = limit;
    } else if (key === 'taskClasses' || key === 'states') {
      const entries = raw.split(',').map((entry) => entry.trim());
      if (entries.some((entry) => entry.length === 0))
        return invalid('The query parameters are invalid.');
      value[key] = entries;
    } else value[key] = raw;
  }
  const parsed = Cfg05b01InboxQuerySchema.safeParse(value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : invalid('The query parameters are invalid.');
};

const CONSTRAINT_CODE = /^[a-z][a-z0-9_]{0,63}$/u;
export const GENERIC_VIOLATION_CODE = 'invalid_value';

/**
 * BE00 `FieldViolation.code` is a stable lowercase constraint code of 1..64
 * characters. A contract refinement token is kept; library text (which can echo
 * a caller-supplied key or value) is replaced by the generic code.
 */
export const constraintViolations = (
  details: ApiError['details'] | undefined,
): ApiError['details'] | undefined => {
  const violations = details?.violations;
  if (details === undefined || !Array.isArray(violations)) return details;
  return {
    ...details,
    violations: violations.map((violation) => {
      const row = violation as Record<string, unknown>;
      return {
        ...(violation as object),
        code: CONSTRAINT_CODE.test(String(row.code))
          ? String(row.code)
          : GENERIC_VIOLATION_CODE,
      };
    }),
  } as ApiError['details'];
};

/** Admin body failures: size and media keep their status, the rest are 400. */
export const adminBodyError = (
  parsed: Extract<AuthenticationResult<never>, { ok: false }>,
): Extract<AuthenticationResult<never>, { ok: false }> =>
  parsed.status === 504
    ? parsed
    : authError(
        parsed.status === 413 || parsed.status === 415 ? parsed.status : 400,
        parsed.status === 413
          ? 'PAYLOAD_TOO_LARGE'
          : parsed.status === 415
            ? 'UNSUPPORTED_MEDIA_TYPE'
            : 'INVALID_REQUEST',
        parsed.message,
        constraintViolations(parsed.details),
      );

export const parseBody = async <T>(
  request: Request,
  schema: SchemaLike<T>,
  signal?: AbortSignal,
): Promise<AuthenticationResult<T>> => {
  const parsed = await parseConfigurationBody(request, schema, signal);
  return parsed.ok ? parsed : adminBodyError(parsed);
};

/** BE00 step 6 for an admin mutation, on the transport read at step 2. */
export const decodeAdminBody = <T>(
  transport: JsonMutationTransport,
  schema: SchemaLike<T>,
): AuthenticationResult<T> => {
  const parsed = transport.decode(schema);
  return parsed.ok ? parsed : adminBodyError(parsed);
};

const fallbackContext = (context: WorkerContext): RequestContext =>
  RequestContextSchema.parse({
    requestId: context.get('requestId'),
    correlationId: context.get('correlationId'),
    causationId: null,
    traceId: `admin-${context.get('requestId')}`,
    userId: null,
    actingPartyId: null,
    capabilities: [],
    locale: 'en-US',
    clientVersion: 'worker',
  });

const resolveContext = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  session: AuthenticationSession,
  signal: AbortSignal,
): Promise<AuthenticationResult<RequestContext>> => {
  let candidate: unknown = fallbackContext(context);
  if (dependencies.resolveRequestContext !== undefined) {
    try {
      candidate = await dependencies.resolveRequestContext(
        context.req.raw,
        context.env,
        signal,
        session,
      );
    } catch {
      return authError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Authorization context is temporarily unavailable.',
        { dependencyClass: 'request_context', retryable: true },
      );
    }
  }
  const parsed = RequestContextSchema.safeParse(candidate);
  if (!parsed.success)
    return authError(
      401,
      'UNAUTHENTICATED',
      'The authentication context is invalid.',
      { recoveryAction: 'reauthenticate' },
    );
  if (
    parsed.data.userId !== session.authUserId ||
    parsed.data.actingPartyId !== session.actingPartyId
  )
    return authError(403, 'FORBIDDEN', 'The acting context is not allowed.');
  return { ok: true, value: parsed.data };
};

/** BE00 steps 4 and 5: the verified session, then the acting context. */
export const admitSession = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  signal: AbortSignal,
): Promise<
  | Readonly<{ session: AuthenticationSession; requestContext: RequestContext }>
  | Readonly<{ response: Response }>
> => {
  const session = await requireConfigurationSession(
    context,
    dependencies.auth,
    true,
    signal,
  );
  if (!session.ok) return { response: responseForAuthError(context, session) };
  const requestContext = await resolveContext(
    context,
    dependencies,
    session.value,
    signal,
  );
  if (!requestContext.ok)
    return { response: responseForAuthError(context, requestContext) };
  return { session: session.value, requestContext: requestContext.value };
};

/** BE00 step 7: the named route capability, from the server-built context. */
export const requireAdminCapability = (
  context: WorkerContext,
  operationId: CapabilityOperationId,
  requestContext: RequestContext,
): Response | null =>
  requestContext.capabilities.includes(requiredCapability[operationId])
    ? null
    : responseForAuthError(
        context,
        authError(403, 'FORBIDDEN', 'The named admin capability is required.'),
      );

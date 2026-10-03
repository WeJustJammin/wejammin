import type { WorkerContext, WorkerDependencies } from '../index';
import { responseForAuthError } from '../authentication/boundary';
import type {
  AuthenticationResult,
  AuthenticationSession,
} from '../authentication/types';
import {
  admitProfileTransport,
  enforceProfileRate,
  parseProfileCommandHeaders,
  parseProfileQuery,
  requireProfileSession,
  requireProfileStepUp,
  type SchemaLike,
} from './route-support';
import type { ProfilePortInput } from './types';
import type { ActiveOperation } from './route-types';

export type PreparedCommand = Readonly<{
  body: Readonly<Record<string, unknown>>;
  idempotencyKey: string;
  ifMatch?: string;
  session: AuthenticationSession | null;
}>;

type Preparation =
  Readonly<{ value: PreparedCommand }> | Readonly<{ response: Response }>;

export type PathResult = AuthenticationResult<Readonly<Record<string, string>>>;

/**
 * Admission in BE00 "Hono Middleware Order": origin, body ceiling, content
 * type and session-bound CSRF (step 2; a public command has no session and so
 * neither origin nor CSRF); verified session and acting context (steps 4 and
 * 5); strict query, path and body (step 6); step-up freshness and quota
 * (step 7); then the exact Idempotency-Key and If-Match (step 8).
 */
export const prepare = async <T>(
  context: WorkerContext,
  operationId: ActiveOperation,
  schema: SchemaLike<T>,
  auth: WorkerDependencies['auth'],
  authMode: 'public' | 'session' | 'session_step_up',
  ifMatchRequired: boolean,
  path?: PathResult,
): Promise<Preparation> => {
  const transport = await admitProfileTransport(
    context.req.raw,
    authMode !== 'public',
  );
  if (!transport.ok)
    return { response: responseForAuthError(context, transport) };
  let session: AuthenticationSession | null = null;
  if (authMode !== 'public') {
    const resolved = await requireProfileSession(context, auth);
    if (!resolved.ok)
      return { response: responseForAuthError(context, resolved) };
    session = resolved.value;
  }
  const queryError = parseProfileQuery(context.req.raw);
  if (queryError !== null)
    return { response: responseForAuthError(context, queryError) };
  if (path !== undefined && !path.ok)
    return { response: responseForAuthError(context, path) };
  const body = transport.value.decode(schema);
  if (!body.ok) return { response: responseForAuthError(context, body) };
  if (session !== null && authMode === 'session_step_up') {
    const stepUp = requireProfileStepUp(session);
    if (stepUp !== null)
      return { response: responseForAuthError(context, stepUp) };
  }
  const rateError = await enforceProfileRate(
    context,
    auth,
    operationId,
    session,
  );
  if (rateError !== null) return { response: rateError };
  const headers = parseProfileCommandHeaders(context.req.raw, ifMatchRequired);
  if (!headers.ok) {
    return { response: responseForAuthError(context, headers) };
  }
  return {
    value: {
      body: body.value as Readonly<Record<string, unknown>>,
      idempotencyKey: headers.value.idempotencyKey,
      ...(headers.value.ifMatch === undefined
        ? {}
        : { ifMatch: headers.value.ifMatch }),
      session,
    },
  };
};

export const inputFor = (
  context: WorkerContext,
  operationId: ActiveOperation,
  prepared: PreparedCommand,
  path?: Readonly<Record<string, string>>,
): ProfilePortInput => ({
  operationId,
  request: context.req.raw,
  body: prepared.body,
  idempotencyKey: prepared.idempotencyKey,
  ...(prepared.ifMatch === undefined ? {} : { ifMatch: prepared.ifMatch }),
  ...(prepared.session === null ? {} : { session: prepared.session }),
  ...(path === undefined ? {} : { path }),
});

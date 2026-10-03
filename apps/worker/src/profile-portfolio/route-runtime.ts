import type { WorkerContext, WorkerDependencies } from '../index';
import { authError, responseForAuthError } from '../authentication/boundary';
import type {
  AuthenticationResult,
  AuthenticationSession,
} from '../authentication/types';
import { responseVersion } from './events';
import {
  cacheFor,
  cloneableErrorResponse,
  statusFor,
  type ActiveProfilePortfolioOperation,
  type Outcome,
  type ProfilePortfolioPortName,
} from './runtime-helpers';
import { createProfilePortfolioPortRunner } from './runtime-port';
import {
  admitProfileCommandTransport,
  checkSameOrigin,
  configureProfilePortfolioRoute,
  enforceProfilePortfolioRate,
  parseProfileCommandHeaders,
  parseProfileQuery,
  producerHeadersValid,
  requireProfilePortfolioSession,
  type SchemaLike,
} from './route-support';

export type {
  ActiveProfilePortfolioOperation,
  ProfilePortfolioPortName,
} from './runtime-helpers';

type PathResult = AuthenticationResult<Readonly<Record<string, string>>>;

export type ProfilePortfolioRouteRuntime = Readonly<{
  read: <T>(
    context: WorkerContext,
    operationId: ActiveProfilePortfolioOperation,
    portName: ProfilePortfolioPortName,
    path: PathResult,
    schema: SchemaLike<T>,
    allowedQuery: readonly string[],
    defaults?: Readonly<Record<string, string>>,
    protectedRead?: boolean,
  ) => Promise<Response>;
  command: <T>(
    context: WorkerContext,
    operationId: ActiveProfilePortfolioOperation,
    portName: ProfilePortfolioPortName,
    path: PathResult,
    schema: SchemaLike<T>,
    ifMatchRequired?: boolean,
  ) => Promise<Response>;
  producer: <T>(
    context: WorkerContext,
    operationId: 'PRF-PROF-10',
    portName: 'ingestProfileFactObservation',
    schema: SchemaLike<T>,
  ) => Promise<Response>;
}>;

export const createProfilePortfolioRouteRuntime = (
  dependencies: WorkerDependencies,
): ProfilePortfolioRouteRuntime => {
  const run = createProfilePortfolioPortRunner(dependencies);
  const send = (
    context: WorkerContext,
    outcome: Outcome,
    operationId: ActiveProfilePortfolioOperation,
  ): Response => {
    if (!outcome.ok) {
      const response = cloneableErrorResponse(
        responseForAuthError(context, {
          ...outcome,
          ...(outcome.code === 'DEPENDENCY_UNAVAILABLE' &&
          outcome.retryAfterSeconds === undefined
            ? { retryAfterSeconds: 5 }
            : {}),
        }),
      );
      context.res = response;
      return response;
    }
    context.header('cache-control', cacheFor(operationId));
    const version = responseVersion(outcome.value);
    if (version !== null) context.header('etag', `"${version}"`);
    return context.json(
      outcome.value as Record<string, unknown>,
      statusFor(operationId),
    );
  };

  const read: ProfilePortfolioRouteRuntime['read'] = async (
    context,
    operationId,
    portName,
    path,
    schema,
    allowedQuery,
    defaults = {},
    protectedRead = false,
  ) => {
    configureProfilePortfolioRoute(context, operationId);
    // BE00 step 2: origin (a read has no body, CSRF or media).
    const origin = checkSameOrigin(context);
    if (!origin.ok) return responseForAuthError(context, origin);
    // BE00 steps 4 and 5: the verified session of a protected read.
    let session: AuthenticationSession | undefined;
    if (protectedRead) {
      const resolved = await requireProfilePortfolioSession(
        context,
        dependencies.auth,
      );
      if (!resolved.ok) return responseForAuthError(context, resolved);
      session = resolved.value;
    }
    // BE00 step 6: strict query, then path.
    const query = parseProfileQuery(
      context.req.raw,
      schema,
      allowedQuery,
      defaults,
    );
    if (!query.ok) return responseForAuthError(context, query);
    if (!path.ok) return responseForAuthError(context, path);
    // BE00 step 7: quota.
    const rate = await enforceProfilePortfolioRate(
      context,
      operationId,
      dependencies.auth,
      session ?? null,
    );
    if (rate !== null) return rate;
    return send(
      context,
      await run(context, operationId, portName, {
        operationId,
        request: context.req.raw,
        path: path.value,
        query: query.value as Readonly<Record<string, unknown>>,
        ...(session === undefined ? {} : { session }),
      }),
      operationId,
    );
  };

  const command: ProfilePortfolioRouteRuntime['command'] = async (
    context,
    operationId,
    portName,
    path,
    schema,
    ifMatchRequired = true,
  ) => {
    configureProfilePortfolioRoute(context, operationId);
    // BE00 step 2: origin, body ceiling, content type, session-bound CSRF.
    const transport = await admitProfileCommandTransport(context);
    if (!transport.ok) return responseForAuthError(context, transport);
    // BE00 steps 4 and 5: verified session and acting context.
    const resolved = await requireProfilePortfolioSession(
      context,
      dependencies.auth,
    );
    if (!resolved.ok) return responseForAuthError(context, resolved);
    // BE00 step 6: strict path and body.
    if (!path.ok) return responseForAuthError(context, path);
    const body = transport.value.decode(schema);
    if (!body.ok) return responseForAuthError(context, body);
    // BE00 step 7: quota.
    const rate = await enforceProfilePortfolioRate(
      context,
      operationId,
      dependencies.auth,
      resolved.value,
    );
    if (rate !== null) return rate;
    // BE00 step 8: exact Idempotency-Key and If-Match.
    const headers = parseProfileCommandHeaders(
      context.req.raw,
      ifMatchRequired,
    );
    if (!headers.ok) return responseForAuthError(context, headers);
    return send(
      context,
      await run(context, operationId, portName, {
        operationId,
        request: context.req.raw,
        path: path.value,
        body: body.value as Readonly<Record<string, unknown>>,
        idempotencyKey: headers.value.idempotencyKey,
        ...(headers.value.ifMatch === undefined
          ? {}
          : { ifMatch: headers.value.ifMatch }),
        session: resolved.value,
      }),
      operationId,
    );
  };

  const producer: ProfilePortfolioRouteRuntime['producer'] = async (
    context,
    operationId,
    portName,
    schema,
  ) => {
    configureProfilePortfolioRoute(context, operationId);
    // BE00 step 2: origin, body ceiling and content type (a signed producer
    // call carries no cookie, so there is no CSRF step).
    const transport = await admitProfileCommandTransport(context);
    if (!transport.ok) return responseForAuthError(context, transport);
    // BE00 step 4: the producer credential.
    if (!producerHeadersValid(context.req.raw))
      return responseForAuthError(
        context,
        authError(
          401,
          'PRODUCER_AUTH_FAILED',
          'Producer authentication failed.',
        ),
      );
    // BE00 step 6: strict query and body.
    if (new URL(context.req.url).searchParams.size !== 0)
      return responseForAuthError(
        context,
        authError(400, 'INVALID_REQUEST', 'Query parameters are not accepted.'),
      );
    const body = transport.value.decode(schema);
    if (!body.ok) return responseForAuthError(context, body);
    const rate = await enforceProfilePortfolioRate(
      context,
      operationId,
      dependencies.auth,
      null,
    );
    if (rate !== null) return rate;
    // BE00 step 8: exact Idempotency-Key.
    const headers = parseProfileCommandHeaders(context.req.raw, false);
    if (!headers.ok) return responseForAuthError(context, headers);
    return send(
      context,
      await run(context, operationId, portName, {
        operationId,
        request: context.req.raw,
        body: body.value as Readonly<Record<string, unknown>>,
        idempotencyKey: headers.value.idempotencyKey,
      }),
      operationId,
    );
  };

  return { read, command, producer };
};

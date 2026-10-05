import {
  expectedVersionValue,
  traceFor,
  type AuthProductionConfiguration,
} from '../authentication/production-configuration';
import { isFreshProof } from '../authentication/step-up';
import type { AuthenticationSession } from '../authentication/types';
import {
  callProfile,
  type ProfileReplay,
  type ProfileSchema,
} from './production-http';
import type { ProfilePortInput } from './types';

export const requestHeaders = (
  request: Request,
  operationId: string,
  idempotencyKey?: string,
  ifMatch?: string,
): Readonly<Record<string, string>> => {
  const trace = traceFor(request);
  return {
    'X-Operation-Id': operationId,
    'X-Request-Id': trace.requestId,
    'X-Correlation-Id': trace.correlationId,
    ...(idempotencyKey === undefined
      ? {}
      : { 'X-Idempotency-Key': idempotencyKey }),
    ...(ifMatch === undefined ? {} : { 'If-Match': ifMatch }),
  };
};

export const databaseContext = (
  input: Pick<ProfilePortInput, 'request' | 'session'>,
  now: () => number = Date.now,
): Readonly<Record<string, unknown>> => {
  const trace = traceFor(input.request);
  const session = input.session;
  return {
    ...(session === undefined
      ? {}
      : {
          authUserId: session.authUserId,
          sessionId: session.sessionId,
          actorPersonId: session.personId,
          actingPartyId: session.actingPartyId,
          stepUpVerified: isFreshProof(session.stepUpAt, now()),
        }),
    requestId: trace.requestId,
    correlationId: trace.correlationId,
  };
};

export const expectedVersion = (
  ifMatch: string | undefined,
): string | undefined =>
  ifMatch === undefined ? undefined : expectedVersionValue(ifMatch);

export const replayFor = (
  input: ProfilePortInput,
  rpc: string,
  idField: string,
  idParameter: string,
  operationId: string,
): ProfileReplay => ({
  rpc,
  idField,
  idParameter,
  baseInput: { p_request: { context: databaseContext(input) } },
  headers: requestHeaders(input.request, operationId),
});

export const commandRpc = <T>(
  config: AuthProductionConfiguration,
  input: ProfilePortInput,
  signal: AbortSignal,
  rpc: string,
  schema: ProfileSchema<T>,
  body: Readonly<Record<string, unknown>>,
  replay?: ProfileReplay,
) =>
  callProfile(
    config,
    rpc,
    {
      p_request: {
        ...body,
        idempotencyKey: input.idempotencyKey,
        context: databaseContext(input),
      },
    },
    signal,
    schema,
    requestHeaders(
      input.request,
      input.operationId,
      input.idempotencyKey,
      input.ifMatch,
    ),
    replay,
  );

export const readRpc = <T>(
  config: AuthProductionConfiguration,
  input: ProfilePortInput,
  signal: AbortSignal,
  rpc: string,
  schema: ProfileSchema<T>,
  body: Readonly<Record<string, unknown>>,
) =>
  callProfile(
    config,
    rpc,
    { p_request: { ...body, context: databaseContext(input) } },
    signal,
    schema,
    requestHeaders(input.request, input.operationId),
  );

export type ProfileSession = AuthenticationSession;

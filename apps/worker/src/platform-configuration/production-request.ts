import {
  expectedVersionValue,
  traceFor,
  type AuthProductionConfiguration,
} from '../authentication/production-configuration';
import { isFreshProof } from '../authentication/step-up';
import { callConfiguration, type ConfigurationSchema } from './production-http';
import type { ConfigurationPortInput } from './types';

export const configurationRequestHeaders = (
  input: ConfigurationPortInput,
): Readonly<Record<string, string>> => {
  const trace = traceFor(input.request);
  return {
    'X-Operation-Id': input.operationId,
    'X-Request-Id': trace.requestId,
    'X-Correlation-Id': trace.correlationId,
    ...(input.idempotencyKey === undefined
      ? {}
      : { 'X-Idempotency-Key': input.idempotencyKey }),
    ...(input.ifMatch === undefined ? {} : { 'If-Match': input.ifMatch }),
  };
};

export const configurationDatabaseContext = (
  input: Pick<
    ConfigurationPortInput,
    'request' | 'session' | 'servicePrincipalId' | 'serviceConsumerKey'
  >,
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
          stepUpAt: session.stepUpAt,
        }),
    ...(input.servicePrincipalId === undefined
      ? {}
      : {
          releasePrincipalId: input.servicePrincipalId,
          servicePrincipalId: input.servicePrincipalId,
        }),
    ...(input.serviceConsumerKey === undefined
      ? {}
      : { serviceConsumerKey: input.serviceConsumerKey }),
    requestId: trace.requestId,
    correlationId: trace.correlationId,
  };
};

export const configurationExpectedVersion = (
  ifMatch: string | undefined,
): string | undefined =>
  ifMatch === undefined ? undefined : expectedVersionValue(`"${ifMatch}"`);

const databaseIfMatch = (
  input: ConfigurationPortInput,
): Readonly<Record<string, string>> =>
  input.ifMatch === undefined
    ? {}
    : { ifMatch: configurationExpectedVersion(input.ifMatch)! };

export const configurationCommandRpc = <T>(
  config: AuthProductionConfiguration,
  input: ConfigurationPortInput,
  signal: AbortSignal,
  rpc: string,
  schema: ConfigurationSchema<T>,
  body: Readonly<Record<string, unknown>>,
) =>
  callConfiguration(
    config,
    rpc,
    {
      p_request: {
        ...body,
        ...(input.idempotencyKey === undefined
          ? {}
          : { idempotencyKey: input.idempotencyKey }),
        ...databaseIfMatch(input),
        context: configurationDatabaseContext(input),
      },
    },
    input,
    signal,
    schema,
  );

export const configurationReadRpc = <T>(
  config: AuthProductionConfiguration,
  input: ConfigurationPortInput,
  signal: AbortSignal,
  rpc: string,
  schema: ConfigurationSchema<T>,
  body: Readonly<Record<string, unknown>>,
) =>
  callConfiguration(
    config,
    rpc,
    {
      p_request: {
        ...body,
        ...(input.idempotencyKey === undefined
          ? {}
          : { idempotencyKey: input.idempotencyKey }),
        ...databaseIfMatch(input),
        context: configurationDatabaseContext(input),
      },
    },
    input,
    signal,
    schema,
  );

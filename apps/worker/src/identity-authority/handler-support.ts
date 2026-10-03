import {
  type IdentityOperationId,
  PublicPartyProjectionResponseSchema,
} from '@wejammin/contracts';

import type { WorkerContext, WorkerDependencies } from '../index';
import {
  responseForAuthError,
  verifyReadOrigin,
} from '../authentication/boundary';
import type {
  AuthenticationError,
  AuthenticationResult,
  AuthenticationSession,
} from '../authentication/types';
import {
  executeRecovery,
  hasRecoveryPorts,
  type RecoveryState,
} from './recovery';
import {
  callIdentityPort,
  enforceIdentityRate,
  identityError,
  identityResponse,
  invalidPersistence,
  missingIdentityDependency,
  requireIdentitySession,
  setIdentityAuth,
} from './route-support';

export type SessionInput = Readonly<{
  session: AuthenticationSession;
  idempotencyKey: string;
  ifMatch: string | null;
}>;

/**
 * BE00 step 2 for a read: a read has no body, content type or CSRF token, so
 * the same-origin check is the whole transport gate. Returns the refusal, or
 * null when the origin is acceptable.
 */
export const refuseForeignReadOrigin = (
  context: WorkerContext,
): Response | null => {
  const refused = verifyReadOrigin(context.req.raw);
  return refused === null ? null : responseForAuthError(context, refused);
};

export const pathError = (message: string): AuthenticationError =>
  identityError(400, 'INVALID_REQUEST', message, {
    violations: [
      { path: '/path', code: 'path_invalid', message: 'The value is invalid.' },
    ],
  });

export const resolve = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
): Promise<AuthenticationResult<AuthenticationSession>> => {
  if (dependencies.auth === undefined)
    return identityError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Authentication is temporarily unavailable.',
    );
  setIdentityAuth(context, dependencies.auth);
  return requireIdentitySession(context);
};

export const rate = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  operationId: IdentityOperationId,
  session: AuthenticationSession | null,
): Promise<Response | null> => {
  if (dependencies.auth !== undefined)
    setIdentityAuth(context, dependencies.auth);
  return enforceIdentityRate(context, operationId, session);
};

export const execute = async <T>(
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
  operationId: IdentityOperationId,
  input: SessionInput & Readonly<{ mutation: boolean }>,
  port: ((signal: AbortSignal) => Promise<AuthenticationResult<T>>) | undefined,
  schema: {
    safeParse: (
      value: unknown,
    ) => { success: true; data: T } | { success: false };
  },
  status: 200 | 201 | 202,
): Promise<Response> => {
  const authority = dependencies.identityAuthority;
  if (authority !== undefined && hasRecoveryPorts(authority))
    return executeRecovery(context, authority, state, {
      operationId,
      ...input,
    });
  if (port === undefined) return missingIdentityDependency(context);
  return identityResponse(
    context,
    await callIdentityPort(operationId, port),
    schema,
    status,
  );
};

export const executePublic = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  state: RecoveryState,
  port:
    | ((signal: AbortSignal) => Promise<AuthenticationResult<unknown>>)
    | undefined,
): Promise<Response> => {
  const authority = dependencies.identityAuthority;
  if (authority !== undefined && hasRecoveryPorts(authority))
    return executeRecovery(context, authority, state, {
      operationId: 'BE01b-18',
      session: null,
      idempotencyKey: null,
      ifMatch: null,
      mutation: false,
    });
  if (port === undefined) return missingIdentityDependency(context);
  const result = await callIdentityPort('BE01b-18', port);
  if (!result.ok) return responseForAuthError(context, result);
  const parsed = PublicPartyProjectionResponseSchema.safeParse(result.value);
  if (!parsed.success) return invalidPersistence(context);
  context.header('etag', `"${parsed.data.version}"`);
  context.header('cache-control', 'public, max-age=60');
  return context.json(parsed.data, 200);
};

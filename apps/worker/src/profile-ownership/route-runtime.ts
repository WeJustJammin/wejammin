import type { WorkerContext, WorkerDependencies } from '../index';
import type { ProfileEvent } from '@wejammin/contracts';
import { authError, responseForAuthError } from '../authentication/boundary';
import { callProfilePort } from './execution';
import {
  claimEvent,
  fingerprint,
  replayKey,
  send,
  statusFor,
  validateResponse,
} from './route-outcome';
import { inputFor, prepare, type PathResult } from './route-preparation';
import type { ActiveOperation, ActivePortName, Outcome } from './route-types';
import {
  enforceProfileRate,
  parseProfileQuery,
  requireProfileSession,
  type SchemaLike,
} from './route-support';
import type { ProfilePortInput } from './types';

export type { ActiveOperation, ActivePortName, Outcome } from './route-types';

export type ProfileRouteRuntime = Readonly<{
  command: <T>(
    context: WorkerContext,
    operationId: ActiveOperation,
    portName: ActivePortName,
    schema: SchemaLike<T>,
    authMode: 'public' | 'session' | 'session_step_up',
    ifMatchRequired: boolean,
    path?: PathResult,
  ) => Promise<Response>;
  read: (
    context: WorkerContext,
    operationId: ActiveOperation,
    portName: ActivePortName,
    path: PathResult,
  ) => Promise<Response>;
}>;

export const createProfileRouteRuntime = (
  dependencies: WorkerDependencies,
): ProfileRouteRuntime => {
  const profile = dependencies.profileOwnership;
  const completed = new Map<
    string,
    Readonly<{ fingerprint: string; outcome: Extract<Outcome, { ok: true }> }>
  >();
  const pending = new Map<
    string,
    Readonly<{ fingerprint: string; promise: Promise<Outcome> }>
  >();

  const runCommand = async (
    context: WorkerContext,
    portName: ActivePortName,
    input: ProfilePortInput,
  ): Promise<Outcome> => {
    const operationId = input.operationId as ActiveOperation;
    const currentFingerprint = fingerprint(input);
    const key = replayKey(input);
    const cached = completed.get(key);
    if (cached !== undefined) {
      return cached.fingerprint === currentFingerprint
        ? cached.outcome
        : {
            ok: false,
            error: authError(
              409,
              'CONFLICT',
              'The idempotency key was reused.',
              {
                conflict: 'IDEMPOTENCY_MISMATCH',
                recoveryAction: 'use_a_new_idempotency_key',
              },
            ),
          };
    }
    const inFlight = pending.get(key);
    if (inFlight !== undefined) {
      return inFlight.fingerprint === currentFingerprint
        ? inFlight.promise
        : {
            ok: false,
            error: authError(
              409,
              'CONFLICT',
              'The idempotency key was reused.',
              {
                conflict: 'IDEMPOTENCY_MISMATCH',
                recoveryAction: 'use_a_new_idempotency_key',
              },
            ),
          };
    }
    const promise = (async (): Promise<Outcome> => {
      const result = await callProfilePort(
        context,
        operationId,
        profile?.[portName],
        input,
      );
      if (!result.ok) return { ok: false, error: result };
      const value = validateResponse(operationId, result.value);
      if (!value.ok) return { ok: false, error: value };
      let event: ProfileEvent | undefined;
      if (operationId === 'PRF-API-04' && input.session !== undefined) {
        const built = claimEvent(context, value.value, input.session);
        if (!built.ok) return { ok: false, error: built };
        event = built.value;
        if (profile?.emitEvent === undefined)
          return {
            ok: false,
            error: authError(
              503,
              'DEPENDENCY_UNAVAILABLE',
              'Profile events are temporarily unavailable.',
              {
                dependencyClass: 'event_sink',
                retryable: true,
              },
            ),
          };
        try {
          await profile.emitEvent(
            event,
            context.env,
            new AbortController().signal,
          );
        } catch {
          return {
            ok: false,
            error: authError(
              503,
              'DEPENDENCY_UNAVAILABLE',
              'Profile events are temporarily unavailable.',
              {
                dependencyClass: 'event_sink',
                retryable: true,
              },
            ),
          };
        }
      }
      return {
        ok: true,
        value: value.value,
        status: statusFor(operationId),
        ...(event === undefined ? {} : { event }),
      };
    })();
    pending.set(key, { fingerprint: currentFingerprint, promise });
    const outcome = await promise;
    pending.delete(key);
    if (outcome.ok)
      completed.set(key, { fingerprint: currentFingerprint, outcome });
    return outcome;
  };

  const command = async <T>(
    context: WorkerContext,
    operationId: ActiveOperation,
    portName: ActivePortName,
    schema: SchemaLike<T>,
    authMode: 'public' | 'session' | 'session_step_up',
    ifMatchRequired: boolean,
    path?: PathResult,
  ): Promise<Response> => {
    const prepared = await prepare(
      context,
      operationId,
      schema,
      dependencies.auth,
      authMode,
      ifMatchRequired,
      path,
    );
    if ('response' in prepared) return prepared.response;
    return send(
      context,
      await runCommand(
        context,
        portName,
        inputFor(
          context,
          operationId,
          prepared.value,
          path === undefined || !path.ok ? undefined : path.value,
        ),
      ),
      operationId,
    );
  };

  const read = async (
    context: WorkerContext,
    operationId: ActiveOperation,
    portName: ActivePortName,
    path: PathResult,
  ): Promise<Response> => {
    const session = await requireProfileSession(context, dependencies.auth);
    if (!session.ok) return responseForAuthError(context, session);
    const queryError = parseProfileQuery(context.req.raw);
    if (queryError !== null) return responseForAuthError(context, queryError);
    if (!path.ok) return responseForAuthError(context, path);
    const rateError = await enforceProfileRate(
      context,
      dependencies.auth,
      operationId,
      session.value,
    );
    if (rateError !== null) return rateError;
    const result = await callProfilePort(
      context,
      operationId,
      profile?.[portName],
      {
        operationId,
        request: context.req.raw,
        path: path.value,
        session: session.value,
      },
    );
    if (!result.ok) return send(context, { ok: false, error: result });
    const value = validateResponse(operationId, result.value);
    return send(
      context,
      value.ok
        ? { ok: true, value: value.value, status: 200 }
        : { ok: false, error: value },
    );
  };

  return { command, read };
};

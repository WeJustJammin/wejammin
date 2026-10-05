import type { WorkerContext, WorkerDependencies } from '../index';
import { authError } from '../authentication/boundary';
import type { AuthenticationResult } from '../authentication/types';
import {
  Cfg05b01InboxResponseSchema,
  Cfg05b04CapabilityActionResponseSchema,
  Cfg05b05AuditDiagnosticResponseSchema,
} from '@wejammin/contracts';
import type {
  AdminOperationId,
  AdminWorkspaceDependencies,
  AdminWorkspacePortInput,
} from './types';
import { emitAdminWorkspaceTelemetry } from './admin-telemetry';

type SchemaLike<T> = Readonly<{
  safeParse: (
    value: unknown,
  ) =>
    | Readonly<{ success: true; data: T }>
    | Readonly<{ success: false; error?: unknown }>;
}>;
type AdminPortName = Exclude<
  keyof AdminWorkspaceDependencies,
  'resetMfaFactors'
>;

const deadlines: Readonly<Record<AdminOperationId, number>> = {
  'CFG-05B-01': 8_000,
  'CFG-05B-04': 15_000,
  'CFG-05B-05': 8_000,
};

const dependenciesFor = (
  dependencies: WorkerDependencies,
): AdminWorkspaceDependencies | undefined => {
  if (dependencies.adminWorkspace !== undefined)
    return dependencies.adminWorkspace;
  const configuration = dependencies.platformConfiguration;
  if (
    configuration?.readInbox === undefined ||
    configuration.capabilityAction === undefined ||
    configuration.auditDiagnostic === undefined
  )
    return undefined;
  return {
    readInbox: configuration.readInbox,
    capabilityAction: configuration.capabilityAction,
    auditDiagnostic: configuration.auditDiagnostic,
  };
};

const unavailable = (): AuthenticationResult<never> => ({
  ok: false,
  status: 503,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'Admin workspace persistence is temporarily unavailable.',
  details: { dependencyClass: 'admin_workspace', retryable: true },
  retryAfterSeconds: 5,
});

const invalidResponse = (): AuthenticationResult<never> =>
  authError(
    502,
    'UPSTREAM_FAILURE',
    'The admin workspace dependency returned an invalid response.',
  );

const runWithDeadline = async (
  invoke: (signal: AbortSignal) => Promise<AuthenticationResult<unknown>>,
  deadlineMs: number,
): Promise<AuthenticationResult<unknown>> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AuthenticationResult<unknown>>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(authError(504, 'UPSTREAM_TIMEOUT', 'Admin workspace timed out.'));
    }, deadlineMs);
  });
  try {
    return await Promise.race([invoke(controller.signal), timeout]);
  } catch {
    return unavailable();
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stable(child)]),
  );
};

const fingerprint = (input: AdminWorkspacePortInput): string =>
  JSON.stringify(
    stable({
      operationId: input.operationId,
      query: input.query ?? {},
      body: input.body ?? {},
      ifMatch: input.ifMatch ?? null,
    }),
  );

const replayKey = (
  input: AdminWorkspacePortInput,
  idempotencyKey: string,
): string =>
  `${input.operationId}|${input.session.authUserId}|${input.session.actingPartyId ?? 'no-party'}|${idempotencyKey}`;

const statusFor = (input: AdminWorkspacePortInput): 200 | 201 =>
  input.operationId === 'CFG-05B-04' && input.body?.action !== 'revoke'
    ? 201
    : 200;

const schemaFor = (operationId: AdminOperationId): SchemaLike<unknown> => {
  switch (operationId) {
    case 'CFG-05B-01':
      return Cfg05b01InboxResponseSchema;
    case 'CFG-05B-04':
      return Cfg05b04CapabilityActionResponseSchema;
    case 'CFG-05B-05':
      return Cfg05b05AuditDiagnosticResponseSchema;
  }
};

export const createAdminWorkspacePortRunner = (
  dependencies: WorkerDependencies,
) => {
  const completed = new Map<
    string,
    Readonly<{ fingerprint: string; outcome: AuthenticationResult<unknown> }>
  >();
  const pending = new Map<
    string,
    Readonly<{
      fingerprint: string;
      promise: Promise<AuthenticationResult<unknown>>;
    }>
  >();

  const run = async (
    context: WorkerContext,
    input: AdminWorkspacePortInput,
    portName: AdminPortName,
    outerSignal?: AbortSignal,
  ): Promise<AuthenticationResult<unknown>> => {
    const startedAt = dependencies.now();
    const finish = async (
      outcome: AuthenticationResult<unknown>,
    ): Promise<AuthenticationResult<unknown>> => {
      await emitAdminWorkspaceTelemetry(
        context,
        input,
        outcome,
        startedAt,
        dependencies.now,
      );
      return outcome;
    };
    const admin = dependenciesFor(dependencies);
    const port = admin?.[portName];
    if (port === undefined) return finish(unavailable());
    const invoke = async (): Promise<AuthenticationResult<unknown>> => {
      const result =
        outerSignal === undefined
          ? await runWithDeadline(
              (signal) => port(input, context.env, signal),
              deadlines[input.operationId],
            )
          : await port(input, context.env, outerSignal);
      if (!result.ok) return result;
      const parsed = schemaFor(input.operationId).safeParse(result.value);
      return parsed.success
        ? { ok: true, value: parsed.data }
        : invalidResponse();
    };
    if (input.idempotencyKey === undefined) return finish(await invoke());
    const key = replayKey(input, input.idempotencyKey);
    const currentFingerprint = fingerprint(input);
    const previous = completed.get(key);
    if (previous !== undefined)
      return finish(
        previous.fingerprint === currentFingerprint
          ? previous.outcome
          : authError(
              409,
              'IDEMPOTENCY_CONFLICT',
              'The idempotency key was used for another request.',
            ),
      );
    const inFlight = pending.get(key);
    if (inFlight !== undefined)
      return finish(
        inFlight.fingerprint === currentFingerprint
          ? await inFlight.promise
          : authError(
              409,
              'IDEMPOTENCY_CONFLICT',
              'The idempotency key was used for another request.',
            ),
      );
    const promise = invoke();
    pending.set(key, { fingerprint: currentFingerprint, promise });
    const outcome = await promise;
    pending.delete(key);
    completed.set(key, { fingerprint: currentFingerprint, outcome });
    return finish(outcome);
  };

  return { run, statusFor };
};

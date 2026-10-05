import { createLogger } from '@wejammin/observability/logging';
import { vi } from 'vitest';

import { createWorkerApp } from '../index';
import type {
  AuthenticationResult,
  AuthenticationSession,
  AuthRateLimitDecision,
} from '../authentication/types';
import {
  ACTOR_ID,
  OUTBOX_EVENT_ID,
  TARGET_ID,
  bindings,
  contextFor,
  jsonRequest,
  sessionFor,
} from './phase-02-slice-08-worker.test-support';
import type { AdminMfaFactorResetPort } from './types';

export const RESET_ID = '99999999-9999-4999-8999-999999999999';
export const MFA_RESET_CAPABILITY = 'admin.identity.mfa_reset';

export const resetResponse = (
  patch: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> => ({
  resetId: RESET_ID,
  targetPersonId: TARGET_ID,
  state: 'completed',
  removedFactorCount: 2,
  mfaVersion: '9',
  outboxEventId: OUTBOX_EVENT_ID,
  ...patch,
});

export const resetBody = {
  targetPersonId: TARGET_ID,
  reason: 'Lost every authenticator; identity verified out of band.',
} as const;

export const resetRequest = (
  body: unknown = resetBody,
  headers: Readonly<Record<string, string | undefined>> = {},
): Request =>
  jsonRequest('/api/v1/admin/identity/mfa-factor-resets', body, {
    'idempotency-key': 'mfa-reset-0123456789',
    ...headers,
  });

export const operatorContext = () => contextFor([MFA_RESET_CAPABILITY]);

export const stepUpAgo = (seconds: number): AuthenticationSession => ({
  ...sessionFor(),
  stepUpAt: new Date(Date.now() - seconds * 1000).toISOString(),
});

const allowed = (
  limit: number,
): AuthenticationResult<AuthRateLimitDecision> => ({
  ok: true,
  value: {
    allowed: true,
    limit,
    remaining: limit - 1,
    resetAt: Math.floor(Date.now() / 1000) + 3600,
  },
});

export type ResetHarnessOptions = Readonly<{
  session?: AuthenticationSession;
  context?: ReturnType<typeof contextFor>;
  /** Replaces the request-context authority, e.g. to make it fail. */
  resolveContext?: () => Promise<unknown>;
  port?: AdminMfaFactorResetPort | null;
  rateLimits?: ReadonlyArray<AuthenticationResult<AuthRateLimitDecision>>;
}>;

export const makeResetHarness = (options: ResetHarnessOptions = {}) => {
  const session = options.session ?? stepUpAgo(30);
  const lines: string[] = [];
  const port = vi.fn<AdminMfaFactorResetPort>(async () => ({
    ok: true as const,
    value: resetResponse(),
  }));
  const rateCalls: AuthenticationResult<AuthRateLimitDecision>[] = [];
  const auth = {
    resolveSession: vi.fn(async () => ({ ok: true as const, value: session })),
    rateLimit: vi.fn<
      (input: unknown) => Promise<AuthenticationResult<AuthRateLimitDecision>>
    >(async () => {
      const next = options.rateLimits?.[rateCalls.length] ?? allowed(5);
      rateCalls.push(next);
      return next;
    }),
  };
  const resolveRequestContext = vi.fn(
    options.resolveContext ??
      (async () => options.context ?? operatorContext()),
  );
  const resetMfaFactors =
    options.port === null ? undefined : (options.port ?? port);
  const app = createWorkerApp({
    auth: auth as never,
    captureException: () => undefined,
    createLogger: () =>
      createLogger(
        {
          environment: bindings.APP_ENVIRONMENT,
          release: bindings.APP_RELEASE,
          service: 'wejammin-api',
        },
        { random: () => 0, sink: (line) => lines.push(line) },
      ),
    now: () => Date.now(),
    resolveRequestContext,
    platformConfiguration: {} as never,
    adminWorkspace: {
      readInbox: vi.fn(),
      capabilityAction: vi.fn(),
      auditDiagnostic: vi.fn(),
      ...(resetMfaFactors === undefined ? {} : { resetMfaFactors }),
    } as never,
  } as never);
  return { app, auth, lines, port, session, ACTOR_ID };
};

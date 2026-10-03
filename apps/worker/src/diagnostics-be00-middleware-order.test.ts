import { RequestContextSchema, type RequestContext } from '@wejammin/contracts';
import { createLogger } from '@wejammin/observability/logging';
import { describe, expect } from 'vitest';

import { registerOrderTests, type OrderStep } from './be00-order.test-support';
import { createWorkerApp, type WorkerBindings } from './index';

/*
 * BE00 "Hono Middleware Order" is executable contract. The operator
 * diagnostics read is probed with one request that fails every step from N
 * onward; the response must be the step N refusal.
 */

const bindings: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'a2ec4803',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://staging.example.supabase.co',
};

const context: RequestContext = RequestContextSchema.parse({
  requestId: '11111111-1111-4111-8111-111111111111',
  correlationId: '22222222-2222-4222-8222-222222222222',
  causationId: null,
  traceId: 'trace-111111111111',
  userId: '33333333-3333-4333-8333-333333333333',
  actingPartyId: null,
  capabilities: ['diagnostics.read'],
  locale: 'en-US',
  clientVersion: 'worker-test',
});

type State = Readonly<{
  headers: Readonly<Record<string, string>>;
  unauthenticated: boolean;
  staleStepUp: boolean;
  noCapability: boolean;
}>;

const steps: readonly OrderStep<State>[] = [
  {
    name: 'CORS origin allowlist',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) => ({
      ...state,
      headers: { ...state.headers, origin: 'https://evil.example.test' },
    }),
  },
  {
    name: 'authentication',
    status: 401,
    code: 'UNAUTHENTICATED',
    break: (state) => ({ ...state, unauthenticated: true }),
  },
  {
    name: 'strict header validation',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => ({
      ...state,
      headers: { ...state.headers, 'x-diagnostic-reason': 'x' },
    }),
  },
  {
    name: 'step-up freshness',
    status: 401,
    code: 'STEP_UP_REQUIRED',
    break: (state) => ({ ...state, staleStepUp: true }),
  },
  {
    name: 'capability',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) => ({ ...state, noCapability: true }),
  },
];

describe('BE00 middleware order on the operator diagnostics read', () => {
  registerOrderTests<State>({
    family: 'diagnostics',
    fresh: () => ({
      headers: { 'x-diagnostic-reason': 'incident review' },
      unauthenticated: false,
      staleStepUp: false,
      noCapability: false,
    }),
    steps,
    send: (state) => {
      const app = createWorkerApp({
        captureException: () => {},
        createLogger: () =>
          createLogger(
            {
              environment: 'staging',
              release: 'a2ec4803',
              service: 'wejammin-api',
            },
            { random: () => 0, sink: () => {} },
          ),
        now: () => 1_756_536_600_000,
        resolveRequestContext: () =>
          state.unauthenticated
            ? null
            : {
                ...context,
                capabilities: state.noCapability ? [] : ['diagnostics.read'],
              },
        isStepUpFresh: () => !state.staleStepUp,
        auditDiagnosticAccess: () => undefined,
      });
      return Promise.resolve(
        app.request(
          'https://api.example.test/api/v1/internal/diagnostics',
          { headers: state.headers },
          bindings,
        ),
      );
    },
    accepted: (response) => expect(response.status).toBe(200),
  });
});

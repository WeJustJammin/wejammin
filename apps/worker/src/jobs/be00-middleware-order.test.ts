import { describe, expect, vi } from 'vitest';

import { registerOrderTests, type OrderStep } from '../be00-order.test-support';
import {
  OTHER_USER_ID,
  JOB_ID,
  allowRate,
  basePrincipal,
  bindings,
  createJobDependencies,
  createTestApp,
  request,
} from './job-status-test-support';

/*
 * BE00 "Hono Middleware Order" is executable contract. INF-API-01 (job status
 * read) is probed with one request that fails every step from N onward; the
 * response must be the step N refusal. A read has no body, content type or
 * CSRF token, so the matrix is: origin, authentication, strict query and path,
 * quota, then ownership (existence-concealing 404).
 */

type State = Readonly<{
  path: string;
  headers: Readonly<Record<string, string>>;
  unauthenticated: boolean;
  rateExhausted: boolean;
  foreignJob: boolean;
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
    check: (_response, body) =>
      expect(body.details).toEqual({ recoveryAction: 'reauthenticate' }),
  },
  {
    name: 'strict path and query validation',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => ({ ...state, path: '/api/v1/jobs/not-a-uuid?x=1' }),
  },
  {
    name: 'rate limit',
    status: 429,
    code: 'RATE_LIMITED',
    break: (state) => ({ ...state, rateExhausted: true }),
  },
  {
    name: 'ownership',
    status: 404,
    code: 'NOT_FOUND',
    break: (state) => ({ ...state, foreignJob: true }),
  },
];

describe('BE00 middleware order on the job status read (INF-API-01)', () => {
  registerOrderTests<State>({
    family: 'jobs',
    fresh: () => ({
      path: `/api/v1/jobs/${JOB_ID}`,
      headers: {},
      unauthenticated: false,
      rateExhausted: false,
      foreignJob: false,
    }),
    steps,
    send: (state) => {
      const dependencies = createJobDependencies({
        resolvePrincipal: vi.fn(async () =>
          state.unauthenticated
            ? null
            : state.foreignJob
              ? { kind: 'user', userId: OTHER_USER_ID }
              : basePrincipal,
        ),
        rateLimit: vi.fn(async () =>
          state.rateExhausted ? { ...allowRate, allowed: false } : allowRate,
        ),
      });
      return Promise.resolve(
        createTestApp(dependencies).fetch(
          request(state.path, state.headers),
          bindings,
        ),
      );
    },
    accepted: (response) => expect(response.status).toBe(200),
  });
});

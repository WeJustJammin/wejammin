import { describe, expect, vi } from 'vitest';

import { registerOrderTests, type OrderStep } from '../be00-order.test-support';
import type { ConfigurationPort } from './types';
import { bindings, contextFor } from './phase-02-slice-08-worker.test-support';
import { makeHarness as makeAdminHarness } from './phase-02-slice-08-worker.test-support';
import { request as adminRequest } from './phase-02-slice-08-worker.request-support';
import {
  defaultRate,
  definitionId,
  effectiveRequest,
  effectiveResponse,
  makeHarness as makeSettingsHarness,
  nextSession,
} from './phase-02-slice-07.test-support';

/*
 * BE00 "Hono Middleware Order" is executable contract. The two platform
 * configuration reads not covered by the inbox probe, CFG-05B-07 (capability
 * snapshot) and CFG-05A-02 (effective value for a session), are probed with one
 * request that fails every step from N onward; the response must be the step
 * N refusal.
 */

type State = Readonly<{
  path: string;
  headers: Readonly<Record<string, string | undefined>>;
  unauthenticated: boolean;
  rateExhausted: boolean;
}>;

const originStep: OrderStep<State> = {
  name: 'CORS origin allowlist',
  status: 403,
  code: 'FORBIDDEN',
  break: (state) => ({
    ...state,
    headers: { ...state.headers, origin: 'https://evil.example.test' },
  }),
};
const authStep: OrderStep<State> = {
  name: 'authentication',
  status: 401,
  code: 'UNAUTHENTICATED',
  break: (state) => ({ ...state, unauthenticated: true }),
};
const rateStep: OrderStep<State> = {
  name: 'rate limit',
  status: 429,
  code: 'RATE_LIMITED',
  break: (state) => ({ ...state, rateExhausted: true }),
};
const unauthenticated = {
  ok: false as const,
  status: 401 as const,
  code: 'UNAUTHENTICATED',
  message: 'No session.',
};
const exhausted = {
  ok: true as const,
  value: {
    allowed: false,
    limit: 1_000,
    remaining: 0,
    resetAt: Math.floor(Date.now() / 1000) + 30,
  },
};

const SNAPSHOT = '/api/v1/admin/capability-snapshot';

describe('BE00 middleware order on the capability snapshot read (CFG-05B-07)', () => {
  registerOrderTests<State>({
    family: 'platform-configuration snapshot',
    fresh: () => ({
      path: SNAPSHOT,
      headers: { authorization: 'Bearer verified-session' },
      unauthenticated: false,
      rateExhausted: false,
    }),
    steps: [
      originStep,
      authStep,
      {
        name: 'strict query validation',
        status: 400,
        code: 'INVALID_REQUEST',
        break: (state) => ({ ...state, path: `${SNAPSHOT}?unexpected=1` }),
      },
      rateStep,
    ],
    send: (state) => {
      const harness = makeAdminHarness({
        ...(state.unauthenticated ? { resolveSession: unauthenticated } : {}),
        requestContext: contextFor(['admin.inbox.read']),
        ...(state.rateExhausted ? { rateLimit: exhausted } : {}),
      });
      return Promise.resolve(
        harness.app.fetch(
          adminRequest(state.path, { method: 'GET' }, state.headers),
          bindings,
        ),
      );
    },
    accepted: (response) => expect(response.status).toBe(200),
  });
});

const EFFECTIVE =
  '/api/v1/config/profile.visibility/effective' +
  `?partyId=${definitionId}&consumerKey=web.profile&supportedDefinitionVersions=1`;

describe('BE00 middleware order on the effective configuration read (CFG-05A-02, session)', () => {
  registerOrderTests<State>({
    family: 'platform-configuration effective',
    fresh: () => ({
      path: EFFECTIVE,
      headers: {},
      unauthenticated: false,
      rateExhausted: false,
    }),
    steps: [
      originStep,
      authStep,
      {
        name: 'strict path validation',
        status: 400,
        code: 'INVALID_REQUEST',
        break: (state) => ({
          ...state,
          path: state.path.replace('profile.visibility', 'NOT A KEY'),
        }),
      },
      {
        name: 'strict query validation',
        status: 400,
        code: 'INVALID_REQUEST',
        break: (state) => ({ ...state, path: `${state.path}&unexpected=1` }),
      },
      rateStep,
    ],
    send: (state) => {
      const port = vi.fn<ConfigurationPort>(async () => ({
        ok: true as const,
        value: effectiveResponse,
      })) as ConfigurationPort;
      const harness = makeSettingsHarness({
        port,
        session: nextSession(),
        ...(state.unauthenticated ? { resolveSession: unauthenticated } : {}),
        ...(state.rateExhausted
          ? {
              rateLimit: {
                ok: true as const,
                value: {
                  ...(defaultRate() as { value: object }).value,
                  allowed: false,
                  remaining: 0,
                },
              } as never,
            }
          : {}),
      });
      return Promise.resolve(
        harness.app.fetch(effectiveRequest(state.path, state.headers)),
      );
    },
    accepted: (response) => expect(response.status).toBe(200),
  });
});

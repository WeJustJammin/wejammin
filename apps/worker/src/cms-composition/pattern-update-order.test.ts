import { Hono } from 'hono';
import { describe, expect, vi } from 'vitest';

import { headersBeforeAuthorization } from '../be00-header-order.test-support';
import {
  httpAdapter,
  httpFresh,
  httpRequest,
  registerOrderTests,
  standardMutationSteps,
  type HttpState,
} from '../be00-order.test-support';
import type { CmsPatternUpdateDependencies } from './pattern-update-ports';
import { registerCmsPatternUpdateRoutes } from './pattern-update-routes';
import { allowRate, puSession } from './pattern-update-routes.test-support';
import {
  merge,
  registerHeaderOrderTests,
  type Probe,
} from './write-header-order.test-support';
import {
  acceptBody,
  acceptResource,
  PU_ENTRY_ETAG,
  PU_ORIGIN,
  PU_UPDATE_PATH,
} from './pattern-update.test-support';

/**
 * BE00 "Hono Middleware Order" and BE03c 408/1502 for CMS-03C-15: a request that fails several steps at once is
 * answered by the earliest one; a malformed Idempotency-Key or If-Match is a 400 before the capability check and before
 * any quota token is consumed.
 */
const HEADERS = {
  origin: PU_ORIGIN,
  'content-type': 'application/json',
  'idempotency-key': 'pattern-update-0001',
  'if-match': '"7"',
};

const dependencies = (
  overrides: Partial<CmsPatternUpdateDependencies>,
): CmsPatternUpdateDependencies => ({
  humanOrigins: [PU_ORIGIN],
  now: () => 1_000,
  resolveSession: async () => ({ ok: true, value: puSession() }),
  rateLimit: allowRate,
  readSelector: vi.fn(),
  readNestable: vi.fn(),
  readUpdateDiff: vi.fn(),
  readInstances: vi.fn(),
  applyUpdate: async () => ({
    ok: true,
    value: acceptResource(1),
    etag: PU_ENTRY_ETAG,
  }),
  telemetry: () => undefined,
  ...overrides,
});

const appOf = (overrides: Partial<CmsPatternUpdateDependencies>) => {
  const app = new Hono();
  registerCmsPatternUpdateRoutes(app, dependencies(overrides));
  return app;
};

const overridesFor = (
  state: HttpState,
): Partial<CmsPatternUpdateDependencies> => ({
  ...(state.unauthenticated
    ? {
        resolveSession: async () => ({
          ok: false as const,
          status: 401 as const,
          code: 'UNAUTHENTICATED',
          message: 'No session.',
        }),
      }
    : {}),
  ...(state.capabilityDropped && !state.unauthenticated
    ? {
        resolveSession: async () => ({
          ok: true as const,
          value: puSession([]),
        }),
      }
    : {}),
  ...(state.rateExhausted
    ? {
        rateLimit: async (input: { limit: number }) => ({
          ok: true as const,
          value: {
            allowed: false,
            limit: input.limit,
            remaining: 0,
            resetAt: 2_000,
          },
        }),
      }
    : {}),
});

describe('BE00 middleware order on the CMS-03C-15 route', () => {
  registerOrderTests<HttpState>({
    family: 'cms-pattern-update',
    fresh: () => httpFresh(PU_UPDATE_PATH, acceptBody(1), HEADERS),
    steps: headersBeforeAuthorization(
      standardMutationSteps(
        httpAdapter({
          codes: {
            forbidden: 'COMPOSITION_FORBIDDEN',
            badRequest: 'INVALID_REQUEST',
            unauthenticated: 'UNAUTHENTICATED',
            validation: 'COMPOSITION_VALIDATION_FAILED',
            rateLimited: 'RATE_LIMITED',
          },
          oversize: { status: 400, code: 'INVALID_REQUEST' },
          badPath: null,
          badBody: {},
        }),
      ),
    ),
    send: (state) =>
      Promise.resolve(
        appOf(overridesFor(state)).request(
          httpRequest(state, 'https://api.example.test'),
        ),
      ),
    accepted: (response) => expect(response.status).toBe(200),
  });
});

const probe: Probe = {
  name: 'CMS-03C-15 pattern update',
  badIfMatch: [null, 'W/"7"', '7', '"8"'],
  send: async (headers, capability, body) => {
    const rateLimit = vi.fn(allowRate);
    const applyUpdate = vi.fn<CmsPatternUpdateDependencies['applyUpdate']>(
      async () => ({
        ok: true,
        value: acceptResource(1),
        etag: PU_ENTRY_ETAG,
      }),
    );
    const response = await appOf({
      resolveSession: async () => ({
        ok: true,
        value: puSession(capability ? ['cms.author'] : []),
      }),
      rateLimit,
      applyUpdate,
    }).request(`https://api.example.test${PU_UPDATE_PATH}`, {
      method: 'POST',
      headers: merge(HEADERS, headers),
      body: JSON.stringify(body ?? acceptBody(1)),
    });
    return {
      response,
      rateLimit: () => rateLimit.mock.calls.length,
      port: () => applyUpdate.mock.calls.length,
    };
  },
};

registerHeaderOrderTests([probe]);

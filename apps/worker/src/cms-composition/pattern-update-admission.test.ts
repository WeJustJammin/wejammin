import { afterEach, describe, expect, it, vi } from 'vitest';

import { PATTERN_UPDATE_OPERATIONS } from './pattern-update-operations';
import type { CmsPatternUpdateDependencies } from './pattern-update-ports';
import {
  body,
  PROBES,
  type Harness,
} from './pattern-update-admission.test-support';
import {
  createPatternUpdateHarness,
  puSession,
} from './pattern-update-routes.test-support';
import { PU_ORIGIN, PU_REQUEST_ID } from './pattern-update.test-support';

/**
 * The BE00 admission every linked-update operation shares (BE03c 175-177, 1266-1268, 1474-1476): origin, verified human
 * session, the route capability and the user then party quota. Each operation is one probe over the same matrix
 * (`pattern-update-admission.test-support.ts`); the port faults, deadline and telemetry are in `pattern-update-faults.test.ts`.
 */
afterEach(() => {
  vi.useRealTimers();
});

describe.each(PROBES)('$id admission', (probe) => {
  const send = (harness: Harness, init: RequestInit = probe.init()) =>
    harness.request(probe.path, init);

  it('a request with no defect is accepted, cached nowhere, with the strong ETag', async () => {
    const harness = createPatternUpdateHarness();
    const response = await send(harness);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe(PU_REQUEST_ID);
    expect(response.headers.get('access-control-allow-origin')).toBe(PU_ORIGIN);
    expect(response.headers.get('access-control-allow-credentials')).toBe(
      'true',
    );
    expect(response.headers.get('etag')).toMatch(/^"[1-9]\d*"$/u);
    expect(probe.port(harness).mock.calls).toHaveLength(1);
  });

  it('charges the user bucket then the party bucket of the registry row', async () => {
    const harness = createPatternUpdateHarness();
    await send(harness);
    const spec = PATTERN_UPDATE_OPERATIONS[probe.id];
    expect(harness.rateLimit.mock.calls.map(([input]) => input)).toMatchObject([
      {
        operationId: probe.id,
        rateClass: spec.rateClass,
        rateScope: 'user',
        limit: spec.user,
        windowSeconds: 60,
        principalClass: 'human',
        actingPartyId: puSession().actingPartyId,
        actorId: puSession().userId,
      },
      {
        operationId: probe.id,
        rateClass: spec.rateClass,
        rateScope: 'party',
        limit: spec.party,
        windowSeconds: 60,
        actorId: puSession().actingPartyId,
      },
    ]);
  });

  it.each([
    ['cms.author', ['cms.author']],
    ['cms.editor', ['cms.editor']],
    ['cms.author and cms.editor', ['cms.author', 'cms.editor']],
  ])('a caller holding %s may use it', async (_name, capabilities) => {
    const harness = createPatternUpdateHarness({
      resolveSession: async () => ({
        ok: true,
        value: puSession(capabilities),
      }),
    });
    expect((await send(harness)).status).toBe(200);
  });

  it.each([
    ['the designer capability alone', puSession(['cms.template_designer'])],
    ['the curator capability alone', puSession(['cms.taxonomy_curator'])],
    ['no capability', puSession([])],
    ['no acting party', { ...puSession(), actingPartyId: null }],
  ])(
    '%s is 403 capability_missing with no quota and no port call',
    async (_n, session) => {
      const harness = createPatternUpdateHarness({
        resolveSession: async () => ({ ok: true, value: session }),
      });
      const response = await send(harness);
      expect(response.status).toBe(403);
      expect(await body(response)).toMatchObject({
        code: 'COMPOSITION_FORBIDDEN',
        details: { reasonCode: 'capability_missing' },
      });
      expect(harness.rateLimit).not.toHaveBeenCalled();
      expect(probe.port(harness).mock.calls).toHaveLength(0);
    },
  );

  it('a disallowed origin is 403 before the session is even resolved', async () => {
    const harness = createPatternUpdateHarness();
    const response = await send(harness, {
      ...probe.init(),
      headers: {
        ...(probe.init().headers as object),
        origin: 'https://evil.example.test',
      },
    });
    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(harness.resolveSession).not.toHaveBeenCalled();
  });

  it('an unauthenticated session is the typed 401 and nothing else runs', async () => {
    const harness = createPatternUpdateHarness({
      resolveSession: async () => ({
        ok: false,
        status: 401,
        code: 'PRIVATE',
        message: 'private',
        details: { secret: 'x' },
      }),
    });
    const response = await send(harness);
    expect(response.status).toBe(401);
    expect(await body(response)).toMatchObject({
      code: 'UNAUTHENTICATED',
      details: { recoveryAction: 'reauthenticate' },
    });
    expect(harness.rateLimit).not.toHaveBeenCalled();
  });

  it.each([
    [
      'throws',
      async () => {
        throw new Error('boom');
      },
      503,
    ],
    ['answers a non-envelope', async () => 'nope', 502],
    ['answers a null value', async () => ({ ok: true, value: null }), 401],
    [
      'answers a malformed session',
      async () => ({ ok: true, value: { userId: 'not-a-uuid' } }),
      401,
    ],
  ])('a session resolver that %s is $2', async (_n, resolveSession, status) => {
    const harness = createPatternUpdateHarness({
      resolveSession: resolveSession as never,
    });
    const response = await send(harness);
    expect(response.status).toBe(status);
    if (status === 503) expect(response.headers.get('retry-after')).toBe('15');
    expect(harness.rateLimit).not.toHaveBeenCalled();
  });

  it('a denied quota is 429 with the BE00 headers and no port call', async () => {
    const rateLimit = vi.fn<CmsPatternUpdateDependencies['rateLimit']>(
      async (input) => ({
        ok: true,
        value: {
          allowed: false,
          limit: input.limit,
          remaining: 0,
          resetAt: 41,
        },
      }),
    );
    const harness = createPatternUpdateHarness({ rateLimit });
    const response = await send(harness);
    const spec = PATTERN_UPDATE_OPERATIONS[probe.id];
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('40');
    expect(response.headers.get('ratelimit-limit')).toBe(String(spec.user));
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    expect(response.headers.get('ratelimit-reset')).toBe('41');
    expect(await body(response)).toMatchObject({
      code: 'RATE_LIMITED',
      details: { retryAfterSeconds: 40, limit: spec.user, resetAt: '41' },
    });
    expect(rateLimit).toHaveBeenCalledTimes(1);
    expect(probe.port(harness).mock.calls).toHaveLength(0);
  });

  it('a quota already past its reset still waits at least one second', async () => {
    const harness = createPatternUpdateHarness({
      rateLimit: async (input) => ({
        ok: true,
        value: { allowed: false, limit: input.limit, remaining: 0, resetAt: 0 },
      }),
    });
    expect(Number((await send(harness)).headers.get('retry-after'))).toBe(1);
  });

  it('the party bucket is charged after the user bucket and can deny on its own', async () => {
    const harness = createPatternUpdateHarness({
      rateLimit: async (input) => ({
        ok: true,
        value: {
          allowed: input.rateScope === 'user',
          limit: input.limit,
          remaining: 0,
          resetAt: 1_002,
        },
      }),
    });
    const response = await send(harness);
    expect(response.status).toBe(429);
    expect(response.headers.get('ratelimit-limit')).toBe(
      String(PATTERN_UPDATE_OPERATIONS[probe.id].party),
    );
  });

  it.each([
    [
      'throws',
      async () => {
        throw new Error('boom');
      },
      503,
    ],
    ['answers a non-envelope', async () => 7, 502],
    [
      'answers a decision for another limit',
      async () => ({
        ok: true,
        value: { allowed: true, limit: 1, remaining: 0, resetAt: 0 },
      }),
      502,
    ],
    [
      'refuses itself',
      async () => ({ ok: false, status: 503, code: 'X', message: 'x' }),
      503,
    ],
  ])('a rate limiter that %s is $2', async (_n, rateLimit, status) => {
    const harness = createPatternUpdateHarness({
      rateLimit: rateLimit as never,
    });
    expect((await send(harness)).status).toBe(status);
    expect(probe.port(harness).mock.calls).toHaveLength(0);
  });
});

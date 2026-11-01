import { describe, expect, it, vi } from 'vitest';

import { createProductionCmsPatternUpdateDependencies } from './cms-composition-production-pattern-update';
import {
  createPupHarness,
  pupAuthentication,
  pupEnvironment,
} from './cms-composition-production-pattern-update.test-support';
import {
  acceptBody,
  acceptResource,
  diffResource,
  PU_ENTRY_ETAG,
  PU_ORIGIN,
  PU_SELECTOR_PATH,
  PU_TYPE_ID,
  PU_UPDATE_PATH,
  puDiffPath,
  puId,
  selectorPage,
} from './cms-composition/pattern-update.test-support';
import { puSession } from './cms-composition/pattern-update-routes.test-support';

/**
 * Composition-time configuration, the freshness of the server context between admission and the call, the quota seam
 * and the telemetry sink of the CMS-03C-13/14/15 production boundary.
 */
const json = (value: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });
const SELECTOR = `${PU_SELECTOR_PATH}?contentTypeId=${PU_TYPE_ID}`;

describe('composition-time configuration', () => {
  const create = (overrides: Record<string, unknown>) =>
    createProductionCmsPatternUpdateDependencies({
      environment: pupEnvironment,
      fetchImpl: vi.fn() as never,
      humanOrigins: [PU_ORIGIN],
      ...overrides,
    });

  it.each([
    ['a zero deadline', { deadlineMs: 0 }],
    ['a fractional deadline', { deadlineMs: 1.5 }],
    ['a non-finite deadline', { deadlineMs: Number.NaN }],
    ['a zero response budget', { maxResponseBytes: 0 }],
    ['a fractional response budget', { maxResponseBytes: 10.5 }],
  ])('refuses %s at composition', (_n, overrides) => {
    expect(() => create(overrides)).toThrow(
      'Invalid CMS pattern update production configuration.',
    );
  });

  it('refuses an origin allowlist with a wildcard or a path', () => {
    expect(() => create({ humanOrigins: ['*'] })).toThrow();
    expect(() =>
      create({ humanOrigins: ['https://cms.example.test/app'] }),
    ).toThrow();
  });

  it('reads the human origins from the environment when none are injected', () => {
    const dependencies = createProductionCmsPatternUpdateDependencies({
      environment: {
        ...pupEnvironment,
        CMS_HUMAN_ORIGINS: `${PU_ORIGIN}, https://other.example.test`,
      },
      fetchImpl: vi.fn() as never,
    });
    expect(dependencies.humanOrigins).toEqual([
      PU_ORIGIN,
      'https://other.example.test',
    ]);
  });

  it('a larger deployment response budget never raises the 512 KiB ceiling', async () => {
    const body = JSON.stringify({ pad: 'x'.repeat(600_000) });
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(body, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const response = await createPupHarness(fetchImpl, {
      maxResponseBytes: 10_000_000,
    }).request(puDiffPath());
    expect(response.status).toBe(502);
  });

  it('a smaller deployment response budget lowers every operation', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(selectorPage()));
    const response = await createPupHarness(fetchImpl, {
      maxResponseBytes: 64,
    }).request(SELECTOR);
    expect(response.status).toBe(502);
  });

  it('a deployment deadline narrows the transport deadline', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise(() => undefined));
    const response = await createPupHarness(fetchImpl, {
      deadlineMs: 20,
    }).request(SELECTOR);
    expect(response.status).toBe(504);
  });
});

describe('the server context is fresh at the call', () => {
  it('a session resolver the boundary did not record (hand-supplied) is 401 and starts no call', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(selectorPage()));
    const response = await createPupHarness(fetchImpl, {
      resolveSession: async () => ({ ok: true, value: puSession() }),
    }).request(SELECTOR);
    expect(response.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('a fresh resolution that fails is the failure of the call, with no network call', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(selectorPage()));
    const harness = createPupHarness(fetchImpl);
    harness.auth.resolveSession
      .mockResolvedValueOnce({ ok: true, value: pupAuthentication })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'x',
      } as never);
    const response = await harness.request(SELECTOR);
    expect(response.status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('a grant revoked between admission and the call is 403 capability_missing before the network', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(selectorPage()));
    const capabilities = vi
      .fn()
      .mockResolvedValueOnce(['cms.author'])
      .mockResolvedValueOnce([]);
    const response = await createPupHarness(fetchImpl, {
      resolveCapabilities: capabilities,
    }).request(SELECTOR);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      details: { reasonCode: 'capability_missing' },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('an acting party switched between admission and the call is 401 before the network', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(selectorPage()));
    const harness = createPupHarness(fetchImpl);
    harness.auth.resolveSession
      .mockResolvedValueOnce({ ok: true, value: pupAuthentication })
      .mockResolvedValueOnce({
        ok: true,
        value: { ...pupAuthentication, actingPartyId: puId(70) },
      });
    const response = await harness.request(SELECTOR);
    expect(response.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('quota seam and telemetry', () => {
  it('fails closed (503 rate_limiter) when no rate limiter is composed', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(selectorPage()));
    const harness = createPupHarness(fetchImpl, {
      rateLimit: undefined,
    } as never);
    const response = await harness.request(SELECTOR);
    expect(response.status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('logs one scrubbed event per request with the operation name, and marks a failure high risk', async () => {
    const info = vi.fn();
    const logger = { info, warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const fetchImpl = vi.fn<typeof fetch>(async (url) => {
      const target = String(url);
      return target.endsWith('cms_list_pattern_selector')
        ? json(selectorPage())
        : target.endsWith('cms_get_instance_update_diff')
          ? json(diffResource())
          : json(acceptResource(1), { etag: PU_ENTRY_ETAG });
    });
    const harness = createPupHarness(fetchImpl, { logger: logger as never });
    await harness.request(SELECTOR);
    await harness.request(puDiffPath());
    await harness.request(PU_UPDATE_PATH, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'pattern-update-0001',
        'if-match': '"7"',
      },
      body: JSON.stringify(acceptBody(1)),
    });
    await harness.request(`${PU_SELECTOR_PATH}?x=1`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const events = info.mock.calls.map(([event, options]) => ({
      operation: event.operation,
      outcome: event.outcome,
      status: event.attributes.status,
      eventName: event.eventName,
      highRisk: options.highRisk,
      runbook: event.attributes.runbook,
    }));
    expect(events).toEqual([
      {
        operation: 'cms.composition.pattern.select',
        outcome: 'success',
        status: 200,
        eventName: 'cms.composition.pattern.request',
        highRisk: false,
        runbook: 'cms-composition',
      },
      {
        operation: 'cms.composition.pattern.update_diff',
        outcome: 'success',
        status: 200,
        eventName: 'cms.composition.pattern.request',
        highRisk: false,
        runbook: 'cms-composition',
      },
      {
        operation: 'cms.composition.pattern.update',
        outcome: 'success',
        status: 200,
        eventName: 'cms.composition.pattern.request',
        highRisk: false,
        runbook: 'cms-composition',
      },
      {
        operation: 'cms.composition.pattern.select',
        outcome: 'rejected',
        status: 400,
        eventName: 'cms.composition.pattern.request',
        highRisk: true,
        runbook: 'cms-composition',
      },
    ]);
    expect(JSON.stringify(info.mock.calls)).not.toContain(PU_TYPE_ID);
  });

  it('uses the default logger when none is injected', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(selectorPage()));
    const response = await createPupHarness(fetchImpl).request(SELECTOR);
    expect(response.status).toBe(200);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import { failure } from './pattern-instance-contracts';
import {
  body,
  PROBES,
  type Harness,
} from './pattern-update-admission.test-support';
import {
  allowRate,
  createPatternUpdateHarness,
  puSession,
} from './pattern-update-routes.test-support';
import { PU_REQUEST_ID } from './pattern-update.test-support';

/**
 * Port failures mapped to the composition catalog (BE03c 1294-1304), the registry deadline, abort handling and telemetry of
 * the three linked-update operations, one probe each over the matrix of `pattern-update-admission.test-support.ts`.
 */
afterEach(() => {
  vi.useRealTimers();
});

describe.each(PROBES)('$id faults', (probe) => {
  const send = (harness: Harness, init: RequestInit = probe.init()) =>
    harness.request(probe.path, init);

  it('a port refusal is mapped to the composition catalog with no private member', async () => {
    const harness = createPatternUpdateHarness();
    probe.port(harness).mockResolvedValueOnce({
      ok: false,
      status: 404,
      code: 'PRIVATE',
      message: 'private sql text',
      details: { secret: 'x', reasonCode: 'capability_missing' },
    } as never);
    const response = await send(harness);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: 'COMPOSITION_NOT_FOUND',
      message:
        'COMPOSITION_NOT_FOUND: composition operation rejected or unavailable.',
      requestId: PU_REQUEST_ID,
      details: {},
    });
    expect(response.headers.get('etag')).toBeNull();
  });

  it.each([502, 503, 504] as const)(
    'a port dependency fault of %i is DEPENDENCY_UNAVAILABLE, retryable, with Retry-After',
    async (status) => {
      const harness = createPatternUpdateHarness();
      probe
        .port(harness)
        .mockResolvedValueOnce(failure(status, {}, 9) as never);
      const response = await send(harness);
      expect(response.status).toBe(status);
      expect(await body(response)).toMatchObject({
        code: 'DEPENDENCY_UNAVAILABLE',
        details: { dependencyClass: 'cms_composition', retryable: true },
      });
      expect(response.headers.get('retry-after')).toBe(
        status === 502 ? null : '9',
      );
    },
  );

  it('a status outside the catalog is the scrubbed 500', async () => {
    const harness = createPatternUpdateHarness();
    probe.port(harness).mockResolvedValueOnce({
      ok: false,
      status: 418,
      code: 'X',
      message: 'x',
    } as never);
    const response = await send(harness);
    expect(response.status).toBe(500);
    expect(await body(response)).toMatchObject({
      code: 'INTERNAL_ERROR',
      details: {},
    });
  });

  it('a port that throws is 503, one that answers a non-envelope is 502', async () => {
    const thrown = createPatternUpdateHarness();
    probe.port(thrown).mockImplementationOnce((async () => {
      throw new Error('boom');
    }) as never);
    expect((await send(thrown)).status).toBe(503);
    const bad = createPatternUpdateHarness();
    probe.port(bad).mockResolvedValueOnce('nope' as never);
    expect((await send(bad)).status).toBe(502);
  });

  it(`a port that never answers is 504 at the ${probe.deadlineMs} ms registry deadline`, async () => {
    vi.useFakeTimers();
    let seen: AbortSignal | undefined;
    const harness = createPatternUpdateHarness();
    probe.port(harness).mockImplementationOnce(((
      _input: unknown,
      signal: AbortSignal,
    ) => {
      seen = signal;
      return new Promise(() => undefined);
    }) as never);
    const pending = send(harness);
    await vi.advanceTimersByTimeAsync(probe.deadlineMs - 1);
    expect(seen?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const response = await pending;
    expect(response.status).toBe(504);
    expect(response.headers.get('retry-after')).toBe('15');
    expect(seen?.aborted).toBe(true);
  });

  it('a caller that aborts is 504 and the port signal aborts with it', async () => {
    const controller = new AbortController();
    let seen: AbortSignal | undefined;
    const harness = createPatternUpdateHarness();
    probe.port(harness).mockImplementationOnce(((
      _input: unknown,
      signal: AbortSignal,
    ) => {
      seen = signal;
      queueMicrotask(() => controller.abort());
      return new Promise(() => undefined);
    }) as never);
    const response = await send(harness, {
      ...probe.init(),
      signal: controller.signal,
    });
    expect(response.status).toBe(504);
    expect(seen?.aborted).toBe(true);
  });

  it('a request already aborted never reaches a port', async () => {
    const controller = new AbortController();
    controller.abort();
    const harness = createPatternUpdateHarness();
    const response = await send(harness, {
      ...probe.init(),
      signal: controller.signal,
    });
    expect(response.status).toBe(504);
    expect(probe.port(harness).mock.calls).toHaveLength(0);
  });

  it('an abort between the two quota buckets stops before the second', async () => {
    const controller = new AbortController();
    const harness = createPatternUpdateHarness({
      rateLimit: vi.fn(async (input: { limit: number }) => {
        controller.abort();
        return allowRate(input);
      }) as never,
    });
    const response = await send(harness, {
      ...probe.init(),
      signal: controller.signal,
    });
    expect(response.status).toBe(504);
    expect(probe.port(harness).mock.calls).toHaveLength(0);
  });

  it('emits one telemetry event and never lets telemetry change the answer', async () => {
    const harness = createPatternUpdateHarness();
    await send(harness);
    expect(harness.telemetry).toHaveBeenCalledWith({
      operationId: probe.id,
      requestId: PU_REQUEST_ID,
      status: 200,
      outcome: 'success',
      actorClass: 'human',
      durationMs: 0,
      // BE03c Observability (P2-S12-AC-263/264): the request event also carries its observation.
      observation: expect.any(Object),
    });
    for (const telemetry of [
      () => {
        throw new Error('sync');
      },
      () => Promise.reject(new Error('async')),
    ]) {
      const noisy = createPatternUpdateHarness({ telemetry });
      expect((await send(noisy)).status).toBe(200);
    }
    const failed = createPatternUpdateHarness({
      resolveSession: async () => ({
        ok: false,
        status: 401,
        code: 'U',
        message: 'u',
      }),
    });
    await send(failed);
    expect(failed.telemetry.mock.calls[0]?.[0]).toMatchObject({
      status: 401,
      outcome: 'rejected',
    });
    const broken = createPatternUpdateHarness();
    probe.port(broken).mockResolvedValueOnce(failure(503) as never);
    await send(broken);
    expect(broken.telemetry.mock.calls[0]?.[0]).toMatchObject({
      status: 503,
      outcome: 'failure',
    });
  });

  it('an unexpected throw inside the route is the scrubbed 500 in the BE00 envelope', async () => {
    const harness = createPatternUpdateHarness({
      resolveSession: async () => ({
        ok: true,
        value: {
          ...puSession(),
          get capabilities(): readonly string[] {
            throw new Error('boom');
          },
        },
      }),
    });
    const response = await send(harness);
    expect(response.status).toBe(500);
    expect(await body(response)).toMatchObject({
      code: 'INTERNAL_ERROR',
      details: {},
    });
    expect(harness.telemetry.mock.calls[0]?.[0]).toMatchObject({
      outcome: 'failure',
    });
  });
});

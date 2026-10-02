import { describe, expect, it, vi } from 'vitest';

import type { CmsEditorialSession } from './cms-editorial/types';
import type { WorkerApp, WorkerBindings, WorkerDependencies } from './index';
import { createProductionWorkerAppRuntime } from './production-worker-runtime';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PARTY_ID = '22222222-2222-4222-8222-222222222222';

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-10-runtime',
  SUPABASE_SECRET_KEY: 'sb_secret_slice_10_runtime',
  SUPABASE_URL: 'https://supabase.example.test',
};

/**
 * Capture the WorkerDependencies the runtime hands to createApp. The CMS
 * editorial lane is served only when the cmsEditorial key is present here, so
 * these assertions are the served-route composition proof, not an adapter unit
 * test.
 */
const captureDependencies = (
  options: Parameters<typeof createProductionWorkerAppRuntime>[7],
): {
  runtime: WorkerApp;
  dependencies: () => WorkerDependencies | undefined;
} => {
  let captured: WorkerDependencies | undefined;
  const createApp = vi.fn((dependencies: WorkerDependencies) => {
    captured = dependencies;
    return {} as WorkerApp;
  });
  const runtime = createProductionWorkerAppRuntime(
    createApp,
    environment,
    vi.fn(async () => Response.json([])),
    undefined,
    undefined,
    undefined,
    undefined,
    options,
  );
  return { runtime, dependencies: () => captured };
};

describe('production Worker runtime CMS editorial composition', () => {
  it('injects the editorial bundle even when no origins or seams are configured', async () => {
    const { runtime, dependencies } = captureDependencies(undefined);
    expect(runtime).toEqual({});
    const cmsEditorial = dependencies()?.cmsEditorial;
    expect(cmsEditorial).toBeDefined();
    if (cmsEditorial === undefined) return;
    expect(cmsEditorial.humanOrigins).toEqual([]);
    expect(typeof cmsEditorial.ports.appendRevision).toBe('function');
    expect(typeof cmsEditorial.ports.listRevisions).toBe('function');
    // The runtime wires its real auth bundle into the editorial session seam,
    // so a request carrying no session fails closed with 401 rather than being
    // admitted. A 503 here would mean the auth seam was never threaded in.
    await expect(
      cmsEditorial.resolveSession(
        new Request('https://api.example.test/api/v1/cms/entries'),
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 401,
      code: 'UNAUTHENTICATED',
    });
    // The runtime threads its shared auth limiter into the editorial rate
    // seam, so the call reaches the upstream limiter RPC. The mock fetch
    // returns a body the limiter cannot validate, so the adapter fails closed
    // with a 502 rather than allowing. A 503 (no limiter) would mean the auth
    // bundle was never threaded in.
    await expect(
      cmsEditorial.rateLimit(
        {
          operationId: 'CMS-03B-01',
          request: new Request('https://api.example.test/api/v1/cms/entries'),
          actorId: USER_ID,
          actingPartyId: PARTY_ID,
          principalClass: 'human',
          rateClass: 'cms.editorial.revision',
          limit: 120,
          windowSeconds: 60,
          rateScope: 'user',
        },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      ok: false,
      status: 502,
      code: 'DEPENDENCY_INVALID_RESPONSE',
    });
  });

  it('threads injected session and rate seams through the composed bundle', async () => {
    const session: CmsEditorialSession = {
      userId: USER_ID,
      actingPartyId: PARTY_ID,
      capabilities: ['cms.author'],
      mfaFresh: true,
    };
    const resolveSession = vi.fn(async () => ({
      ok: true as const,
      value: session,
    }));
    const rateLimit = vi.fn(async (input: { limit: number }) => ({
      ok: true as const,
      value: {
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: 1_788_236_460,
      },
    }));
    const { dependencies } = captureDependencies({
      resolveSession,
      rateLimit,
    } as never);
    const cmsEditorial = dependencies()?.cmsEditorial;
    expect(cmsEditorial?.humanOrigins).toEqual([]);
    if (cmsEditorial === undefined) return;
    await expect(
      cmsEditorial.resolveSession(
        new Request('https://api.example.test/api/v1/cms/entries'),
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ ok: true, value: session });
    await expect(
      cmsEditorial.rateLimit(
        {
          operationId: 'CMS-03B-01',
          request: new Request('https://api.example.test/api/v1/cms/entries'),
          actorId: USER_ID,
          actingPartyId: PARTY_ID,
          principalClass: 'human',
          rateClass: 'cms.editorial.revision',
          limit: 240,
          windowSeconds: 60,
          rateScope: 'party',
        },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ ok: true, value: { remaining: 239 } });
    expect(rateLimit).toHaveBeenCalledOnce();
  });

  it('honours deployment overrides for origins and deadline', () => {
    const { dependencies } = captureDependencies({
      humanOrigins: ['https://override.example.test'],
      deadlineMs: 5_000,
    } as never);
    const cmsEditorial = dependencies()?.cmsEditorial;
    expect(cmsEditorial?.humanOrigins).toEqual([
      'https://override.example.test',
    ]);
    expect(cmsEditorial?.deadlineMs).toBe(5_000);
  });
});

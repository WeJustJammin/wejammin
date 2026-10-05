import { describe, expect, it, vi } from 'vitest';

import { createCmsRelatedContentApp } from './related-content-routes';
import {
  dependencies,
  ENTRY_ID,
  request,
  REQUEST_ID,
  validResource,
  type CmsRelatedContentPortResult,
} from './related-content-routes.test-support';

describe('CMS-03C-05 success and runtime resilience', () => {
  it('admits a contract-shaped resource to 201 with stable headers', async () => {
    const resource = validResource();
    const response = await createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () => ({ ok: true, value: resource }),
      }),
    ).request(request());
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://cms.example.test',
    );
    expect(await response.json()).toMatchObject({
      id: ENTRY_ID,
      sourceEntryId: ENTRY_ID,
      version: '2',
    });
  });

  it('aborts rate and mutation when admission completes only after the deadline', async () => {
    vi.useFakeTimers();
    try {
      const rateLimit = vi.fn(dependencies().rateLimit);
      const actRelatedContent = vi.fn(
        async (): Promise<CmsRelatedContentPortResult> => ({
          ok: false,
          status: 503,
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'unreachable',
        }),
      );
      let notifySignal!: () => void;
      const signalCaptured = new Promise<void>((resolve) => {
        notifySignal = resolve;
      });
      const responsePromise = createCmsRelatedContentApp(
        dependencies({
          rateLimit,
          actRelatedContent,
          resolveSession: async (_request, signal) => {
            notifySignal();
            return new Promise((resolve) =>
              signal.addEventListener('abort', () =>
                resolve({
                  ok: true,
                  value: {
                    userId: '10000000-0000-4000-8000-000000000001',
                    actingPartyId: '40000000-0000-4000-8000-000000000004',
                    capabilities: ['cms.author'],
                    mfaFresh: true,
                  },
                }),
              ),
            );
          },
        }),
      ).request(request());
      await signalCaptured;
      await vi.advanceTimersByTimeAsync(15_000);
      expect((await responsePromise).status).toBe(504);
      await Promise.resolve();
      expect(rateLimit).not.toHaveBeenCalled();
      expect(actRelatedContent).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('maps unexpected execution failures to a safe 500 and ignores telemetry rejection', async () => {
    let nowCalls = 0;
    const internal = await createCmsRelatedContentApp(
      dependencies({
        now: () => {
          nowCalls += 1;
          if (nowCalls === 2) throw new Error('private clock failure');
          return 1_000;
        },
        rateLimit: async (input) => ({
          ok: true,
          value: {
            allowed: false,
            limit: input.limit,
            remaining: 0,
            resetAt: 2_000,
          },
        }),
      }),
    ).request(request());
    expect(internal.status).toBe(500);
    expect(await internal.text()).not.toContain('private clock failure');
    const successful = await createCmsRelatedContentApp(
      dependencies({
        telemetry: () => Promise.reject(new Error('private telemetry failure')),
        actRelatedContent: async () => ({ ok: true, value: validResource() }),
      }),
    ).request(request());
    expect(successful.status).toBe(201);
  });
});

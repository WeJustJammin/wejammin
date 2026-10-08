import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  appendRequest,
  authoringContextRequest,
  conflictDetailRequest,
  createRequest,
  draftDetailRequest,
  historyRequest,
  listRequest,
  rateSeam,
  resolveRequest,
  restoreRequest,
  sessionSeam,
  wiredApp,
} from './cms-editorial-production-app.test-support';

/**
 * Client cancellation and the per-operation route deadline, driven through the
 * real route -> production adapter chain with only the PostgREST edge faked
 * (BE03b:1379 remote seams; Codex write-path audit "Write routes do not
 * propagate client aborts"; gap audit WP-B 2-3).
 */

type Send = (
  app: ReturnType<typeof wiredApp>,
  signal?: AbortSignal,
) => Promise<Response> | Response;

const OPERATIONS: readonly (readonly [string, string, Send])[] = [
  [
    'CMS-03B-01',
    'append revision',
    (app, signal) => appendRequest(app, {}, signal),
  ],
  ['CMS-03B-02', 'resolve conflict', resolveRequest],
  ['CMS-03B-03', 'revision history', historyRequest],
  ['CMS-03B-04', 'restore revision', restoreRequest],
  ['CMS-03B-10', 'create entry', createRequest],
  ['CMS-03B-11', 'draft detail', draftDetailRequest],
  ['CMS-03B-12', 'conflict detail', conflictDetailRequest],
  ['CMS-03B-13', 'entry list', (app, signal) => listRequest(app, '', signal)],
  ['CMS-03B-14', 'authoring context', authoringContextRequest],
];

afterEach(() => {
  vi.useRealTimers();
});

describe('client cancellation reaches the RPC', () => {
  it.each(OPERATIONS)(
    '[P2-S10-AC-007] [P2-S10-AC-091] %s (%s) aborts the in-flight PostgREST call when the client disconnects',
    async (_operation, _label, send) => {
      const controller = new AbortController();
      let upstream: AbortSignal | undefined;
      const fetchImpl = vi.fn(
        (_url: unknown, init?: RequestInit) =>
          new Promise<Response>(() => {
            upstream = init?.signal as AbortSignal;
          }),
      );
      const app = wiredApp(fetchImpl as unknown as typeof fetch);
      const pending = Promise.resolve(send(app, controller.signal));
      await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
      controller.abort('client closed');
      // The route must answer promptly on disconnect, not ride out its own
      // 8,000 / 15,000 ms deadline.
      const settled = await Promise.race([
        pending,
        new Promise<'hung'>((resolve) =>
          setTimeout(() => resolve('hung'), 1_500),
        ),
      ]);
      expect(settled).not.toBe('hung');
      expect((settled as Response).status).toBe(504);
      expect(upstream?.aborted).toBe(true);
    },
  );

  it.each(OPERATIONS)(
    '%s (%s) never calls PostgREST for a request that is already cancelled',
    async (_operation, _label, send) => {
      const fetchImpl = vi.fn(async () => new Response('{}'));
      const app = wiredApp(fetchImpl as unknown as typeof fetch);
      const response = await send(app, AbortSignal.abort('client closed'));
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );
});

describe('read routes spend one 8,000 ms budget (BE03b:152-165)', () => {
  it.each([
    ['CMS-03B-03', historyRequest],
    ['CMS-03B-11', draftDetailRequest],
  ] as const)(
    '[P2-S10-AC-020] [P2-S10-AC-071] %s clamps the cumulative route deadline to 8,000 ms even though the production default is 15,000 ms',
    async (_operation, send) => {
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'],
      });
      const fetchImpl = vi.fn(() => new Promise<Response>(() => undefined));
      const app = wiredApp(fetchImpl as unknown as typeof fetch, {
        // The slow session leaves 3,000 ms of the 8,000 ms budget, so a
        // port that starts its own fresh 8,000 ms clock would end at 13,000.
        resolveSession: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5_000));
          return sessionSeam();
        },
        rateLimit: rateSeam,
      });
      let status: number | null = null;
      void Promise.resolve(send(app)).then((response) => {
        status = response.status;
      });
      await vi.advanceTimersByTimeAsync(5_000);
      expect(status).toBeNull();
      await vi.advanceTimersByTimeAsync(3_100);
      expect(status).toBe(504);
    },
  );
});

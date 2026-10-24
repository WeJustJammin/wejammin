import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BROWSER_OPERATIONS,
  type SpecOperation,
} from './phase-02-slice-12-registry-parity-fixture';
import {
  WORKER_ENVIRONMENT,
  discoverWorkerApp,
  requestFor,
} from './phase-02-slice-12-registry-parity-worker.test-support';

/*
 * P2-S12-AC-275, part 4: the deadline each discovered Hono route enforces equals the BE03c
 * timeout of its registry row. A session dependency that never answers leaves only the route's
 * own deadline timer to end the request (BE00: 504 with the BE00 ApiError).
 */

afterEach(() => {
  vi.useRealTimers();
});

const hangingApp = () =>
  discoverWorkerApp({
    resolveSession: () => new Promise(() => undefined),
  });

describe.each(
  BROWSER_OPERATIONS.map((operation) => [operation.id, operation] as const),
)('[P2-S12-AC-275] Worker deadline %s', (_id, expected: SpecOperation) => {
  it('[P2-S12-AC-275] ends a stalled request with 504 at exactly its BE03c timeout and not before', async () => {
    vi.useFakeTimers();
    const app = hangingApp();
    let status: number | undefined;
    const pending = Promise.resolve(
      app.request(requestFor(expected), undefined, WORKER_ENVIRONMENT),
    ).then((response) => {
      status = response.status;
      return response;
    });
    await vi.advanceTimersByTimeAsync(expected.timeoutMs - 1);
    expect(
      status,
      `${expected.id} before ${expected.timeoutMs} ms`,
    ).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    const response = await pending;
    expect(status).toBe(504);
    expect(((await response.json()) as { code: string }).code).toBeDefined();
  });
});

import { CMS_SCHEDULE_DEADLINE_MS } from '@wejammin/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AsyncWorkerBindings } from './async-entrypoint';
import { ASYNC_RPC_DEADLINE_MS } from './async-runtime-rpc-types';
import { createSupabaseRpc } from './async-runtime-rpc-transport';
import { cleanInput } from './cms-editorial/a11y-structural/a11y-structural.test-support';
import { runProductionCmsPublicationScheduleSweep } from './cms-publication-schedule-sweep';

/*
 * P2-S11-AC-082: the CMS-03B-20 sweep "runs claim and execute under the
 * 15,000 ms job deadline". The constant `CMS_SCHEDULE_DEADLINE_MS` is declared
 * by the contract; this suite proves the sweep really applies it: a claim or an
 * execute RPC that never answers is aborted at exactly 15,000 ms (not before),
 * the claim then asks the platform to retry the tick, and the execute is logged
 * as retryable and left to the lease and the database retry ladder.
 */

const secret = 'sb_secret_schedule_sweep_deadline_test_only';
const bindings = {
  APP_ENVIRONMENT: 'production',
  APP_RELEASE: 'test-release',
  SUPABASE_SECRET_KEY: secret,
  SUPABASE_URL: 'https://schedule-sweep.example.supabase.co/',
} as unknown as AsyncWorkerBindings;

const gate = cleanInput();
const claim = {
  scheduleId: '123e4567-e89b-42d3-a456-426614174001',
  revisionId: gate.revisionId,
  scheduleVersion: '2',
  expectedVersion: '2',
  leaseId: '223e4567-e89b-42d3-a456-426614174001',
  dependencyHash: gate.dependencyHash,
  activationEvidenceHash: 'b'.repeat(64),
  correlationId: '323e4567-e89b-42d3-a456-426614174001',
};

type Deferred<T> = Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
}>;

const deferred = <T>(): Deferred<T> => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

/**
 * Stub the edge: the named RPC is answered by `answers`; `hung` never answers
 * and hands its abort signal to the test as soon as the sweep calls it.
 */
const stubEdge = (
  answers: Readonly<Record<string, () => Response>>,
  hung: string,
) => {
  const hungSignal = deferred<AbortSignal>();
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const name = String(input).split('/rpc/')[1] as string;
      calls.push(name);
      if (name === hung) {
        hungSignal.resolve(init?.signal as AbortSignal);
        return new Promise<Response>(() => undefined);
      }
      const answer = answers[name];
      if (answer === undefined) throw new Error(`unexpected ${name}`);
      return answer();
    }),
  );
  return { calls, hungSignal: hungSignal.promise };
};

const logs = () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  return () => JSON.stringify([...info.mock.calls, ...error.mock.calls]);
};

/** Run the sweep and report whether it has settled, without hiding a rejection. */
const startSweep = () => {
  const state = { settled: false };
  const outcome = runProductionCmsPublicationScheduleSweep(bindings).then(
    () => {
      state.settled = true;
      return 'resolved' as const;
    },
    (error: unknown) => {
      state.settled = true;
      return error;
    },
  );
  return { state, outcome };
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the 15,000 ms job deadline', () => {
  it('is the contract deadline the RPC transport enforces and never exceeds', () => {
    expect(CMS_SCHEDULE_DEADLINE_MS).toBe(15_000);
    expect(ASYNC_RPC_DEADLINE_MS).toBe(CMS_SCHEDULE_DEADLINE_MS);
    expect(() =>
      createSupabaseRpc(fetch, { deadlineMs: CMS_SCHEDULE_DEADLINE_MS + 1 }),
    ).toThrow('Async RPC transport limits are invalid.');
  });

  it('aborts a claim that never answers at 15,000 ms and asks the platform to retry the tick', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const edge = stubEdge({}, 'cms_claim_due_publication_schedules');
    const logged = logs();
    const { state, outcome } = startSweep();

    const signal = await edge.hungSignal;
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(CMS_SCHEDULE_DEADLINE_MS - 1);
    expect(signal.aborted).toBe(false);
    expect(state.settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    const error = await outcome;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      'CMS publication schedule sweep requested retry',
    );
    expect(edge.calls).toEqual(['cms_claim_due_publication_schedules']);
    const text = logged();
    expect(text).toContain('cms_publication_schedule_sweep.failed');
    expect(text).toContain('DEPENDENCY_UNAVAILABLE');
    expect(text).toContain('"retryable":true');
    expect(text).not.toContain(secret);
  });

  it('aborts an execute that never answers at 15,000 ms, logs it as retryable and finishes the tick', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const edge = stubEdge(
      {
        cms_claim_due_publication_schedules: () => Response.json([claim]),
        cms_load_quality_gate_input: () => Response.json(gate),
      },
      'cms_execute_publication_schedule',
    );
    const logged = logs();
    const { state, outcome } = startSweep();

    const signal = await edge.hungSignal;
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(CMS_SCHEDULE_DEADLINE_MS - 1);
    expect(signal.aborted).toBe(false);
    expect(state.settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    // A hung execute is one failed schedule, not a failed tick: the lease
    // expires and the database ladder decides (never retried by the sweep).
    await expect(outcome).resolves.toBe('resolved');
    expect(edge.calls).toEqual([
      'cms_claim_due_publication_schedules',
      'cms_load_quality_gate_input',
      'cms_execute_publication_schedule',
    ]);
    const text = logged();
    expect(text).toContain('cms_publication_schedule_sweep.execute_failed');
    expect(text).toContain('DEPENDENCY_UNAVAILABLE');
    expect(text).toContain('cms_publication_schedule_sweep.completed');
    expect(text).not.toContain(claim.scheduleId);
    expect(text).not.toContain(claim.leaseId);
    expect(text).not.toContain(secret);
  });

  it('gives the claim and the execute each their own 15,000 ms', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const claimStarted = deferred<void>();
    const executeSignal = deferred<AbortSignal>();
    const slow = <T>(body: T, delayMs: number) =>
      new Promise<Response>((resolve) => {
        setTimeout(() => resolve(Response.json(body)), delayMs);
      });
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
        const name = String(input).split('/rpc/')[1] as string;
        if (name === 'cms_claim_due_publication_schedules') {
          claimStarted.resolve();
          return slow([claim], CMS_SCHEDULE_DEADLINE_MS - 1);
        }
        if (name === 'cms_load_quality_gate_input') return Response.json(gate);
        executeSignal.resolve(init?.signal as AbortSignal);
        return slow(
          {
            scheduleId: claim.scheduleId,
            outcome: 'completed',
            reasonCode: null,
            publicationVersionId: '423e4567-e89b-42d3-a456-426614174000',
            actualUtc: '2026-11-01T14:30:03Z',
            deviationSeconds: 3,
          },
          CMS_SCHEDULE_DEADLINE_MS - 1,
        );
      }),
    );
    const logged = logs();
    const { outcome } = startSweep();
    await claimStarted.promise;

    // The claim answers 1 ms before its deadline: the tick goes on.
    await vi.advanceTimersByTimeAsync(CMS_SCHEDULE_DEADLINE_MS - 1);
    const signal = await executeSignal.promise;
    expect(signal.aborted).toBe(false);
    // The execute started a fresh window: 14,999 ms more is still in time.
    await vi.advanceTimersByTimeAsync(CMS_SCHEDULE_DEADLINE_MS - 1);
    await expect(outcome).resolves.toBe('resolved');
    expect(signal.aborted).toBe(false);
    expect(logged()).toContain(
      '"cms_schedule_attempt_total{outcome=\\"completed\\"}":1',
    );
  });
});

import { CMS_SCHEDULE_DEADLINE_MS } from '@wejammin/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runProductionCmsGovernedActivationSweep } from './cms-governed-activation-sweep';
import {
  bindings,
  CLAIM_RPC,
  claimFor,
  EXECUTE_RPC,
  logs,
  SECRET,
} from './cms-governed-activation-sweep.test-support';

/*
 * CMS-03C-19 "runs claim and execute under the 15,000 ms job deadline" (BE03c row 188, BE03b Internal service
 * operations). ONE tick of the `scheduled` sweep is the job: its claim and every execute share a single
 * 15,000 ms window that opens when the tick starts. A claim or an execute that never answers is aborted at
 * exactly 15,000 ms of job time, an execute gets only the time the claim left, no further schedule is started
 * once the deadline has passed (the lease and the database retry ladder own the rest), and no timer outlives the tick.
 */

type Deferred<T> = Readonly<{ promise: Promise<T>; resolve: (v: T) => void }>;
const deferred = <T>(): Deferred<T> => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

/** The named RPC is answered by `answers`; `hung` never answers and hands its abort signal to the test. */
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

const startSweep = () => {
  const state = { settled: false };
  const outcome = runProductionCmsGovernedActivationSweep(bindings).then(
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
  it('aborts a claim that never answers at 15,000 ms and asks the platform to retry the tick', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const edge = stubEdge({}, CLAIM_RPC);
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
      'CMS governed activation sweep requested retry',
    );
    expect(edge.calls).toEqual([CLAIM_RPC]);
    const text = logged();
    expect(text).toContain('cms_governed_activation_sweep.failed');
    expect(text).toContain('"retryable":true');
    expect(text).not.toContain(SECRET);
  });

  it('aborts an execute that never answers at 15,000 ms, logs it as retryable and finishes the tick', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const claim = claimFor(1);
    const edge = stubEdge(
      { [CLAIM_RPC]: () => Response.json([claim]) },
      EXECUTE_RPC,
    );
    const logged = logs();
    const { state, outcome } = startSweep();

    const signal = await edge.hungSignal;
    await vi.advanceTimersByTimeAsync(CMS_SCHEDULE_DEADLINE_MS - 1);
    expect(signal.aborted).toBe(false);
    expect(state.settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    // A hung execute is one failed schedule, not a failed tick: the lease expires and the ladder decides.
    await expect(outcome).resolves.toBe('resolved');
    expect(edge.calls).toEqual([CLAIM_RPC, EXECUTE_RPC]);
    const text = logged();
    expect(text).toContain('cms_governed_activation_sweep.execute_failed');
    expect(text).toContain('DEPENDENCY_UNAVAILABLE');
    expect(text).toContain('cms_governed_activation_sweep.completed');
    expect(text).not.toContain(claim.scheduleId);
    expect(text).not.toContain(claim.leaseId);
  });

  it('shares ONE job deadline between the claim and the execute: a claim of 10,000 ms leaves 5,000 ms', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const claimStarted = deferred<void>();
    const executeSignal = deferred<AbortSignal>();
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
        const name = String(input).split('/rpc/')[1] as string;
        if (name === CLAIM_RPC) {
          claimStarted.resolve();
          return new Promise<Response>((resolve) => {
            setTimeout(() => resolve(Response.json([claimFor(1)])), 10_000);
          });
        }
        executeSignal.resolve(init?.signal as AbortSignal);
        return new Promise<Response>(() => undefined);
      }),
    );
    const logged = logs();
    const { state, outcome } = startSweep();
    await claimStarted.promise;

    await vi.advanceTimersByTimeAsync(10_000);
    const signal = await executeSignal.promise;
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(signal.aborted).toBe(false);
    expect(state.settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    await expect(outcome).resolves.toBe('resolved');
    expect(logged()).toContain('cms_governed_activation_sweep.execute_failed');
  });

  it('starts no further schedule once the job deadline has passed and logs how many were left unstarted', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const [first, second] = [claimFor(1), claimFor(2)];
    const edge = stubEdge(
      { [CLAIM_RPC]: () => Response.json([first, second]) },
      EXECUTE_RPC,
    );
    const logged = logs();
    const { outcome } = startSweep();

    const signal = await edge.hungSignal;
    await vi.advanceTimersByTimeAsync(CMS_SCHEDULE_DEADLINE_MS);
    expect(signal.aborted).toBe(true);
    await expect(outcome).resolves.toBe('resolved');
    expect(edge.calls).toEqual([CLAIM_RPC, EXECUTE_RPC]);
    const text = logged();
    expect(text).toContain('cms_governed_activation_sweep.deadline_exceeded');
    expect(text).toContain('"unstarted":1');
    expect(text).toContain('cms_governed_activation_sweep.completed');
    expect(text).not.toContain(second.scheduleId);
  });

  it('leaves no timer behind when the tick finishes inside the deadline', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    stubEdge({ [CLAIM_RPC]: () => Response.json([]) }, 'never_called');
    logs();
    await expect(startSweep().outcome).resolves.toBe('resolved');
    expect(vi.getTimerCount()).toBe(0);
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  answer,
  build,
  context,
  failed,
  input,
  JOB_ID,
  NEXT_JOB,
  raised,
  TOKEN,
  TYPE,
} from './cms-taxonomy-merge-converge.test-support';
import {
  INVOCATION_BUDGET_CAP_MS,
  MAX_JOB_DELIVERIES,
} from './async-runtime-job-context';
import { ASYNC_RPC_DEADLINE_MS } from './async-runtime-rpc-types';
import {
  abortableDelay,
  jitteredPauseMs,
  MERGE_MAX_ATTEMPTS,
  MERGE_RETRY_JITTER_FRACTION,
  MERGE_RETRY_PAUSES_MS,
} from './cms-taxonomy-merge-converge-effect';

/**
 * The `cms.taxonomy.merge_converge` job effect (BE03c 1334, 1351, 1377; lane taxonomy-terms f2 `## RPC boundary`): one
 * fenced call of `platform_api.cms_run_taxonomy_merge_converge` with the claimed job, the job recorded `succeeded` with
 * a non-null result reference (the database refuses a succeeded outcome without one), the continuation job requested
 * by the SQL and never re-queued by the Worker, `batch` omitted. The effect never answers `queued` or manual review.
 */
describe('merge-converge effect: the fenced RPC call', () => {
  it('calls the named RPC once with exactly the claimed job and no batch', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => answer(5000, 0, null));
    const result = await build(fetchImpl)(input(), context());
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_run_taxonomy_merge_converge',
    );
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('content-profile')).toBe('platform_api');
    expect(headers.get('apikey')).toBe('sb_secret_test_only');
    expect(JSON.parse(String(init?.body))).toEqual({
      p_request: {
        claimedJob: { jobId: JOB_ID, version: '2', leaseToken: TOKEN },
      },
    });
    expect(result.state).toBe('succeeded');
  });

  it('uses the version the claim returned, not the pre-claim canonical one', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => answer(1, 0, null));
    await build(fetchImpl)(
      input({
        claimedLease: {
          jobId: JOB_ID,
          leaseToken: TOKEN,
          expectedVersion: '1',
          version: '9007199254740993',
          leaseUntilMs: 400_000,
        },
      }),
      context(),
    );
    expect(
      JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body)).p_request.claimedJob
        .version,
    ).toBe('9007199254740993');
  });
});

describe('merge-converge effect: success dispositions', () => {
  it('a drained tail records the job succeeded with itself as the (mandatory) result reference', async () => {
    const result = await build(
      vi.fn<typeof fetch>(async () => answer(40, 0, null)),
    )(input(), context());
    expect(result).toEqual({
      state: 'succeeded',
      errorCode: null,
      resultRef: { type: TYPE, id: JOB_ID },
    });
  });

  it('a continuation is already a queued BE00 job: the current job is recorded succeeded naming it, never re-queued', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      answer(5000, 40, NEXT_JOB),
    );
    const result = await build(fetchImpl)(input(), context());
    expect(result).toEqual({
      state: 'succeeded',
      errorCode: null,
      resultRef: { type: TYPE, id: NEXT_JOB },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['work remains but no continuation was named', answer(5000, 1, null)],
    ['a continuation is named but nothing remains', answer(5000, 0, NEXT_JOB)],
    ['a malformed continuation id', answer(1, 1, 'not-a-uuid')],
    [
      'a negative count',
      Response.json({ converged: -1, remaining: 0, continuationJobId: null }),
    ],
    [
      'a fractional count',
      Response.json({ converged: 1.5, remaining: 0, continuationJobId: null }),
    ],
    ['a missing member', Response.json({ converged: 1, remaining: 0 })],
    [
      'an extra member',
      Response.json({
        converged: 1,
        remaining: 0,
        continuationJobId: null,
        extra: 1,
      }),
    ],
    ['an array', Response.json([])],
  ])(
    '%s is an invalid answer: retried, then the job fails DEPENDENCY_INVALID_RESPONSE',
    async (_name, reply) => {
      const fetchImpl = vi.fn<typeof fetch>(async () => reply.clone());
      const result = await build(fetchImpl)(input(), context());
      expect(result).toEqual(failed('DEPENDENCY_INVALID_RESPONSE'));
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    },
  );
});

describe('merge-converge effect: refusals', () => {
  it.each([
    ['capability_missing', 'CAPABILITY_MISSING'],
    ['NOT_FOUND', 'MERGE_CONVERGE_JOB_UNKNOWN'],
    ['INVALID_REQUEST', 'MERGE_CONVERGE_REQUEST_INVALID'],
  ])(
    '%s fails the job %s after one call (deterministic, never retried)',
    async (token, code) => {
      const fetchImpl = vi.fn<typeof fetch>(async () => raised(token));
      expect(await build(fetchImpl)(input(), context())).toEqual(failed(code));
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it('CONFLICT (a lock failure, or a stale lease the claim CAS will refuse anyway) is retried twice, then fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => raised('CONFLICT'));
    const sleep = vi.fn(async () => undefined);
    const result = await build(fetchImpl, { sleep })(input(), context());
    expect(result).toEqual(failed('MERGE_CONVERGE_CONFLICT'));
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('pauses 15 s then 60 s between attempts (BE00 platform.job.execute retry schedule), abort-aware', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => raised('CONFLICT'));
    const sleep = vi.fn<(ms: number, signal: AbortSignal) => Promise<void>>(
      async () => undefined,
    );
    const live = context();
    // `random: () => 0` is the jitter-free lower edge; the jitter itself is pinned in its own suite below.
    await build(fetchImpl, { sleep, random: () => 0 })(input(), live);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([15_000, 60_000]);
    expect(sleep.mock.calls.every(([, signal]) => signal === live.signal)).toBe(
      true,
    );
    expect(MERGE_RETRY_PAUSES_MS).toEqual([15_000, 60_000]);
  });

  it('the worst case (every pause plus every call at its deadline) stays inside the invocation budget and the heartbeat point', () => {
    const worstMs =
      MERGE_RETRY_PAUSES_MS.reduce((sum, ms) => sum + ms, 0) +
      MERGE_MAX_ATTEMPTS * ASYNC_RPC_DEADLINE_MS;
    expect(MERGE_RETRY_PAUSES_MS).toHaveLength(MERGE_MAX_ATTEMPTS - 1);
    expect(worstMs).toBe(120_000);
    expect(worstMs).toBeLessThanOrEqual(INVOCATION_BUDGET_CAP_MS);
    // BE00 platform.job.execute: heartbeat before one third of the 300 s lease remains (200 s).
    expect(worstMs).toBeLessThan((300_000 * 2) / 3);
    expect(MAX_JOB_DELIVERIES).toBe(4);
  });

  it('the worst case with every pause at its jitter upper edge stays under the 200 s heartbeat point and the 240 s budget', () => {
    const upperEdge = 1 - Number.EPSILON;
    const jitteredWorstMs =
      MERGE_RETRY_PAUSES_MS.reduce(
        (sum, ms) => sum + jitteredPauseMs(ms, () => upperEdge),
        0,
      ) +
      MERGE_MAX_ATTEMPTS * ASYNC_RPC_DEADLINE_MS;
    // 15 s + 10 % and 60 s + 10 % are 16.5 s and 66 s: at most 127.5 s with three calls at the 15 s deadline.
    expect(jitteredWorstMs).toBeGreaterThan(120_000);
    expect(jitteredWorstMs).toBeLessThanOrEqual(127_500);
    expect(jitteredWorstMs).toBeLessThanOrEqual(INVOCATION_BUDGET_CAP_MS);
    expect(jitteredWorstMs).toBeLessThan((300_000 * 2) / 3);
  });

  it('a transient CONFLICT that clears is converged on the retry', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(raised('CONFLICT'))
      .mockResolvedValueOnce(answer(7, 0, null));
    const result = await build(fetchImpl)(input(), context());
    expect(result.state).toBe('succeeded');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a thrown fetch', () => Promise.reject(new Error('socket closed'))],
    ['a provider 5xx', async () => Response.json({ m: 1 }, { status: 503 })],
    [
      'a provider 4xx without a product token',
      async () => Response.json({ code: 'PGRST202' }, { status: 404 }),
    ],
    ['an unknown platform token', async () => raised('SOMETHING_NEW')],
    [
      'the raised DEPENDENCY_UNAVAILABLE',
      async () => raised('DEPENDENCY_UNAVAILABLE'),
    ],
  ])(
    '%s is retried, then the job fails DEPENDENCY_UNAVAILABLE',
    async (_name, reply) => {
      const fetchImpl = vi.fn<typeof fetch>(reply as never);
      const result = await build(fetchImpl)(input(), context());
      expect(result).toEqual(failed('DEPENDENCY_UNAVAILABLE'));
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    },
  );

  it('never calls again once the invocation budget signal has aborted', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      controller.abort();
      return raised('CONFLICT');
    });
    const result = await build(fetchImpl)(
      input(),
      context({ signal: controller.signal }),
    );
    expect(result).toEqual(failed('DEPENDENCY_UNAVAILABLE'));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not call at all when the budget is already spent', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn<typeof fetch>();
    const result = await build(fetchImpl)(
      input(),
      context({ signal: controller.signal }),
    );
    expect(result).toEqual(failed('DEPENDENCY_UNAVAILABLE'));
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

/**
 * BE00 550 (and BE03c 1302): the retry delays are "15s, 60s ... with bounded jitter". BE00 states no number, so the bound
 * is an implementation decision: +0 to +10 % of the base pause (never earlier than the schedule, so a held lock still
 * has its full time to clear), drawn from an injectable random seam so that the range is testable and the lockstep
 * retry of every party's job in a database outage is broken.
 */
describe('merge-converge effect: bounded jitter on the in-invocation pauses', () => {
  const UPPER_EDGE = 1 - Number.EPSILON;
  const pausesFor = async (
    random?: () => number,
  ): Promise<readonly number[]> => {
    const sleep = vi.fn<(ms: number, signal: AbortSignal) => Promise<void>>(
      async () => undefined,
    );
    await build(
      vi.fn<typeof fetch>(async () => raised('CONFLICT')),
      random === undefined ? { sleep } : { sleep, random },
    )(input(), context());
    return sleep.mock.calls.map(([ms]) => ms);
  };

  it('states the bound: 10 % of the base pause', () => {
    expect(MERGE_RETRY_JITTER_FRACTION).toBe(0.1);
  });

  it('adds nothing at the lower edge of the sample (the schedule is never shortened)', async () => {
    expect(await pausesFor(() => 0)).toEqual([15_000, 60_000]);
  });

  it('adds just under 10 % at the upper edge of the sample, never more', async () => {
    const pauses = await pausesFor(() => UPPER_EDGE);
    expect(pauses).toHaveLength(2);
    pauses.forEach((ms, index) => {
      const base = MERGE_RETRY_PAUSES_MS[index]!;
      expect(ms).toBeGreaterThan(base);
      expect(ms).toBeLessThanOrEqual(base * 1.1);
      expect(Number.isInteger(ms)).toBe(true);
    });
  });

  it('scales the added time linearly with the sample, one independent sample per pause', async () => {
    const samples = [0.5, 0.25];
    const random = vi.fn<() => number>(() => samples.shift() ?? 0);
    expect(await pausesFor(random)).toEqual([15_750, 61_500]);
    expect(random).toHaveBeenCalledTimes(2);
  });

  it('draws a sample only for a pause actually taken', async () => {
    const random = vi.fn<() => number>(() => 0.5);
    const converged = vi.fn<typeof fetch>(async () => answer(3, 0, null));
    const sleep = vi.fn(async () => undefined);
    await build(converged, { sleep, random })(input(), context());
    expect(sleep).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });

  it('rounds the added time down to a whole millisecond', () => {
    // 15,000 ms * 10 % * 0.123456 = 185.184 ms: the pause is 15,185 ms, never a fraction.
    expect(jitteredPauseMs(15_000, () => 0.123456)).toBe(15_185);
    expect(jitteredPauseMs(60_000, () => 0.999999)).toBe(65_999);
  });

  it.each([
    ['NaN', Number.NaN],
    ['negative', -0.5],
    ['exactly one', 1],
    ['above one', 7],
    ['infinite', Number.POSITIVE_INFINITY],
  ])(
    'a sample that is %s from a broken seam adds no jitter (the bound cannot be exceeded)',
    async (_name, sample) => {
      expect(await pausesFor(() => sample)).toEqual([15_000, 60_000]);
      expect(jitteredPauseMs(15_000, () => sample)).toBe(15_000);
    },
  );

  it('defaults to Math.random', async () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      expect(await pausesFor()).toEqual([15_750, 63_000]);
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
    }
  });

  it('every real draw stays inside [base, base + 10 %] over many samples', async () => {
    for (let index = 0; index < 50; index += 1) {
      const pauses = await pausesFor();
      pauses.forEach((ms, position) => {
        const base = MERGE_RETRY_PAUSES_MS[position]!;
        expect(ms).toBeGreaterThanOrEqual(base);
        expect(ms).toBeLessThanOrEqual(base * 1.1);
      });
    }
  });
});

describe('merge-converge effect: totality', () => {
  it('answers only succeeded or failed, with an error code grammar the BE00 outcome accepts', async () => {
    const replies: Array<() => Promise<Response>> = [
      async () => answer(1, 0, null),
      async () => answer(1, 1, NEXT_JOB),
      async () => raised('CONFLICT'),
      async () => raised('capability_missing'),
      async () => Response.json({}, { status: 500 }),
      async () => new Response('<html>', { status: 200 }),
    ];
    for (const reply of replies) {
      const result = await build(vi.fn<typeof fetch>(reply))(
        input(),
        context(),
      );
      expect(['succeeded', 'failed']).toContain(result.state);
      if (result.state === 'succeeded') {
        expect(result.errorCode).toBeNull();
        expect(result.resultRef).not.toBeNull();
      } else {
        expect(result.resultRef).toBeNull();
        expect(result.errorCode).toMatch(/^[A-Z][A-Z0-9_]{0,63}$/u);
      }
    }
  });
});

describe('merge-converge effect: the default pause', () => {
  it('settles at once for an aborted signal and early when the signal aborts, never hanging', async () => {
    const spent = new AbortController();
    spent.abort();
    await expect(abortableDelay(60_000, spent.signal)).resolves.toBeUndefined();
    const live = new AbortController();
    const pending = abortableDelay(60_000, live.signal);
    live.abort();
    await expect(pending).resolves.toBeUndefined();
    await expect(
      abortableDelay(1, new AbortController().signal),
    ).resolves.toBeUndefined();
  });
});

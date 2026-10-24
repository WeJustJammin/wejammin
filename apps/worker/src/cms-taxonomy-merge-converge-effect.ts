import type { JobEffectInput, JobEffectResult } from '@wejammin/application';
import type { Logger } from '@wejammin/observability/logging';

import type { JobEffectDeliveryContext } from './async-runtime-job-context';
import { AsyncRpcRefusalError } from './async-runtime-rpc-errors';
import { createSupabaseRpc } from './async-runtime-rpc-transport';
import {
  CMS_TAXONOMY_MERGE_CONVERGE_JOB_TYPE,
  TAXONOMY_MERGE_JOB_ERROR,
} from './cms-taxonomy-merge-converge-names';
import {
  logMergeSettled,
  mergeLoggerFor,
  type MergeSettlement,
} from './cms-taxonomy-merge-converge-telemetry';
import {
  CmsTaxonomyMergeConvergeResponseError,
  runTaxonomyMergeConverge,
  type ClaimedMergeJob,
} from './cms-taxonomy-merge-converge-rpc';

/**
 * Attempts per delivery (the initial call and two retries) and the pause before each retry: the first two steps of
 * the BE00 `platform.job.execute` retry schedule (15 s, 60 s, 300 s "with bounded jitter"; BE00 550, BE03c 1302). The
 * third step (300 s) does not fit the invocation budget (`min(240000, lease remaining - 60000)` ms), so the base pauses
 * are 15 s and 60 s. BE00 states no numeric jitter bound; the bound is an implementation decision recorded in the lane
 * report (D-F5): each pause gains 0 to 10 % of its base ({@link MERGE_RETRY_JITTER_FRACTION}), never less than the
 * schedule, so a held lock keeps its full time to clear while parties' retries stop running in lockstep. The worst case,
 * every pause at its upper edge (16.5 s + 66 s) plus every call at the 15,000 ms async RPC deadline, is 127.5 s: inside
 * the 240 s budget and before the 200 s heartbeat point of the 300 s lease. The pauses are abort-aware (see
 * `abortableDelay`).
 */
export const MERGE_MAX_ATTEMPTS = 3;
export const MERGE_RETRY_PAUSES_MS: readonly number[] = [15_000, 60_000];
export const MERGE_RETRY_JITTER_FRACTION = 0.1;

/**
 * A base pause plus its bounded jitter: `base + floor(base * MERGE_RETRY_JITTER_FRACTION * sample)`, where `sample` is
 * in `[0, 1)`. A sample outside that range (a broken seam: NaN, which fails both comparisons, negative, 1 or more,
 * infinite) adds nothing, so the pause is never shorter than the schedule nor longer than `base * 1.1`.
 */
export const jitteredPauseMs = (base: number, random: () => number): number => {
  const sample = random();
  return sample >= 0 && sample < 1
    ? base + Math.floor(base * MERGE_RETRY_JITTER_FRACTION * sample)
    : base;
};
const INT64_MAX = 9_223_372_036_854_775_807n;
const DECIMAL_VERSION = /^[1-9][0-9]{0,18}$/u;

export type TaxonomyMergeConvergeEffectOptions = Readonly<{
  /** Pause between attempts; a test seam. It must settle early when `signal` aborts. */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  /** The telemetry sink; by default one logger per Worker environment. */
  logger?: Logger;
  /** The jitter sample source, a number in `[0, 1)`; a test seam, `Math.random` by default. */
  random?: () => number;
}>;

export type TaxonomyMergeConvergeEffect = (
  input: JobEffectInput,
  context?: JobEffectDeliveryContext,
) => Promise<JobEffectResult>;

const failed = (errorCode: string): JobEffectResult => ({
  state: 'failed',
  errorCode,
  resultRef: null,
});

export const abortableDelay = (
  ms: number,
  signal: AbortSignal,
): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done(): void {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  });

/**
 * The claimed job the effect may fence on: the receipt of THIS delivery's claim (the same job and lease token, a
 * positive int64 decimal version that advances the pre-claim canonical one). The consumer attributes it the same way;
 * repeating the check here keeps the effect safe on its own.
 */
const claimedJob = (input: JobEffectInput): ClaimedMergeJob | null => {
  const lease = input.claimedLease;
  if (
    input.job.type !== CMS_TAXONOMY_MERGE_CONVERGE_JOB_TYPE ||
    lease === undefined ||
    lease.jobId !== input.job.id ||
    lease.leaseToken !== input.leaseToken ||
    typeof lease.version !== 'string' ||
    !DECIMAL_VERSION.test(lease.version) ||
    BigInt(lease.version) > INT64_MAX ||
    !DECIMAL_VERSION.test(input.job.version) ||
    BigInt(lease.version) <= BigInt(input.job.version)
  )
    return null;
  return {
    jobId: lease.jobId,
    version: lease.version,
    leaseToken: lease.leaseToken,
  };
};

type Failure = 'terminal' | 'conflict' | 'unavailable' | 'invalid';
const TERMINAL: Readonly<Record<string, string>> = {
  capability_missing: TAXONOMY_MERGE_JOB_ERROR.capabilityMissing,
  NOT_FOUND: TAXONOMY_MERGE_JOB_ERROR.jobUnknown,
  INVALID_REQUEST: TAXONOMY_MERGE_JOB_ERROR.requestInvalid,
};

/**
 * One delivery of the `cms.taxonomy.merge_converge` job as one BE00 disposition, never throwing and never `queued` or
 * manual review (see `TAXONOMY_MERGE_JOB_ERROR`). The handler is idempotent and fenced by the claim, so a transient
 * fault (a lock conflict, a timeout, a provider fault, an answer that breaks the contract) is retried inside the
 * invocation budget; a refusal that cannot change (the job actor lost `cms.taxonomy_curator`, the job is unknown, the
 * request is invalid) fails the job at once. A succeeded job always carries a result reference (the database refuses a
 * succeeded outcome without one): the continuation job the database requested when work remains, else the job itself.
 */
export const createTaxonomyMergeConvergeEffect = (
  fetchImpl: typeof fetch,
  options: TaxonomyMergeConvergeEffectOptions = {},
): TaxonomyMergeConvergeEffect => {
  const rpc = createSupabaseRpc(fetchImpl);
  const sleep = options.sleep ?? abortableDelay;
  const random = options.random ?? Math.random;

  const settle = async (
    claim: ClaimedMergeJob,
    context: JobEffectDeliveryContext,
  ): Promise<MergeSettlement> => {
    const { env, signal } = context;
    const fail = (errorCode: string): MergeSettlement => ({
      kind: 'failed',
      errorCode,
    });
    let last: Failure = 'unavailable';
    let terminalCode: string | null = null;
    for (let attempt = 0; attempt < MERGE_MAX_ATTEMPTS; attempt += 1) {
      if (signal.aborted) return fail(TAXONOMY_MERGE_JOB_ERROR.unavailable);
      try {
        const answer = await runTaxonomyMergeConverge(rpc, env, claim, signal);
        return { kind: 'converged', answer };
      } catch (error) {
        if (signal.aborted) return fail(TAXONOMY_MERGE_JOB_ERROR.unavailable);
        if (error instanceof AsyncRpcRefusalError) {
          terminalCode = Object.hasOwn(TERMINAL, error.refusal)
            ? TERMINAL[error.refusal]!
            : null;
          last =
            terminalCode !== null
              ? 'terminal'
              : error.refusal === 'CONFLICT'
                ? 'conflict'
                : 'unavailable';
        } else {
          last =
            error instanceof CmsTaxonomyMergeConvergeResponseError
              ? 'invalid'
              : 'unavailable';
        }
        if (last === 'terminal') return fail(terminalCode!);
      }
      const pause = MERGE_RETRY_PAUSES_MS[attempt];
      if (pause !== undefined)
        await sleep(jitteredPauseMs(pause, random), signal);
    }
    return fail(
      last === 'conflict'
        ? TAXONOMY_MERGE_JOB_ERROR.conflict
        : last === 'invalid'
          ? TAXONOMY_MERGE_JOB_ERROR.invalidResponse
          : TAXONOMY_MERGE_JOB_ERROR.unavailable,
    );
  };

  return async (input, context) => {
    const startedAt = Date.now();
    const claim = claimedJob(input);
    // Every delivery settles one disposition and logs one event, including a refused receipt and a missing context.
    const settled: MergeSettlement =
      claim === null
        ? { kind: 'failed', errorCode: TAXONOMY_MERGE_JOB_ERROR.claimInvalid }
        : context === undefined
          ? { kind: 'failed', errorCode: TAXONOMY_MERGE_JOB_ERROR.unavailable }
          : await settle(claim, context);
    logMergeSettled(
      mergeLoggerFor(context?.env, options.logger),
      input,
      context?.deliveryAttempt ?? 1,
      Date.now() - startedAt,
      settled,
    );
    return settled.kind === 'failed'
      ? failed(settled.errorCode)
      : {
          state: 'succeeded',
          errorCode: null,
          resultRef: {
            type: CMS_TAXONOMY_MERGE_CONVERGE_JOB_TYPE,
            id: settled.answer.continuationJobId ?? input.job.id,
          },
        };
  };
};

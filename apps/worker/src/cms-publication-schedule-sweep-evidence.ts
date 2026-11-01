import {
  createRequestId,
  type ClaimedSchedule,
  type PreflightEvidence,
} from '@wejammin/contracts';
import type { Logger } from '@wejammin/observability/logging';

import type { AsyncWorkerBindings } from './async-entrypoint';
import { AsyncRpcRefusalError } from './async-runtime-support';
import {
  evaluateAccessibilityGate,
  toPreflightEvidence,
} from './cms-editorial/a11y-structural';
import {
  loadQualityGateInput,
  logQualityGateRun,
} from './cms-editorial-production-quality-gate';

/**
 * The accessibility proof of one claimed schedule and its bounded recomputation
 * (CMS-03B-20, BE03b "Accessibility provider" DEC-158(c), DEC-169).
 *
 * This module never reaches the claim/execute RPCs: the sweep owns the port
 * (the import-graph test pins that), and hands `executeWithFreshEvidence` the
 * one `execute` function it may call.
 */

const GATE_OPERATION_ID = 'CMS-03B-20';
const GATE_RESPONSE_BYTES = 256 * 1024;

/** The typed 409 the database raises for an old, other-provider or mis-bound proof (DEC-158(c)). */
export const EVIDENCE_STALE_REFUSAL = 'preflight_evidence_stale';

/**
 * How many times the sweep recomputes the proof and executes again after the
 * database refused one as stale. A stale proof leaves the schedule, its lease,
 * its version and its attempt count untouched, so a recomputation is free of
 * cost to the retry ladder; the bound only stops a persistent cause (another
 * checker version than the database registry's) from spinning inside the 15,000
 * ms job. Three proofs in all is far more than a clock-skew or timing cause
 * ever needs, and a persistent cause is left to the lease.
 */
export const EVIDENCE_REEXECUTIONS_MAX = 2;

/**
 * The accessibility proof of one claimed schedule, or null when the checker
 * produced none. The loaded revision must be exactly the claimed one under the
 * claimed frozen dependency hash: a proof bound to anything else would be
 * refused by the database as mis-bound, so none is sent. Every call runs the
 * checker fresh (a proof is never cached) under the job's signal.
 */
export const proofFor = async (
  env: AsyncWorkerBindings,
  claim: ClaimedSchedule,
  logger: Logger,
  signal: AbortSignal,
): Promise<PreflightEvidence | null> => {
  const configuration = {
    baseUrl: env.SUPABASE_URL.replace(/\/+$/u, ''),
    secret: env.SUPABASE_SECRET_KEY,
    fetchImpl: (url: string | URL | Request, init?: RequestInit) =>
      globalThis.fetch(url, init),
    maxResponseBytes: GATE_RESPONSE_BYTES,
    now: Date.now,
  };
  const identity = {
    operationId: GATE_OPERATION_ID,
    requestId: createRequestId(undefined),
    correlationId: claim.correlationId,
  };
  const run = await evaluateAccessibilityGate({
    load: (gateSignal) =>
      loadQualityGateInput(
        configuration,
        {
          phase: 'execute',
          scheduleId: claim.scheduleId,
          revisionId: claim.revisionId,
          dependencyHash: claim.dependencyHash,
        },
        identity,
        gateSignal,
      ),
    signal,
  });
  logQualityGateRun(logger, identity, run);
  return run.state !== 'failed' &&
    run.input.revisionId === claim.revisionId &&
    run.input.dependencyHash === claim.dependencyHash
    ? toPreflightEvidence(run)
    : null;
};

/** Only the database's own 4xx `preflight_evidence_stale` refusal; nothing else is retried. */
export const isStaleEvidenceRefusal = (error: unknown): boolean =>
  error instanceof AsyncRpcRefusalError &&
  error.refusal === EVIDENCE_STALE_REFUSAL;

type FreshEvidenceExecution<T> = Readonly<{
  /** The job's deadline signal: once it has aborted, nothing is recomputed. */
  signal: AbortSignal;
  /** Run the checker for the claim, fresh. */
  prove: () => Promise<PreflightEvidence | null>;
  /** One execution of the claimed schedule under its lease with the given proof. */
  execute: (evidence: PreflightEvidence | null) => Promise<T>;
  /** Called with 1, 2, ... before each recomputation. */
  onStale: (reexecution: number) => void;
}>;

/**
 * Execute with the checker's proof; when the database refuses it as stale (an
 * execution that rolled back and consumed nothing), recompute the proof and
 * execute again under the same claim and lease, at most
 * `EVIDENCE_REEXECUTIONS_MAX` more times and never after the job deadline. A
 * proof the checker cannot produce is sent as null (the database takes its
 * unavailable-checker ladder). Any other failure, and the last stale refusal,
 * is thrown unchanged: the outcome is then unknown or unrecoverable here, and
 * the lease and the database ladder decide.
 */
export const executeWithFreshEvidence = async <T>(
  args: FreshEvidenceExecution<T>,
): Promise<T> => {
  let evidence = await args.prove();
  for (let reexecution = 1; ; reexecution += 1) {
    try {
      return await args.execute(evidence);
    } catch (error) {
      if (
        !isStaleEvidenceRefusal(error) ||
        reexecution > EVIDENCE_REEXECUTIONS_MAX ||
        args.signal.aborted
      )
        throw error;
      args.onStale(reexecution);
      evidence = await args.prove();
      if (args.signal.aborted) throw error;
    }
  }
};

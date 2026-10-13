import { PositiveBigintDecimalSchema } from '@wejammin/contracts';

import { heartbeatJobLease } from './execution.ts';
import { canRunExternalEffect } from './restore.ts';
import type {
  CanonicalJob,
  CmsLeaseCheckpoint,
  CmsLeaseControl,
  JobLeaseClaimResult,
  JobPersistencePort,
} from './runtime-types.ts';

/** The only Job type whose verified immutable origin receives lease control. */
export const CMS_SCHEMA_DRY_RUN_JOB_TYPE = 'cms.schema.dry_run';

export type CmsLeaseSessionInput = Readonly<{
  persistence: Pick<
    JobPersistencePort,
    'readCanonicalJob' | 'readRestoreFence'
  > &
    Partial<Pick<JobPersistencePort, 'heartbeatJobLease'>>;
  /** Fresh trusted clock; the frozen request clock is never a substitute. */
  clock: (() => number) | undefined;
  leaseSeconds: number;
  /** Token the claim was acquired with; only the original ever reaches CAS. */
  leaseToken: string;
  /** The pre-claim canonical job the receipt must descend from. */
  canonical: CanonicalJob;
  /** The actual internal claim receipt. */
  receipt: JobLeaseClaimResult;
}>;

export type CmsLeaseSettlement =
  Readonly<{ kind: 'healthy'; version: string }> | Readonly<{ kind: 'lost' }>;

export type CmsLeaseSession = Readonly<{
  /** The only object an effect ever sees. */
  control: CmsLeaseControl;
  /**
   * Stops admitting checkpoints, waits for every accepted one, and reports the
   * tracked server version only while a fresh clock still shows the lease live.
   */
  settle(): Promise<CmsLeaseSettlement>;
}>;

type LiveJob = CanonicalJob & Readonly<{ leaseUntilMs: number }>;

const LOST: CmsLeaseCheckpoint = Object.freeze({ kind: 'lost' });
const LOST_SETTLEMENT: CmsLeaseSettlement = Object.freeze({ kind: 'lost' });

const isFiniteTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const VERSION_PATTERN = /^[1-9]\d{0,18}$/;

// The contract schema runs its BigInt range check even after the pattern
// fails, so a malformed string such as '1e3' would throw instead of fail.
const isVersion = (value: unknown): value is string =>
  typeof value === 'string' &&
  VERSION_PATTERN.test(value) &&
  PositiveBigintDecimalSchema.safeParse(value).success;

/**
 * Whether the claim receipt is, on its identifiers and versions alone, the
 * receipt of THIS delivery's claim: the pre-claim job, the original lease token
 * and a positive server version that advances the pre-claim one. It says
 * nothing about the clock, the capabilities or the receipt's expiry, so it is
 * also what lets the consumer hand an unopened claim back by outcome CAS.
 */
export const isAttributableClaim = (
  canonical: CanonicalJob,
  receipt: JobLeaseClaimResult,
  leaseToken: string,
): boolean =>
  receipt.jobId === canonical.id &&
  receipt.leaseToken === leaseToken &&
  receipt.expectedVersion === canonical.version &&
  isVersion(receipt.version) &&
  BigInt(receipt.version) > BigInt(canonical.version);

const freshTime = (clock: () => number): number | null => {
  try {
    const now = clock();
    return isFiniteTime(now) ? now : null;
  } catch {
    return null;
  }
};

/**
 * Opens the private lease session for a verified CMS schema dry-run delivery.
 * Returns null when the claim receipt or a capability cannot be trusted; the
 * caller then hands the unopened claim back (`isAttributableClaim`) or retries,
 * before any effect or processed write.
 *
 * Checkpoints expose candidate operational facts only. The canonical reader is
 * token-blind, so a current snapshot never proves ownership; enduring stage
 * authority stays with the atomic database checks.
 */
export const openCmsLeaseSession = (
  input: CmsLeaseSessionInput,
): CmsLeaseSession | null => {
  const { persistence, canonical, receipt, clock } = input;
  const beat = persistence.heartbeatJobLease;
  if (typeof clock !== 'function' || typeof beat !== 'function') return null;
  const initial = freshTime(clock);
  if (
    initial === null ||
    !isAttributableClaim(canonical, receipt, input.leaseToken) ||
    !isFiniteTime(receipt.leaseUntilMs) ||
    receipt.leaseUntilMs <= initial
  ) {
    return null;
  }

  const lease = {
    version: receipt.version,
    expiry: receipt.leaseUntilMs,
    lost: false,
    closed: false,
  };
  const lose = (): CmsLeaseCheckpoint => {
    lease.lost = true;
    return LOST;
  };
  // The helper treats truthiness as renewal; only a raw Boolean may renew.
  const strictHeartbeat: Pick<JobPersistencePort, 'heartbeatJobLease'> = {
    heartbeatJobLease: async (request) => {
      const renewed: unknown = await beat.call(persistence, request);
      if (typeof renewed !== 'boolean') throw new Error('Invalid heartbeat');
      return renewed;
    },
  };
  const follows = (
    job: CanonicalJob | null,
    renewed: boolean,
    now: number,
  ): job is LiveJob =>
    job !== null &&
    job.id === canonical.id &&
    job.type === CMS_SCHEMA_DRY_RUN_JOB_TYPE &&
    job.state === 'running' &&
    isVersion(job.version) &&
    (renewed
      ? BigInt(job.version) > BigInt(lease.version)
      : job.version === lease.version) &&
    isFiniteTime(job.leaseUntilMs) &&
    job.leaseUntilMs > now &&
    (renewed || job.leaseUntilMs === lease.expiry);

  const run = async (): Promise<CmsLeaseCheckpoint> => {
    if (lease.lost) return LOST;
    try {
      const started = freshTime(clock);
      if (started === null || started >= lease.expiry) return lose();
      if (!canRunExternalEffect(await persistence.readRestoreFence())) {
        return lose();
      }
      const renewal = await heartbeatJobLease({
        persistence: strictHeartbeat,
        request: {
          jobId: canonical.id,
          leaseToken: input.leaseToken,
          expectedVersion: lease.version,
          leaseUntilMs: lease.expiry,
          leaseSeconds: input.leaseSeconds,
          nowMs: started,
        },
      });
      const renewed = renewal.kind === 'renewed';
      const notDue = renewal.kind === 'skip' && renewal.reason === 'not_due';
      if (!renewed && !notDue) return lose();
      // A renewal moves the expiry, so the old one is not known current.
      if (renewed && freshTime(clock) === null) return lose();
      const observed = await persistence.readCanonicalJob(canonical.id);
      const now = freshTime(clock);
      if (now === null || !follows(observed, renewed, now)) return lose();
      lease.version = observed.version;
      lease.expiry = observed.leaseUntilMs;
      return Object.freeze({
        kind: 'current',
        claimedJob: Object.freeze({
          jobId: canonical.id,
          version: lease.version,
          leaseToken: input.leaseToken,
        }),
        leaseUntilMs: lease.expiry,
      });
    } catch {
      return lose();
    }
  };

  // Accepted checkpoints run one at a time; `run` never rejects.
  let tail: Promise<unknown> = Promise.resolve();
  const control: CmsLeaseControl = Object.freeze({
    checkpoint: (): Promise<CmsLeaseCheckpoint> => {
      if (lease.closed) return Promise.resolve(LOST);
      const accepted = tail.then(run);
      tail = accepted;
      return accepted;
    },
  });
  const settle = async (): Promise<CmsLeaseSettlement> => {
    lease.closed = true;
    await tail;
    const now = freshTime(clock);
    return lease.lost || now === null || now >= lease.expiry
      ? LOST_SETTLEMENT
      : Object.freeze({ kind: 'healthy', version: lease.version });
  };
  return Object.freeze({ control, settle });
};

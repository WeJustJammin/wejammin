import { runWithDeadline } from './deadline';
import { EVENT_CONSUMER_RPC } from './rpc-names';
import {
  defaultConsumerClock,
  type ConsumerClock,
  type ConsumerTelemetry,
  type EventConsumerRpc,
} from './types';

export const RECONCILING_AGE_EVENT = 'identity.mfa.reconciling_age' as const;

export type ReconcilingAge = Readonly<{
  count: number;
  /** Seconds since the oldest `reconciling` row last changed; null when none. */
  oldestAgeSeconds: number | null;
}>;

export type ReconcilingAgePort = Readonly<{
  read: (signal: AbortSignal) => Promise<ReconcilingAge>;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseAge = (value: unknown): ReconcilingAge => {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join(',') !== 'count,oldestAgeSeconds' ||
    typeof value.count !== 'number' ||
    !Number.isInteger(value.count) ||
    value.count < 0
  )
    throw new Error('Malformed reconciling age response');
  const age = value.oldestAgeSeconds;
  const consistent =
    value.count === 0
      ? age === null
      : typeof age === 'number' && Number.isFinite(age) && age >= 0;
  if (!consistent) throw new Error('Malformed reconciling age response');
  return { count: value.count, oldestAgeSeconds: age as number | null };
};

export const createRpcReconcilingAgePort = (
  rpc: EventConsumerRpc,
): ReconcilingAgePort => ({
  read: async (signal) =>
    parseAge(
      await rpc<unknown>(EVENT_CONSUMER_RPC.readReconcilingAge, {}, signal),
    ),
});

/**
 * BE01a "MFA factors and step-up" observability: the reconciling-age gauge.
 * Each scheduled tick samples the oldest `reconciling` factor row and emits
 * it (zero when none is reconciling), so an alert can fire on a row the
 * reconciler has not been able to settle. A failed sample is reported and
 * swallowed: observability can never fail the scheduled outbox sweep.
 */
export const createReconcilingAgeProbe = (
  dependencies: Readonly<{
    age: ReconcilingAgePort;
    telemetry: ConsumerTelemetry;
    clock?: ConsumerClock;
  }>,
) => {
  const clock = dependencies.clock ?? defaultConsumerClock;
  return {
    observe: async (): Promise<void> => {
      const startedAt = clock.now();
      try {
        const age = await runWithDeadline((signal) =>
          dependencies.age.read(signal),
        );
        dependencies.telemetry.info(
          {
            eventName: RECONCILING_AGE_EVENT,
            operation: 'sample',
            outcome: 'success',
            dependency: 'supabase-postgres',
            durationMs: Math.max(0, clock.now() - startedAt),
            metrics: {
              'identity.mfa.reconciling.age.seconds': age.oldestAgeSeconds ?? 0,
              'identity.mfa.reconciling.count': age.count,
            },
          },
          { samplingClass: 'always' },
        );
      } catch {
        dependencies.telemetry.warn(
          {
            eventName: RECONCILING_AGE_EVENT,
            operation: 'sample',
            outcome: 'failure',
            errorCode: 'RECONCILING_AGE_UNAVAILABLE',
            dependency: 'supabase-postgres',
            durationMs: Math.max(0, clock.now() - startedAt),
            retryable: true,
          },
          { samplingClass: 'always', highRisk: true },
        );
      }
    },
  };
};

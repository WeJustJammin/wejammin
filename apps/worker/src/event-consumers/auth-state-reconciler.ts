import { IdentityMfaFactorChangedQueueEnvelopeSchema } from '@wejammin/contracts';

import { admitConsumerEvent } from './admit';
import { runWithDeadline } from './deadline';
import { retryAfterAttempt } from './retry-schedule';
import {
  defaultConsumerClock,
  type ConsumerClock,
  type ConsumerTelemetry,
  type DeadLetterPort,
  type EventConsumerMessage,
  type EventConsumerOutcome,
} from './types';

export const AUTH_STATE_RECONCILER = 'identity.auth-state-reconciler' as const;
const EVENT_NAME = 'identity.auth_state_reconciler' as const;

export type MfaFactorState =
  'pending' | 'verified' | 'reconciling' | 'removed' | 'expired';

/** The reconciliation view of one factor row; Worker memory only. */
export type ReconcilableFactor = Readonly<{
  state: MfaFactorState;
  authUserId: string;
  providerFactorId: string;
  version: string;
}>;

export type FactorSettlement = 'verified' | 'pending' | 'removed';

/**
 * `stale` means the factor row's version moved after the Worker read it, so
 * the provider status that was polled describes an older operation. The
 * database applied nothing; the newer operation has its own delivery.
 */
export type FactorSettlementResult = 'settled' | 'stale';

export type ReconcilerFactorPort = Readonly<{
  read: (
    factorId: string,
    signal: AbortSignal,
  ) => Promise<ReconcilableFactor | null>;
  settle: (
    input: Readonly<{
      authUserId: string;
      factorId: string;
      outcome: FactorSettlement;
      /** The `version` observed by `read`; the settlement compares and sets on it. */
      expectedVersion: string;
      requestId: string;
      correlationId: string;
    }>,
    signal: AbortSignal,
  ) => Promise<FactorSettlementResult>;
}>;

/**
 * What the provider reports for one factor. `unavailable` covers a timeout,
 * a non-2xx answer, a malformed 2xx and an open circuit: none of them says
 * anything about the factor, so none of them settles it.
 */
export type ProviderFactorStatus =
  'verified' | 'unverified' | 'absent' | 'unavailable';

/**
 * The reconciler's whole provider surface is a status read. It cannot
 * enroll, challenge, verify or unenroll, so an ambiguous effect is never
 * resent from here (BE01a: "polled by provider factor status, never resent").
 */
export type ProviderFactorStatusPort = Readonly<{
  readStatus: (
    input: Readonly<{ authUserId: string; providerFactorId: string }>,
    signal: AbortSignal,
  ) => Promise<ProviderFactorStatus>;
}>;

export type AuthStateReconcilerDependencies = Readonly<{
  factors: ReconcilerFactorPort;
  provider: ProviderFactorStatusPort;
  deadLetter: DeadLetterPort;
  telemetry: ConsumerTelemetry;
  clock?: ConsumerClock;
}>;

const SETTLEMENT: Readonly<
  Record<Exclude<ProviderFactorStatus, 'unavailable'>, FactorSettlement>
> = { verified: 'verified', unverified: 'pending', absent: 'removed' };

export const createAuthStateReconciler = (
  dependencies: AuthStateReconcilerDependencies,
) => {
  const clock = dependencies.clock ?? defaultConsumerClock;
  const { telemetry } = dependencies;

  const process = async (
    message: EventConsumerMessage,
  ): Promise<EventConsumerOutcome> => {
    const startedAt = clock.now();
    return runWithDeadline(async (signal) => {
      const admitted = await admitConsumerEvent({
        consumer: AUTH_STATE_RECONCILER,
        schema: IdentityMfaFactorChangedQueueEnvelopeSchema,
        message,
        deadLetter: dependencies.deadLetter,
        telemetry,
        signal,
      });
      if (!admitted.ok) return admitted.outcome;
      const { envelope } = admitted;
      const emit = (
        outcome: 'success' | 'retry' | 'rejected' | 'failure',
        errorCode: string | null,
        metrics: Record<string, number> = {},
      ): void => {
        const details = {
          eventName: EVENT_NAME,
          operation: 'reconcile',
          consumer: AUTH_STATE_RECONCILER,
          outcome,
          attempt: Math.max(1, message.attempts),
          correlationId: envelope.correlationId,
          traceId: envelope.eventId,
          entityType: 'mfa_factor',
          entityVersion: envelope.aggregateVersion,
          dependency: 'supabase-auth-mfa',
          durationMs: Math.max(0, clock.now() - startedAt),
          retryable: outcome === 'retry',
          ...(errorCode === null ? {} : { errorCode }),
          metrics: { 'identity.mfa.reconcile.total': 1, ...metrics },
        } as const;
        const options = {
          samplingClass: 'always',
          highRisk: outcome !== 'success',
        } as const;
        if (outcome === 'success') telemetry.info(details, options);
        else telemetry.warn(details, options);
      };
      const retry = (code: string): EventConsumerOutcome => {
        emit('retry', code, { 'identity.mfa.reconcile.retries.total': 1 });
        return retryAfterAttempt(message.attempts);
      };

      let factor: ReconcilableFactor | null;
      try {
        factor = await dependencies.factors.read(envelope.aggregateId, signal);
      } catch {
        return retry('FACTOR_READ_FAILED');
      }
      if (factor === null) {
        emit('rejected', 'FACTOR_NOT_FOUND');
        return { outcome: 'ack' };
      }
      // Compare-and-set by current state: only a reconciling row is polled.
      // Any other state means another delivery or the request path settled it.
      if (factor.state !== 'reconciling') {
        emit('success', null, {
          'identity.mfa.reconcile.already_settled.total': 1,
        });
        return { outcome: 'ack' };
      }

      let status: ProviderFactorStatus;
      try {
        status = await dependencies.provider.readStatus(
          {
            authUserId: factor.authUserId,
            providerFactorId: factor.providerFactorId,
          },
          signal,
        );
      } catch {
        status = 'unavailable';
      }
      if (status === 'unavailable') return retry('PROVIDER_STATUS_UNAVAILABLE');

      const settlement = SETTLEMENT[status];
      let settled: FactorSettlementResult;
      try {
        settled = await dependencies.factors.settle(
          {
            authUserId: factor.authUserId,
            factorId: envelope.aggregateId,
            outcome: settlement,
            expectedVersion: factor.version,
            requestId: clock.randomUuid(),
            correlationId: envelope.correlationId,
          },
          signal,
        );
      } catch {
        return retry('FACTOR_SETTLE_FAILED');
      }
      // Compare-and-set by version: the factor changed while the provider was
      // polled, so this delivery is stale. Acknowledge without effect; the
      // newer state change was published with its own event.
      if (settled === 'stale') {
        emit('success', null, {
          'identity.mfa.reconcile.stale_version.total': 1,
        });
        return { outcome: 'ack' };
      }
      emit('success', null, {
        [`identity.mfa.reconcile.${settlement}.total`]: 1,
      });
      return { outcome: 'ack' };
    });
  };

  return { process };
};

export type AuthStateReconciler = ReturnType<typeof createAuthStateReconciler>;
